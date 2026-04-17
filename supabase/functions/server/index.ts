import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Scene Dispatch endpoint - Instagram feed aggregator for nightlife scenes
// GET /scene-dispatch?city=miami|nyc|la|...
// Fetches latest Instagram posts from curated venue/DJ accounts + city hashtags
// Combines, dedupes, sorts by recency, caches per-city for 6 hours

interface InstagramPost {
  permalink: string
  author: string
  authorAvatar?: string
  caption: string
  imageUrl: string
  likes: number
  comments: number
  timestamp: string
}

interface CityConfig {
  profiles: string[]  // @handles to scrape (3 most recent posts each)
  hashtags: string[]  // #tags to scrape (5 posts per hashtag)
}

const CITY_CONFIGS: Record<string, CityConfig> = {
  miami: {
    profiles: ['e11even', 'livmiami', 'storymiamiclub', 'clubspace', 'theoasismiami'],
    hashtags: ['miamibeach', 'miaminightlife', 'wynwood', 'brickell']
  },
  nyc: {
    profiles: ['marqueeNewYork', 'taodowntown', 'publichotelnyc', 'avant_gardner', 'houseofy'],
    hashtags: ['nycnightlife', 'newyorknights', 'manhattannights']
  },
  la: {
    profiles: ['thefanela', 'exchangela', 'academylosangeles', 'soundnightclub'],
    hashtags: ['lanightlife', 'hollywoodclub', 'weho']
  },
  chicago: {
    profiles: ['smartbarchicago', 'spybarchi', 'themidhicago', 'soundbarchicago'],
    hashtags: ['chinight', 'chiclubbing', 'chicagonights']
  },
  london: {
    profiles: ['ministryofsound', 'fabriclondon', 'printworkslondon', 'theyardlondon'],
    hashtags: ['londonnights', 'ukrave', 'shoreditchnights']
  },
  berlin: {
    profiles: ['berghain', 'sisyphos_berlin', 'watergate_club', 'aboutblank_berlin'],
    hashtags: ['berlinnights', 'berlintechno', 'berlinclubbing']
  },
  ibiza: {
    profiles: ['hiiibiza', 'pachaibiza', 'amnesia_ibiza', 'dcbeachibiza', 'ushuaiaibiza'],
    hashtags: ['ibiza2026', 'ibizanights', 'ibizaclubbing']
  },
  dallas: {
    profiles: ['it_ll_do_club', 'thebombfactory', 'stereo_live_dallas'],
    hashtags: ['dallasnight', 'dfwnightlife', 'deepellum']
  },
  houston: {
    profiles: ['spire_houston', 'richshouston', 'clehoustontx'],
    hashtags: ['houstonnightlife', 'hounights', 'htownclub']
  }
}

const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

async function runApifyActor(actorId: string, input: any): Promise<any[]> {
  const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  
  if (!runResponse.ok) throw new Error(`Apify run failed: ${runResponse.statusText}`)
  
  const runData = await runResponse.json()
  const runId = runData.data.id
  
  // Poll for completion
  let status = 'RUNNING'
  while (status === 'RUNNING') {
    await new Promise(r => setTimeout(r, 2000))
    const statusResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_TOKEN}`)
    const statusData = await statusResponse.json()
    status = statusData.data.status
  }
  
  if (status !== 'SUCCEEDED') throw new Error(`Apify actor failed with status: ${status}`)
  
  // Fetch dataset
  const datasetResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${APIFY_TOKEN}`)
  return await datasetResponse.json()
}

async function sceneDispatchHandler(req: Request, supabase: any): Promise<Response> {
  const url = new URL(req.url)
  const city = url.searchParams.get('city')?.toLowerCase()
  
  if (!city || !CITY_CONFIGS[city]) {
    return new Response(JSON.stringify({ error: 'Invalid city. Available: ' + Object.keys(CITY_CONFIGS).join(', ') }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
  
  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: 'Apify token not configured' }), { 
      status: 500,
      headers: { ...corsHeaders }
    })
  }
  
  // Check KV cache
  const cacheKey = `scene_dispatch:${city}`
  const { data: cached } = await supabase
    .from('kv_cache')
    .select('value, created_at')
    .eq('key', cacheKey)
    .single()
  
  if (cached && (Date.now() - new Date(cached.created_at).getTime()) < CACHE_TTL) {
    return new Response(JSON.stringify(cached.value), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders }
    })
  }
  
  const config = CITY_CONFIGS[city]
  
  // Run both scrapers in parallel
  const [profileResults, hashtagResults] = await Promise.all([
    runApifyActor('apify/instagram-profile-scraper', {
      usernames: config.profiles,
      resultsLimit: 3 // 3 most recent per profile
    }),
    runApifyActor('apify/instagram-hashtag-scraper', {
      hashtags: config.hashtags,
      resultsLimit: 5 // 5 posts per hashtag
    })
  ])
  
  // Normalize and combine
  const posts: InstagramPost[] = [...profileResults, ...hashtagResults].map((item: any) => ({
    permalink: item.url || (item.shortCode ? `https://instagram.com/p/${item.shortCode}` : ''),
    author: item.ownerUsername || item.username || 'unknown',
    authorAvatar: item.ownerProfilePicUrl || item.profilePicUrl,
    caption: item.caption || '',
    imageUrl: item.displayUrl || item.thumbnailUrl || '',
    likes: item.likesCount || 0,
    comments: item.commentsCount || 0,
    timestamp: item.timestamp || new Date().toISOString()
  }))
  
  // Dedupe by permalink and sort by recency
  const seen = new Set()
  const unique = posts
    .filter(p => {
      if (!p.permalink || seen.has(p.permalink)) return false
      seen.add(p.permalink)
      return true
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  // Cache
  await supabase.from('kv_cache').upsert({
    key: cacheKey,
    value: unique,
    created_at: new Date().toISOString()
  })
  
  return new Response(JSON.stringify(unique), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const url = new URL(req.url)
    const pathname = url.pathname

    // Route to scene-dispatch handler
    if (pathname.includes('/scene-dispatch')) {
      return await sceneDispatchHandler(req, supabase)
    }

    // Default response for other routes
    return new Response(
      JSON.stringify({ message: 'A-List Server Function', version: '1.0' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
