import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store.ts";

// ── Web Search Integration ───────────────────────────────────────────────────
// Searches Google (or DuckDuckGo as free fallback) for events & tickets
// at a specific club/venue in a given city.

interface WebSearchResult {
  id: string;
  name: { text: string };
  venue: { name: string };
  start: { local: string };
  logo: { url: string | null };
  source: string;
  ticketUrl: string | null;
  venueWebsite: string | null;
  snippet: string | null;
}

// Google Custom Search configuration (optional — set these env vars for best results)
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GOOGLE_CX = Deno.env.get("GOOGLE_CX"); // Custom Search Engine ID

/**
 * Search the web for events at a specific venue/club in a city.
 * Constructs a search query like: "LIV Miami events tickets 2026"
 * Uses Google Custom Search API if configured, otherwise falls back to DuckDuckGo.
 */
async function searchWebForEvents(query: string, city: string): Promise<WebSearchResult[]> {
  const currentYear = new Date().getFullYear();
  const searchQuery = `${query} ${city} events tickets ${currentYear}`;
  

  // Try Google Custom Search first (if configured)
  if (GOOGLE_API_KEY && GOOGLE_CX) {
    const results = await googleCustomSearch(searchQuery, query);
    if (results.length > 0) return results;
  }

  // Fallback: DuckDuckGo HTML search (no API key needed)
  return await duckDuckGoSearch(searchQuery, query);
}

/**
 * Google Custom Search API
 * Requires GOOGLE_API_KEY and GOOGLE_CX environment variables.
 * Free tier: 100 queries/day.
 */
async function googleCustomSearch(searchQuery: string, venueName: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(searchQuery)}&num=10`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return results;
    }

    const data = await res.json();
    const items = data.items || [];

    for (const item of items) {
      // Skip results that are clearly not events (e.g. Wikipedia, Yelp reviews)
      const skipDomains = ["wikipedia.org", "yelp.com", "tripadvisor.com", "facebook.com/about"];
      if (skipDomains.some(d => item.link?.includes(d))) continue;

      results.push({
        id: `google-${results.length}-${Date.now()}`,
        name: { text: cleanTitle(item.title || venueName) },
        venue: { name: extractVenueName(item.title, venueName) },
        start: { local: extractDateFromText(item.snippet || item.title || "") || new Date().toISOString() },
        logo: { url: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null },
        source: "web_search",
        ticketUrl: item.link,
        venueWebsite: new URL(item.link).origin,
        snippet: formatWebSnippet(item.link, extractVenueName(item.title, venueName), item.snippet || null),
      });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
  }

  return results;
}

/**
 * DuckDuckGo HTML search — free, no API key required.
 * Fetches the HTML results page and parses out the search results.
 */
async function duckDuckGoSearch(searchQuery: string, venueName: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return results;
    }

    const html = await res.text();

    // Parse DuckDuckGo result blocks
    // Each result is in a div with class "result" containing:
    //   - <a class="result__a"> (title + link)
    //   - <a class="result__snippet"> (description)
    //   - <a class="result__url"> (display URL)

    // Extract result links and titles
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    
    const links: { url: string; title: string }[] = [];
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      let href = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim(); // Strip inner HTML tags
      
      // DuckDuckGo wraps URLs in a redirect — extract the actual URL
      if (href.includes("uddg=")) {
        const decoded = decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] || href);
        href = decoded;
      }
      
      if (href && title && href.startsWith("http")) {
        links.push({ url: href, title });
      }
    }

    // Extract snippets
    const snippets: string[] = [];
    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
    }

    // Skip results that are clearly not events
    const skipDomains = ["wikipedia.org", "yelp.com/biz", "tripadvisor.com", "facebook.com/pages"];
    
    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const link = links[i];
      if (skipDomains.some(d => link.url.includes(d))) continue;
      
      const snippet = snippets[i] || null;

      results.push({
        id: `ddg-${results.length}-${Date.now()}`,
        name: { text: cleanTitle(link.title) },
        venue: { name: extractVenueName(link.title, venueName) },
        start: { local: extractDateFromText(snippet || link.title || "") || new Date().toISOString() },
        logo: { url: null },
        source: "web_search",
        ticketUrl: link.url,
        venueWebsite: safeOrigin(link.url),
        snippet: formatWebSnippet(link.url, extractVenueName(link.title, venueName), snippet),
      });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
  }

  return results;
}

/** Clean up a search result title */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|–—]\s*(Eventbrite|Ticketmaster|Dice|RA|AXS|See Tickets|Fever).*$/i, "")
    .replace(/\s*\|\s*.*$/, "")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Try to extract a venue name from a title, fallback to the search query */
function extractVenueName(title: string, fallback: string): string {
  // Common patterns: "Event Name at Venue Name" or "Event Name - Venue Name"
  const atMatch = title.match(/\bat\s+(.+?)(?:\s*[-|,]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  const dashMatch = title.match(/[-–—]\s*(.+?)(?:\s*[-|]|$)/);
  if (dashMatch && dashMatch[1].length < 40) return dashMatch[1].trim();
  
  return fallback;
}

/** Try to extract a date from text like "Feb 22, 2026" or "March 15" */
function extractDateFromText(text: string): string | null {
  // Match patterns like "Feb 22, 2026", "March 15, 2026", "2026-02-22", "02/22/2026"
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,  // ISO format
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?)/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch { /* skip */ }
    }
  }
  return null;
}

/** Format a web search snippet in the same style as Ticketmaster (emoji + structured info) */
function formatWebSnippet(url: string, venueName: string, rawSnippet: string | null): string {
  const parts: string[] = [];

  // Add venue name
  if (venueName) parts.push(`📍 ${venueName}`);

  // Add source domain (e.g. "🔗 livnightclub.com")
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    parts.push(`🔗 ${domain}`);
  } catch { /* skip */ }

  // If there's a date in the snippet, extract and format it
  const dateStr = extractDateFromText(rawSnippet || "");
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      parts.push(`📅 ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
    }
  }

  // Build the structured line, then add the raw snippet below if available
  const structuredLine = parts.join('  •  ');

  if (rawSnippet && rawSnippet.length > 10) {
    return `${structuredLine}\n${rawSnippet}`;
  }

  return structuredLine || rawSnippet || "";
}

/** Safely get origin from a URL, return null on failure */
function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ── Ticketmaster Discovery API ───────────────────────────────────────────────
// Free tier: 5,000 calls/day. Best for large venues, concerts, sports.
const TICKETMASTER_API_KEY = Deno.env.get("TICKETMASTER_API_KEY");

// ── Apify / Resident Advisor (RA Guide) ──────────────────────────────────────
// Uses the Apify RA Events Scraper actor (misceres/ra-events-scraper) to pull
// real event listings from RA.co. Requires APIFY_TOKEN Supabase secret.
// Actor docs: https://apify.com/misceres/ra-events-scraper
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const RA_ACTOR_ID = "misceres~ra-events-scraper";

/** Map common city names → RA.co URL slug (country/city). */
function cityToRASlug(city: string): string {
  const c = city.toLowerCase();
  const map: Record<string, string> = {
    miami: "us/miami",
    "new york": "us/newyork",
    "new york city": "us/newyork",
    nyc: "us/newyork",
    "los angeles": "us/losangeles",
    la: "us/losangeles",
    chicago: "us/chicago",
    houston: "us/houston",
    detroit: "us/detroit",
    london: "uk/london",
    berlin: "de/berlin",
    amsterdam: "nl/amsterdam",
    barcelona: "es/barcelona",
    paris: "fr/paris",
    ibiza: "es/ibiza",
    toronto: "ca/toronto",
    montreal: "ca/montreal",
    sydney: "au/sydney",
    melbourne: "au/melbourne",
    tokyo: "jp/tokyo",
  };
  for (const [key, slug] of Object.entries(map)) {
    if (c.includes(key)) return slug;
  }
  // Default: attempt a generic slug from city name
  return `us/${c.replace(/[^a-z0-9]/g, "")}`;
}

/**
 * Fetch events from Resident Advisor via the Apify RA Events Scraper actor.
 * Results are normalised into the shared WebSearchResult shape so the merge
 * logic in the main endpoint works identically for every source.
 */
async function searchResidentAdvisor(
  query: string,
  city: string
): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  if (!APIFY_TOKEN) {
    return results;
  }

  try {
    const slug = cityToRASlug(city);
    const raUrl = `https://ra.co/events/${slug}`;

    // Call the Apify Actors REST API to run the actor synchronously
    // (waitsForFinish=60 means we block up to 60 seconds for results)
    const actorUrl =
      `https://api.apify.com/v2/acts/${RA_ACTOR_ID}/run-sync-get-dataset-items` +
      `?token=${APIFY_TOKEN}&timeout=45&memory=256&maxItems=10`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);

    const res = await fetch(actorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: raUrl }],
        maxEvents: 10,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return results;
    }

    // deno-lint-ignore no-explicit-any
    const items: any[] = await res.json();
    for (let i = 0; i < items.length; i++) {
      const ev = items[i];
      // Filter by search query if present
      const title: string = ev.title ?? ev.name ?? "";
      const venue: string = ev.venue?.name ?? ev.venueName ?? "RA Event";
      if (
        query &&
        !title.toLowerCase().includes(query.toLowerCase()) &&
        !venue.toLowerCase().includes(query.toLowerCase())
      ) {
        continue;
      }

      results.push({
        id: `ra-${ev.id ?? i}-${Date.now()}`,
        name: { text: cleanTitle(title) },
        venue: { name: venue },
        start: { local: ev.date ?? ev.startDate ?? new Date().toISOString() },
        logo: { url: ev.flyer ?? ev.imageUrl ?? null },
        source: "ra",
        ticketUrl: ev.ticketUrl ?? ev.url ?? `https://ra.co/events/${slug}`,
        venueWebsite: ev.venue?.url ?? null,
        snippet: ev.lineup ? `Lineup: ${ev.lineup.join(", ")}` : null,
      });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
  }
  return results;
}

/**
 * Search Ticketmaster's Discovery API for events matching a query + city.
 */
async function searchTicketmaster(query: string, city: string): Promise<WebSearchResult[]> {
  if (!TICKETMASTER_API_KEY) {
    return [];
  }

  const results: WebSearchResult[] = [];

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&size=10&sort=date,asc`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return results;
    }

    const data = await res.json();
    const events = data?._embedded?.events || [];

    for (const event of events) {
      const venue = event._embedded?.venues?.[0];
      const image = event.images?.find((img: { ratio: string; width: number; url: string }) => img.ratio === "16_9" && img.width > 300)
                  || event.images?.[0];
      
      const startDate = event.dates?.start?.dateTime || event.dates?.start?.localDate || new Date().toISOString();

      results.push({
        id: `tm-${event.id}`,
        name: { text: event.name || query },
        venue: { name: venue?.name || city },
        start: { local: startDate },
        logo: { url: image?.url || null },
        source: "ticketmaster",
        ticketUrl: event.url || null,
        venueWebsite: venue?.url || null,
        snippet: [
          event.dates?.start?.localDate ? `📅 ${new Date(event.dates.start.localDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : null,
          venue?.name ? `📍 ${venue.name}` : null,
          event.priceRanges?.[0] ? `💰 $${event.priceRanges[0].min} – $${event.priceRanges[0].max}` : null,
        ].filter(Boolean).join('  •  ') || null,
      });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
  }

  return results;
}

// ── Ticket Tailor Search ─────────────────────────────────────────────────────
// Ticket Tailor doesn't have a public discovery API, so we search their
// public event listings via DuckDuckGo with site-scoped search.

/**
 * Search Ticket Tailor's public event listings for events near a city.
 */
async function searchTicketTailor(query: string, city: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  try {
    const searchQuery = `site:www.tickettailor.com ${query} ${city} events`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return results;
    }

    const html = await res.text();

    // Parse result links and titles (same DDG format)
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links: { url: string; title: string }[] = [];
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      let href = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();

      if (href.includes("uddg=")) {
        href = decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] || href);
      }

      // Only include tickettailor.com results
      if (href && title && href.includes("tickettailor.com")) {
        links.push({ url: href, title });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
    }

    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const link = links[i];
      const snippet = snippets[i] || null;

      results.push({
        id: `tt-${i}-${Date.now()}`,
        name: { text: cleanTitle(link.title) },
        venue: { name: extractVenueName(link.title, query) },
        start: { local: extractDateFromText(snippet || link.title || "") || new Date().toISOString() },
        logo: { url: null },
        source: "tickettailor",
        ticketUrl: link.url,
        venueWebsite: safeOrigin(link.url),
        snippet: snippet,
      });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
  }

  return results;
}

const app = new Hono().basePath("/server");

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");
const SPOTIFY_REDIRECT_URI = Deno.env.get("SPOTIFY_REDIRECT_URI") || "https://localhost:3000/spotify/callback";

// SoundCloud OAuth configuration
const SOUNDCLOUD_CLIENT_ID = Deno.env.get("SOUNDCLOUD_CLIENT_ID");
const _SOUNDCLOUD_CLIENT_SECRET = Deno.env.get("SOUNDCLOUD_CLIENT_SECRET");
const SOUNDCLOUD_REDIRECT_URI = Deno.env.get("SOUNDCLOUD_REDIRECT_URI") || "https://localhost:3000/soundcloud/callback";

// Instagram Graph API (OAuth with Instagram Login) configuration
// Requires: INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, INSTAGRAM_REDIRECT_URI
// App must have instagram_business_basic permission approved.
const INSTAGRAM_CLIENT_ID = Deno.env.get("INSTAGRAM_CLIENT_ID");
const INSTAGRAM_CLIENT_SECRET = Deno.env.get("INSTAGRAM_CLIENT_SECRET");
// The redirect URI must be registered in your Meta app and should point
// directly to the Supabase edge function callback endpoint:
// https://<project-ref>.supabase.co/functions/v1/server/instagram/callback
const INSTAGRAM_REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI") ||
  `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "")}/functions/v1/server/instagram/callback`;

// Eventbrite configuration
const EVENTBRITE_API_KEY = Deno.env.get("EVENTBRITE_API_KEY");

// Enable logger
app.use('*', logger());

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: (origin) => {
      const allowed = ["https://a-list-core-application.web.app", "http://localhost:5173", "http://localhost:3000"];
      return allowed.includes(origin ?? "") ? origin : allowed[0];
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-8fcc84de/health", (c) => {
  return c.json({ status: "ok" });
});

// Spotify OAuth - Initiate login
app.get("/spotify/login", (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  if (!SPOTIFY_CLIENT_ID) {
    return c.json({ error: "Spotify client ID not configured" }, 500);
  }

  const scopes = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "playlist-read-private"
  ].join(" ");

  const state = `spotify:${userId}`; // provider:userId so App.tsx can route the callback correctly

  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code` +
    `&client_id=${SPOTIFY_CLIENT_ID}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&state=${state}`;

  return c.json({ authUrl });
});

// Spotify OAuth - Handle callback
app.get("/spotify/callback", async (c) => {
  const code = c.req.query("code");
  const rawState = c.req.query("state"); // "spotify:userId"
  const error = c.req.query("error");

  if (error) {
    return c.json({ error: `Spotify authorization failed: ${error}` }, 400);
  }

  if (!code || !rawState) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: "Spotify credentials not configured" }, 500);
  }

  // Parse provider:userId state
  const userId = rawState.startsWith("spotify:") ? rawState.slice(8) : rawState;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return c.json({ error: "Failed to exchange code for token" }, tokenResponse.status as ContentfulStatusCode);
    }

    const tokenData = await tokenResponse.json();

    // Store tokens in KV store with userId as key
    await kv.set(`spotify_token_${userId}`, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      scope: tokenData.scope
    });

    return c.json({
      success: true,
      message: "Spotify connected successfully",
      userId
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return c.json({ error: `Failed to process Spotify callback: ${msg}` }, 500);
  }
});

// Helper: Generate curated events for a given city
function generateCuratedEvents(cityName: string, searchQuery?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Helper to create a date offset from today
  const dateOffset = (days: number, hour: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString().replace("Z", "");
  };

  // Day of week (0=Sun ... 6=Sat)
  const dow = today.getDay();
  // Days until next Friday (5), Saturday (6), Sunday (0)
  const daysToFri = (5 - dow + 7) % 7 || 7;
  const daysToSat = (6 - dow + 7) % 7 || 7;
  const daysToSun = (7 - dow) % 7 || 7;

  const venueTemplates: Record<string, { venues: string[]; vibes: string[] }> = {
    default: {
      venues: ["The Grand Room", "Velvet Underground", "Skyline Terrace", "Club Noir", "The Social House", "Neon District", "Ruby Lounge", "The Ivory Tower", "Pulse Nightclub", "The Penthouse", "Echo Chamber", "Gold Bar", "The Rooftop", "Luxe Lounge", "Midnight Society"],
      vibes: ["Deep House", "R&B Night", "Latin Fusion", "Jazz & Soul", "Hip-Hop", "Electronic", "Afrobeats", "Techno", "Live Band", "DJ Set", "Acoustic", "Reggaeton", "Pop", "Indie", "Chill"]
    },
    Miami: {
      venues: ["LIV", "E11EVEN", "Club Space", "Do Not Sit On The Furniture", "The Wharf", "Komodo", "Mango's Tropical Cafe", "Story Nightclub", "Basement Miami", "Hyde Beach", "Treehouse", "Floyd", "ATV Records", "Brickell City Centre Rooftop", "Swan"],
      vibes: ["Latin House", "EDM", "Reggaeton", "Deep Tech", "Tropical Bass", "Afro-Cuban", "Miami Bass", "Tech House", "Bachata Night", "Salsa Social", "Ocean Drive Live", "Brickell After Dark", "South Beach Sessions", "Wynwood Beats", "Art Basel Vibes"]
    },
    "New York": {
      venues: ["Marquee", "Avant Gardner", "Output", "Good Room", "House Of Yes", "Le Bain", "Elsewhere", "Brooklyn Mirage", "Public Records", "Nowadays", "Bossa Nova Civic Club", "Jupiter Disco", "Black Flamingo", "The Lot Radio", "Baby's All Right"],
      vibes: ["Underground Techno", "Brooklyn Bass", "Disco Revival", "Warehouse Rave", "Jazz Lounge", "Hip-Hop Classics", "House Music", "Afrobeats", "Experimental", "Indie Dance", "Soul Train", "Latin Night", "Rooftop Sessions", "Drag Brunch", "Comedy & Cocktails"]
    },
    "Los Angeles": {
      venues: ["Sound Nightclub", "Exchange LA", "Academy", "Avalon Hollywood", "The Viper Room", "Catch One", "No Vacancy", "Bootsy Bellows", "1720", "The Echo", "Resident", "Los Globos", "El Rey Theatre", "The Satellite", "Break Room 86"],
      vibes: ["Sunset Strip Live", "Hollywood Nights", "West Coast G-Funk", "Desert House", "Indie Rock", "Latin Beats", "Techno Underground", "Pool Party", "Rooftop Vibes", "Comedy Night", "80s Retro", "K-Pop Night", "Acoustic Sessions", "DJ Battle", "Neon Glow"]
    }
  };

  const cityKey = Object.keys(venueTemplates).find(
    k => cityName.toLowerCase().includes(k.toLowerCase())
  ) || "default";
  const { venues, vibes } = venueTemplates[cityKey];

  // Curated event names per vibe
  const eventNames = [
    `${vibes[0]} Night`,
    `${cityName.split(",")[0]} After Dark`,
    `Midnight Sessions — ${vibes[1]}`,
    `The Underground: ${vibes[2]}`,
    `Sunset Social`,
    `Velvet Fridays`,
    `Saturday Night Affair`,
    `Sunday Funday Brunch & Beats`,
    `Industry Night`,
    `Full Moon Party`,
    `The A-List Experience`,
    `Golden Hour — ${vibes[3]}`,
    `Neon Dreams`,
    `Late Night Society`,
    `${vibes[4]} Takeover`,
    `Rooftop Rendezvous`,
    `Warehouse Sessions`,
    `${vibes[5]} & Cocktails`,
    `The Exclusive: Members Only`,
    `Weekend Kickoff — ${vibes[6]}`,
  ];

  const logos = [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1504680177321-2e6a879aac86?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1564585222527-c2777a5bc6cb?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1496337589254-7e19d01cec44?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1508854710579-5c2029938012?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1519999482648-25049ddd37b1?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1582711012124-a56cf82307a0?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1485872299829-c44b18e58e42?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  ];

  // Schedule: today (2), tomorrow (1), weekdays (2), fri (2), sat (3), sun (1), later weeks (4)
  const schedule = [
    { offset: 0, hour: 21 },
    { offset: 0, hour: 23 },
    { offset: 1, hour: 20 },
    { offset: 2, hour: 21 },
    { offset: 3, hour: 20 },
    { offset: daysToFri, hour: 22 },
    { offset: daysToFri, hour: 23 },
    { offset: daysToSat, hour: 21 },
    { offset: daysToSat, hour: 22 },
    { offset: daysToSat, hour: 23 },
    { offset: daysToSun, hour: 14 },
    { offset: daysToFri + 7, hour: 22 },
    { offset: daysToSat + 7, hour: 21 },
    { offset: daysToSat + 7, hour: 23 },
    { offset: daysToSun + 7, hour: 15 },
    { offset: 14, hour: 20 },
    { offset: 18, hour: 21 },
    { offset: 21, hour: 22 },
    { offset: 25, hour: 20 },
    { offset: 28, hour: 21 },
  ];

  let events = schedule.map((s, i) => ({
    id: `curated-${i}-${Date.now()}`,
    name: { text: eventNames[i % eventNames.length] },
    venue: { name: venues[i % venues.length] },
    start: { local: dateOffset(s.offset, s.hour) },
    logo: { url: logos[i % logos.length] }
  }));

  // Filter by search query if provided
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    events = events.filter(e =>
      e.name.text.toLowerCase().includes(q) ||
      e.venue.name.toLowerCase().includes(q)
    );
  }

  return events;
}

// ── Venue / Club Web Search Endpoint ──────────────────────────────────────────
// Dedicated endpoint to search the web for events at a specific venue/club
app.get("/venue/search", async (c) => {
  const query = c.req.query("q");
  const city = c.req.query("city") || "Miami";

  if (!query) {
    return c.json({ error: "Search query (q) is required" }, 400);
  }

  const results = await searchWebForEvents(query, city);
  return c.json(results);
});

// ── Events Search Endpoint (Multi-Source: Eventbrite + Ticketmaster + Ticket Tailor + Web) ──
app.get("/eventbrite/events", async (c) => {
  // Note: Eventbrite key is optional — web search, Ticketmaster, and curated fallbacks still run without it

  const city = c.req.query("city");
  const lat = c.req.query("lat");
  const lon = c.req.query("lon");
  const query = c.req.query("q");
  const categories = c.req.query("categories");
  const sortBy = c.req.query("sort_by");

  const locationName = city || "Miami";
  const hasSearchQuery = query && query.length >= 2;

  // ── Launch all searches in parallel ──────────────────────────────────────

  // 1. Web search (Google/DuckDuckGo)
  const webSearchPromise: Promise<WebSearchResult[]> = hasSearchQuery
    ? searchWebForEvents(query, locationName).catch(err => {
        return [] as WebSearchResult[];
      })
    : Promise.resolve([]);

  // 2. Ticketmaster Discovery API
  const ticketmasterPromise: Promise<WebSearchResult[]> = hasSearchQuery
    ? searchTicketmaster(query, locationName).catch(err => {
        return [] as WebSearchResult[];
      })
    : Promise.resolve([]);

  // 3. Ticket Tailor search
  const ticketTailorPromise: Promise<WebSearchResult[]> = hasSearchQuery
    ? searchTicketTailor(query, locationName).catch(err => {
        return [] as WebSearchResult[];
      })
    : Promise.resolve([]);

  // 4. Resident Advisor (RA Guide) via Apify RA Events Scraper
  // RA is the leading platform for underground/electronic event listings.
  // Results include full lineup, flyer art, and direct ticket links.
  const raPromise: Promise<WebSearchResult[]> = APIFY_TOKEN
    ? searchResidentAdvisor(query ?? "", locationName).catch(err => {
        return [] as WebSearchResult[];
      })
    : Promise.resolve([]);

  // 5. Eventbrite API
  const eventbritePromise: Promise<Record<string, unknown>[]> = (async () => {
    if (!EVENTBRITE_API_KEY) return [];
    
    let url = `https://www.eventbriteapi.com/v3/events/search/?token=${EVENTBRITE_API_KEY}&expand=venue`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (categories) url += `&categories=${categories}`;
    if (sortBy) url += `&sort_by=${sortBy}`;
    if (lat && lon) {
      url += `&location.latitude=${lat}&location.longitude=${lon}&location.within=20km`;
    } else {
      url += `&location.address=${encodeURIComponent(locationName)}`;
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return (data.events || []).map((e: Record<string, unknown>) => ({ ...e, source: "eventbrite" }));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Eventbrite] Error: ${msg}`);
    }
    return [];
  })();

  // ── Await all results ─────────────────────────────────────────────────────
  const [webSearchResults, ticketmasterResults, ticketTailorResults, raResults, eventbriteEvents] =
    await Promise.all([webSearchPromise, ticketmasterPromise, ticketTailorPromise, raPromise, eventbritePromise]);


  // ── Merge results ─────────────────────────────────────────────────────────
  // Priority order: RA Guide → Web Search (venue sites) → Ticketmaster → Ticket Tailor → Eventbrite
  // RA is placed first because it has the most complete underground/electronic event data
  // with real lineups, flyer art, and verified ticket links sourced directly from RA.co.
  const mergedResults = [
    ...raResults,
    ...webSearchResults,
    ...ticketmasterResults,
    ...ticketTailorResults,
    ...eventbriteEvents,
  ];

  if (mergedResults.length > 0) {
    return c.json(mergedResults);
  }

  // Fallback: return curated events
  const curated = generateCuratedEvents(locationName, query || undefined);
  return c.json(curated.map(e => ({ ...e, source: "curated" })));
});



// ── Gemini Configuration ──────────────────────────────────────────────────────
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? `https://ofjcnikfebfgopytsgbm.supabase.co`;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function callGemini(messages: object[], jsonMode = true): Promise<string> {
  const body: Record<string, unknown> = { model: "gemini-2.5-flash", messages };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify(body)
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content ?? "";
}

async function getUserIntelligence(userId: string): Promise<Record<string, unknown> | null> {
  if (!SUPABASE_SERVICE_KEY || !userId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_intelligence?id=eq.${userId}&select=*`,
      { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

async function extractAndSaveIntelligence(userId: string, history: { role: string; content: string }[]): Promise<void> {
  if (!SUPABASE_SERVICE_KEY || !userId || history.length < 2) return;
  try {
    const existing = await getUserIntelligence(userId);
    const existingContext = existing?.context_summary ?? "";
    const extractPrompt = `You are a preference extraction engine. Analyse this nightlife concierge conversation and extract signals about the user.
Existing context: ${existingContext}
Conversation: ${history.map(m => `${m.role}: ${m.content}`).join("\n")}
Return ONLY valid JSON: { "favorite_venues": ["venue names mentioned positively"], "music_genres": ["genres"], "preferred_vibes": ["vibe keywords"], "cities": ["cities"], "typical_party_size": null_or_number, "price_tier": null_or_"mid"_or_"high"_or_"ultra", "context_summary": "2-3 sentence natural language memory of who this user is and what they like" }
If nothing new can be inferred for a field, return its existing value or null. Merge with existing context rather than replacing.`;
    const raw = await callGemini([{ role: "user", content: extractPrompt }], true);
    const extracted = JSON.parse(raw);
    const turnCount = ((existing?.turn_count as number) ?? 0) + history.length;
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_intelligence`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "apikey": SUPABASE_SERVICE_KEY,
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({ id: userId, ...extracted, turn_count: turnCount, updated_at: new Date().toISOString() })
      }
    );
  } catch { /* fire-and-forget — never block the main response */ }
}

function buildSystemPrompt(intelligence: Record<string, unknown> | null, location: { lat: number; lng: number } | null): string {
  let prompt = "You are A-List Assist — an elite private nightlife concierge. Your tone is sophisticated, insider, warm but precise. You remember this user's preferences and proactively tailor every response to them.";

  if (intelligence) {
    const parts: string[] = [];
    if (intelligence.context_summary) parts.push(`User memory: ${intelligence.context_summary}`);
    if ((intelligence.favorite_venues as string[])?.length) parts.push(`Favourite venues: ${(intelligence.favorite_venues as string[]).join(", ")}`);
    if ((intelligence.music_genres as string[])?.length) parts.push(`Music taste: ${(intelligence.music_genres as string[]).join(", ")}`);
    if ((intelligence.preferred_vibes as string[])?.length) parts.push(`Preferred vibes: ${(intelligence.preferred_vibes as string[]).join(", ")}`);
    if (intelligence.price_tier) parts.push(`Budget: ${intelligence.price_tier}`);
    if (intelligence.typical_party_size) parts.push(`Typical party size: ${intelligence.typical_party_size}`);
    if ((intelligence.cities as string[])?.length) parts.push(`Cities: ${(intelligence.cities as string[]).join(", ")}`);
    if (parts.length) prompt += `\n\nKNOWN USER PROFILE:\n${parts.join("\n")}`;
    prompt += "\n\nUse this profile to personalise recommendations proactively. Reference specific preferences when relevant — it should feel like they're talking to someone who knows them.";
  }

  if (location) prompt += ` User location: ${location.lat}, ${location.lng}.`;

  prompt += '\n\nYou MUST respond with valid JSON only — no markdown, no extra text. Schema: { "message": "Your conversational response", "tiles": [ { "name": "Venue Name", "type": "Club|Bar|Lounge", "description": "Short vibe description", "imageUrl": "search keywords for unsplash", "priceRange": "$$$", "bookingEnabled": true } ] }. Use empty tiles array if no venue recommendations are relevant.';
  return prompt;
}

// ── Personalised greeting ─────────────────────────────────────────────────────
app.get("/chat/greet", async (c) => {
  if (!GEMINI_API_KEY) {
    return c.json({ message: "Good evening. I'm your A-List Concierge. How may I assist you tonight?" });
  }
  const userId = c.req.query("userId");
  const intelligence = userId ? await getUserIntelligence(userId) : null;
  const systemPrompt = buildSystemPrompt(intelligence, null);
  const hour = new Date().getUTCHours(); // approximate, good enough for greeting
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const greetPrompt = intelligence?.context_summary
    ? `Generate a short, warm, personalised opening greeting for this returning user. Reference something specific about their preferences to show you remember them. It is ${timeOfDay}. Keep it under 30 words. Tone: elite concierge, like they just walked into a private members club.`
    : `Generate a short, sophisticated first-time opening greeting. It is ${timeOfDay}. Introduce yourself as A-List Assist. Keep it under 25 words. Tone: elite nightlife concierge.`;

  try {
    const raw = await callGemini([
      { role: "system", content: systemPrompt },
      { role: "user", content: greetPrompt }
    ], true);
    const parsed = JSON.parse(raw);
    return c.json({ message: parsed.message || raw });
  } catch {
    return c.json({ message: `Good ${timeOfDay}. I'm A-List Assist — your private concierge. What are we doing tonight?` });
  }
});

// ── Main chat ─────────────────────────────────────────────────────────────────
app.post("/chat", async (c) => {
  if (!GEMINI_API_KEY) {
    return c.json({
      message: "A-List Assist is standing by. Configure GEMINI_API_KEY in edge function secrets to activate full intelligence.",
      tiles: []
    });
  }

  try {
    const { message, conversationHistory, location, userId } = await c.req.json();

    // Fetch user intelligence (non-blocking if unavailable)
    const intelligence = userId ? await getUserIntelligence(userId) : null;
    const systemPrompt = buildSystemPrompt(intelligence, location);

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    const raw = await callGemini(messages, true);
    let parsedContent;
    try {
      parsedContent = JSON.parse(raw);
    } catch {
      parsedContent = { message: raw || "Concierge is calibrating. Try again shortly.", tiles: [] };
    }

    // Fire-and-forget: extract preferences from this conversation turn
    if (userId) {
      const fullHistory = [
        ...(conversationHistory || []),
        { role: "user", content: message },
        { role: "assistant", content: parsedContent.message }
      ];
      extractAndSaveIntelligence(userId, fullHistory);
    }

    return c.json(parsedContent);
  } catch (error) {
    console.error("Gemini chat error:", error);
    return c.json({ message: "I'm momentarily offline. Try again in a few seconds.", tiles: [] }, 200);
  }
});

// ── SoundCloud OAuth ─────────────────────────────────────────────────────────

/** GET /soundcloud/login — initiate OAuth authorization flow */
app.get("/soundcloud/login", (c) => {
  const userId = c.req.query("userId") || "default_user";

  if (!SOUNDCLOUD_CLIENT_ID) {
    return c.json({ error: "SoundCloud Client ID not configured" }, 500);
  }

  const authUrl =
    `https://secure.soundcloud.com/connect` +
    `?client_id=${SOUNDCLOUD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(SOUNDCLOUD_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=non-expiring` +
    `&state=${encodeURIComponent(`soundcloud:${userId}`)}`;

  return c.json({ authUrl });
});

/** GET /soundcloud/callback — exchange authorization code for access token */
app.get("/soundcloud/callback", async (c) => {
  const code     = c.req.query("code");
  const rawState = c.req.query("state"); // "soundcloud:userId"
  const error    = c.req.query("error");

  if (error) {
    return c.json({ error: `SoundCloud authorization failed: ${error}` }, 400);
  }
  if (!code || !rawState) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  const state  = rawState; // keep for kv key
  const userId = rawState.startsWith("soundcloud:") ? rawState.slice(11) : rawState;

  const clientId     = SOUNDCLOUD_CLIENT_ID;
  const clientSecret = Deno.env.get("SOUNDCLOUD_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return c.json({ error: "SoundCloud credentials not configured" }, 500);
  }

  try {
    const tokenRes = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json; charset=utf-8" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  SOUNDCLOUD_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error(`[SoundCloud] Token error ${tokenRes.status}: ${body}`);
      return c.json({ error: "Failed to exchange code for token" }, 500);
    }

    const tokenData = await tokenRes.json() as {
      access_token:  string;
      refresh_token?: string;
      expires_in?:   number;
      scope?:        string;
      token_type:    string;
    };

    // Fetch basic profile info
    const meRes = await fetch("https://api.soundcloud.com/me", {
      headers: { "Authorization": `OAuth ${tokenData.access_token}`, "Accept": "application/json; charset=utf-8" },
    });
    const me = meRes.ok ? await meRes.json() as { id: number; username: string; permalink: string; avatar_url?: string } : null;

    await kv.set(`soundcloud_token_${userId}`, {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at:    tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
      sc_user_id:    me?.id ?? null,
      username:      me?.username ?? null,
      avatar_url:    me?.avatar_url ?? null,
    });

    return c.json({ success: true, userId, username: me?.username, avatar_url: me?.avatar_url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SoundCloud] Callback error: ${msg}`);
    return c.json({ error: msg }, 500);
  }
});

/** GET /soundcloud/tracks — return the user's recent liked / uploaded tracks */
app.get("/soundcloud/tracks", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const limit  = Math.min(Number(c.req.query("limit") || "20"), 50);

  const stored = await kv.get(`soundcloud_token_${userId}`) as {
    access_token: string;
    expires_at:   number | null;
    username?:    string;
    avatar_url?:  string;
  } | null;

  if (!stored?.access_token) {
    return c.json({ connected: false, data: [] });
  }

  // Check token expiry (SoundCloud non-expiring tokens have no expiry, so null is OK)
  if (stored.expires_at !== null && stored.expires_at < Date.now()) {
    return c.json({ connected: false, expired: true, data: [] });
  }

  try {
    // Fetch the user's own tracks
    const tracksRes = await fetch(
      `https://api.soundcloud.com/me/tracks?limit=${limit}`,
      { headers: { "Authorization": `OAuth ${stored.access_token}`, "Accept": "application/json; charset=utf-8" } }
    );

    if (!tracksRes.ok) {
      const body = await tracksRes.text();
      console.error(`[SoundCloud] Tracks fetch error ${tracksRes.status}: ${body}`);
      return c.json({ connected: true, data: [], error: "Failed to fetch tracks" });
    }

    interface SCTrack {
      id: number;
      title: string;
      permalink_url: string;
      stream_url?: string;
      artwork_url?: string;
      duration: number;
      playback_count?: number;
      likes_count?: number;
      genre?: string;
      created_at?: string;
    }

    const tracks = await tracksRes.json() as SCTrack[];

    return c.json({
      connected:  true,
      username:   stored.username,
      avatar_url: stored.avatar_url,
      data: tracks.map((t) => ({
        id:             String(t.id),
        title:          t.title,
        permalink_url:  t.permalink_url,
        stream_url:     t.stream_url ?? null,
        artwork_url:    t.artwork_url?.replace("-large", "-t500x500") ?? null,
        duration_ms:    t.duration,
        plays:          t.playback_count ?? 0,
        likes:          t.likes_count ?? 0,
        genre:          t.genre ?? null,
        created_at:     t.created_at ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SoundCloud] Tracks error: ${msg}`);
    return c.json({ connected: true, data: [], error: msg });
  }
});

/** GET /soundcloud/status — check connection status */
app.get("/soundcloud/status", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const stored = await kv.get(`soundcloud_token_${userId}`) as {
    access_token: string;
    expires_at:   number | null;
    username?:    string;
  } | null;

  if (!stored?.access_token) return c.json({ connected: false });
  if (stored.expires_at !== null && stored.expires_at < Date.now()) return c.json({ connected: false, expired: true });
  return c.json({ connected: true, username: stored.username });
});

/** DELETE /soundcloud/disconnect — remove stored token */
app.delete("/soundcloud/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    await kv.del(`soundcloud_token_${userId}`);
    return c.json({ success: true });
  } catch (err) {
    console.error(`[SoundCloud] Disconnect error: ${err}`);
    return c.json({ success: false, error: "Failed to disconnect" }, 500);
  }
});

// ── Profile: GET + PUT (KV-backed) ───────────────────────────────────────────
const DEFAULT_PROFILE = {
  name: 'Alex Rivera',
  username: '@member',
  tier: 'Platinum',
  points: 8450,
  memberSince: 'January 2025',
  stats: { sessions: 47, hostScore: 9.2, socialScore: 84, totalSpend: 24500 },
  achievements: [
    { name: 'First Table Booking', date: 'Jan 2025', earned: true },
    { name: '10 Nights Out', date: 'Mar 2025', earned: true },
    { name: 'Crew Captain', date: 'May 2025', earned: true },
    { name: '$10K Verified Spend', date: 'Aug 2025', earned: true }
  ],
  personalDetails: {
    fullName: 'Alexander Rivera',
    email: 'alex@example.com',
    phone: '+1 (305) ****-**42',
    location: 'Miami, FL'
  }
};

app.get("/profile", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const saved = await kv.get(`profile:${userId}`);
    return c.json(saved ?? DEFAULT_PROFILE);
  } catch (_e) {
    return c.json(DEFAULT_PROFILE);
  }
});

app.put("/profile", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const updates = await c.req.json();
    const existing = ((await kv.get(`profile:${userId}`)) ?? DEFAULT_PROFILE) as typeof DEFAULT_PROFILE;
    const merged = { ...existing, ...updates };
    await kv.set(`profile:${userId}`, merged);
    return c.json(merged);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Social Profile: unified read of all connected social accounts ─────────────
// Returns connection status + profile data for Spotify, SoundCloud, Instagram.
// Used by the frontend profile page to auto-populate name/avatar from social login.
app.get("/social/profile", async (c) => {
  const userId = c.req.query("userId") || "default_user";

  const [spotifyRaw, soundcloudRaw, instagramRaw] = await Promise.all([
    kv.get(`spotify_token_${userId}`),
    kv.get(`soundcloud_token_${userId}`),
    kv.get(`instagram_token_${userId}`),
  ]);

  const spotify = spotifyRaw as {
    access_token: string; refresh_token?: string;
    expires_at: number; scope?: string;
    display_name?: string; avatar_url?: string;
  } | null;
  const soundcloud = soundcloudRaw as {
    access_token: string; expires_at: number | null;
    sc_user_id?: number; username?: string; avatar_url?: string;
  } | null;
  const instagram = instagramRaw as {
    access_token: string; expires_at: number;
    instagram_user_id?: number; username?: string;
  } | null;

  // Spotify: fetch /me live if token is valid (we may not have cached profile data)
  let spotifyProfile: { display_name?: string; avatar_url?: string; followers?: number; id?: string } | null = null;
  const spotifyConnected = !!spotify?.access_token && spotify.expires_at > Date.now();
  if (spotifyConnected) {
    try {
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { "Authorization": `Bearer ${spotify!.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json() as {
          display_name?: string; images?: { url: string }[];
          followers?: { total: number }; id?: string;
        };
        spotifyProfile = {
          display_name: me.display_name || undefined,
          avatar_url: me.images?.[0]?.url || undefined,
          followers: me.followers?.total,
          id: me.id,
        };
        // Cache in KV for next time
        await kv.set(`spotify_token_${userId}`, {
          ...spotify,
          display_name: spotifyProfile.display_name,
          avatar_url: spotifyProfile.avatar_url,
        });
      }
    } catch (_e) { /* silent */ }
  }

  const soundcloudConnected = !!soundcloud?.access_token &&
    (soundcloud.expires_at === null || soundcloud.expires_at > Date.now());
  const instagramConnected = !!instagram?.access_token && instagram.expires_at > Date.now();

  return c.json({
    spotify: {
      connected: spotifyConnected,
      display_name: spotifyProfile?.display_name || spotify?.display_name || null,
      avatar_url: spotifyProfile?.avatar_url || spotify?.avatar_url || null,
      followers: spotifyProfile?.followers ?? null,
      id: spotifyProfile?.id || null,
    },
    soundcloud: {
      connected: soundcloudConnected,
      username: soundcloud?.username || null,
      avatar_url: soundcloud?.avatar_url || null,
      sc_user_id: soundcloud?.sc_user_id || null,
    },
    instagram: {
      connected: instagramConnected,
      username: instagram?.username || null,
      days_until_expiry: instagramConnected
        ? Math.floor((instagram!.expires_at - Date.now()) / 86_400_000)
        : null,
    },
  });
});

// ── Invites: GET / POST / PATCH ───────────────────────────────────────────────
const DEFAULT_INVITES = {
  incoming: [
    { id: 1, from: { name: 'Sarah Chen', tier: 'Gold Elite', avatar: 'SC' }, venue: 'LIV Miami', date: 'Tonight, 11:30 PM', tableType: 'VIP Main Floor', costPerPerson: 250, totalPeople: 6, currentPeople: 4, message: 'Martin Garrix tonight! Need 2 more people', time: '2h ago', unread: true, status: 'pending' },
    { id: 2, from: { name: 'Marcus Liu', tier: 'Platinum VIP', avatar: 'ML' }, venue: 'E11EVEN Miami', date: 'Saturday, 12:00 AM', tableType: 'Skybox Premium', costPerPerson: 350, totalPeople: 8, currentPeople: 6, message: 'Birthday celebration! Premium table with bottle service', time: '5h ago', unread: true, status: 'pending' }
  ],
  sent: [
    { id: 4, to: [{ name: 'Alex Kim', avatar: 'AK' }, { name: 'Sam Rodriguez', avatar: 'SR' }, { name: 'Emma Wilson', avatar: 'EW' }], venue: 'LIV Miami', date: 'Next Friday, 11:00 PM', tableType: 'Private Booth', costPerPerson: 200, totalPeople: 6, currentPeople: 4, message: 'Pre-birthday celebrations!', time: '1d ago', status: 'pending' }
  ]
};

app.get("/invites", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const saved = await kv.get(`invites:${userId}`);
    return c.json(saved ?? DEFAULT_INVITES);
  } catch (_e) {
    return c.json(DEFAULT_INVITES);
  }
});

// PATCH /invites — update status of a single invite (accept/decline)
app.patch("/invites", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const { id, status } = await c.req.json(); // status: 'accepted' | 'declined'
    const data = ((await kv.get(`invites:${userId}`)) ?? DEFAULT_INVITES) as typeof DEFAULT_INVITES;
    data.incoming = data.incoming.map((inv) =>
      inv.id === id ? { ...inv, status, unread: false } : inv
    );
    await kv.set(`invites:${userId}`, data);
    return c.json(data);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// POST /invites — create a new outgoing invite
app.post("/invites", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const invite = await c.req.json();
    const data = ((await kv.get(`invites:${userId}`)) ?? DEFAULT_INVITES) as typeof DEFAULT_INVITES;
    invite.id = Date.now();
    invite.time = "Just now";
    invite.status = "pending";
    data.sent.unshift(invite);
    await kv.set(`invites:${userId}`, data);
    return c.json(data);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Crews: GET / POST / DELETE ────────────────────────────────────────────────
const DEFAULT_CREWS = [
  { id: 1, name: 'NOCTURNAL ELITE', emoji: '🌙', level: 'Platinum', members: [{ name: 'Alex R.', avatar: 'AR', role: 'Captain', spend: 8200 }, { name: 'Maya S.', avatar: 'MS', role: 'Member', spend: 6100 }, { name: 'Kai T.', avatar: 'KT', role: 'Member', spend: 4800 }, { name: 'Zoe L.', avatar: 'ZL', role: 'Member', spend: 3900 }], totalSpend: 23000, nightsOut: 47, nextLevel: { name: 'Diamond', spend: 50000 }, perks: ['Priority Booking', 'Table Upgrades', 'Complimentary Bottles', 'Artist Meetup'] },
  { id: 2, name: 'THE ARCHITECTS', emoji: '🏛️', level: 'Gold', members: [{ name: 'James B.', avatar: 'JB', role: 'Captain', spend: 5200 }, { name: 'Nina K.', avatar: 'NK', role: 'Member', spend: 3800 }], totalSpend: 9000, nightsOut: 22, nextLevel: { name: 'Platinum', spend: 15000 }, perks: ['Group Discounts', 'Late Entry'] }
];

const DEFAULT_LEADERBOARD = [
  { rank: 1, name: 'Crystal Syndicate', spend: 89400, nights: 124, avatar: '💎' },
  { rank: 2, name: 'Nocturnal Elite', spend: 23000, nights: 47, avatar: '🌙' },
  { rank: 3, name: 'Gold Collective', spend: 18700, nights: 38, avatar: '👑' },
  { rank: 4, name: 'Shadow Council', spend: 12300, nights: 29, avatar: '🖤' },
  { rank: 5, name: 'The Architects', spend: 9000, nights: 22, avatar: '🏛️' }
];

/** Compute crew level + nextLevel based on totalSpend */
function computeCrewLevel(totalSpend: number): { level: string; nextLevel: { name: string; spend: number } | null } {
  const tiers = [
    { name: 'Bronze',   min: 0 },
    { name: 'Silver',   min: 5000 },
    { name: 'Gold',     min: 10000 },
    { name: 'Platinum', min: 15000 },
    { name: 'Diamond',  min: 50000 },
  ];
  let current = tiers[0];
  for (const tier of tiers) {
    if (totalSpend >= tier.min) current = tier;
  }
  const nextIdx = tiers.findIndex(t => t.name === current.name) + 1;
  const next = nextIdx < tiers.length ? { name: tiers[nextIdx].name, spend: tiers[nextIdx].min } : null;
  return { level: current.name, nextLevel: next };
}

app.get("/crews", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const saved = await kv.get(`crews:${userId}`);
    const leaderboard = (await kv.get("crews:leaderboard")) ?? DEFAULT_LEADERBOARD;
    return c.json({ crews: saved ?? DEFAULT_CREWS, leaderboard });
  } catch (_e) {
    return c.json({ crews: DEFAULT_CREWS, leaderboard: DEFAULT_LEADERBOARD });
  }
});

app.post("/crews", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const newCrew = await c.req.json();
    const existing = ((await kv.get(`crews:${userId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const { level, nextLevel } = computeCrewLevel(0);
    newCrew.id = Date.now();
    newCrew.members = [{ name: 'You', avatar: 'ME', role: 'Captain', spend: 0 }];
    newCrew.totalSpend = 0;
    newCrew.nightsOut = 0;
    newCrew.level = level;
    newCrew.nextLevel = nextLevel;
    newCrew.perks = ['Group Booking'];
    const updated = [newCrew, ...existing];
    await kv.set(`crews:${userId}`, updated);
    return c.json({ crews: updated });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.delete("/crews/:id", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const id = Number(c.req.param("id"));
  try {
    const existing = ((await kv.get(`crews:${userId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const updated = existing.filter((cr) => cr.id !== id);
    await kv.set(`crews:${userId}`, updated);
    return c.json({ crews: updated });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** POST /crews/:id/invite — add a member to a crew by name */
app.post("/crews/:id/invite", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const crewId = Number(c.req.param("id"));
  try {
    const { name } = await c.req.json() as { name: string };
    if (!name?.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    const existing = ((await kv.get(`crews:${userId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const updatedCrews = existing.map((cr) => {
      if (cr.id !== crewId) return cr;
      // Derive initials from name (up to 2 chars)
      const initials = name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
      const newMember = { name: name.trim(), avatar: initials, role: 'Member', spend: 0 };
      const members = [...(cr.members || []), newMember];
      return { ...cr, members };
    });
    await kv.set(`crews:${userId}`, updatedCrews);
    const updatedCrew = updatedCrews.find(cr => cr.id === crewId);
    return c.json({ crew: updatedCrew, crews: updatedCrews });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** DELETE /crews/:id/member/:idx — remove a member from a crew by index */
app.delete("/crews/:id/member/:idx", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const crewId = Number(c.req.param("id"));
  const memberIdx = Number(c.req.param("idx"));
  try {
    const existing = ((await kv.get(`crews:${userId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const updatedCrews = existing.map((cr) => {
      if (cr.id !== crewId) return cr;
      // Never remove the Captain (index 0)
      if (memberIdx === 0) return cr;
      const members = cr.members.filter((_: unknown, i: number) => i !== memberIdx);
      return { ...cr, members };
    });
    await kv.set(`crews:${userId}`, updatedCrews);
    const updatedCrew = updatedCrews.find(cr => cr.id === crewId);
    return c.json({ crew: updatedCrew, crews: updatedCrews });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** POST /crews/:id/invite-link — generate a short-lived shareable join token */
app.post("/crews/:id/invite-link", async (c) => {
  const ownerUserId = c.req.query("userId") || "default_user";
  const crewId = Number(c.req.param("id"));
  try {
    const existing = ((await kv.get(`crews:${ownerUserId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const crew = existing.find((cr) => cr.id === crewId);
    if (!crew) {
      return c.json({ error: "Crew not found" }, 404);
    }
    // Generate a random 10-char alphanumeric token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(7)))
      .map((b) => (b % 36).toString(36))
      .join("");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await kv.set(`crew_invite:${token}`, {
      token,
      crewId,
      ownerUserId,
      crewName: crew.name,
      crewEmoji: crew.emoji,
      crewLevel: crew.level,
      memberCount: crew.members?.length ?? 1,
      expiresAt,
    });
    return c.json({ token, expiresAt });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** GET /crews/preview/:token — return crew info for the join screen (no auth required) */
app.get("/crews/preview/:token", async (c) => {
  const token = c.req.param("token");
  try {
    const invite = await kv.get(`crew_invite:${token}`) as Record<string, unknown> | null;
    if (!invite) {
      return c.json({ error: "Invite not found or already used" }, 404);
    }
    if (typeof invite.expiresAt === "number" && invite.expiresAt < Date.now()) {
      await kv.del(`crew_invite:${token}`);
      return c.json({ error: "Invite link has expired" }, 410);
    }
    return c.json({
      crewName: invite.crewName,
      crewEmoji: invite.crewEmoji,
      crewLevel: invite.crewLevel,
      memberCount: invite.memberCount,
      expiresAt: invite.expiresAt,
    });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** POST /crews/join — redeem an invite token; adds joiner to the crew */
app.post("/crews/join", async (c) => {
  try {
    const { token, joinerName, joinerUserId } = await c.req.json() as {
      token: string;
      joinerName: string;
      joinerUserId?: string;
    };
    if (!token || !joinerName?.trim()) {
      return c.json({ error: "token and joinerName are required" }, 400);
    }
    const invite = await kv.get(`crew_invite:${token}`) as Record<string, unknown> | null;
    if (!invite) {
      return c.json({ error: "Invite not found or already used" }, 404);
    }
    if (typeof invite.expiresAt === "number" && invite.expiresAt < Date.now()) {
      await kv.del(`crew_invite:${token}`);
      return c.json({ error: "Invite link has expired" }, 410);
    }
    const { crewId, ownerUserId } = invite as { crewId: number; ownerUserId: string };

    // Add joiner to the owner's crew roster
    const existing = ((await kv.get(`crews:${ownerUserId}`)) ?? DEFAULT_CREWS) as typeof DEFAULT_CREWS;
    const initials = joinerName.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
    const updatedCrews = existing.map((cr) => {
      if (cr.id !== crewId) return cr;
      const newMember = { name: joinerName.trim(), avatar: initials, role: "Member", spend: 0 };
      return { ...cr, members: [...(cr.members || []), newMember] };
    });
    await kv.set(`crews:${ownerUserId}`, updatedCrews);

    // If the joiner has their own userId, also add a reference crew on their side
    if (joinerUserId && joinerUserId !== ownerUserId) {
      const joinerCrews = ((await kv.get(`crews:${joinerUserId}`)) ?? []) as typeof DEFAULT_CREWS;
      const joinedCrew = updatedCrews.find((cr) => cr.id === crewId);
      if (joinedCrew && !joinerCrews.some((c) => c.id === crewId)) {
        await kv.set(`crews:${joinerUserId}`, [joinedCrew, ...joinerCrews]);
      }
    }

    // Consume the invite token (single-use)
    await kv.del(`crew_invite:${token}`);

    const joinedCrew = updatedCrews.find((cr) => cr.id === crewId);
    return c.json({ success: true, crew: joinedCrew });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Group Bookings ────────────────────────────────────────────────────────────

interface BookingMember {
  name: string;
  avatar: string;
  role: string;
  amount: number;
  paymentRail?: string;
  paymentHandle?: string;
  paid?: boolean;
}

interface Booking {
  id: number;
  userId: string;
  crewId?: number;
  crewName?: string;
  venue: string;
  tableName: string;
  tableMin: number;
  liquorPackage: { name: string; price: number; bottles: number };
  mixerPackage: { name: string; price: number };
  splitMethod: string;
  totalCost: number;
  members: BookingMember[];
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: number;
}

/** GET /bookings — list user's bookings */
app.get("/bookings", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const bookings = ((await kv.get(`bookings:${userId}`)) ?? []) as Booking[];
    return c.json({ bookings });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** POST /bookings — create a new group booking */
app.post("/bookings", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    const body = await c.req.json() as Omit<Booking, 'id' | 'userId' | 'createdAt' | 'status'>;
    const existing = ((await kv.get(`bookings:${userId}`)) ?? []) as Booking[];
    const booking: Booking = {
      ...body,
      id: Date.now(),
      userId,
      status: 'pending',
      createdAt: Date.now(),
    };
    const updated = [booking, ...existing];
    await kv.set(`bookings:${userId}`, updated);

    // Update crew totalSpend if a crewId was provided
    if (body.crewId) {
      const crews = ((await kv.get(`crews:${userId}`)) ?? []) as typeof DEFAULT_CREWS;
      const updatedCrews = crews.map((cr) => {
        if (cr.id !== body.crewId) return cr;
        const newSpend = (cr.totalSpend || 0) + body.totalCost;
        const newNights = (cr.nightsOut || 0) + 1;
        const { level, nextLevel } = computeCrewLevel(newSpend);
        // Also update each member's spend based on their split amount
        const updatedMembers = (cr.members || []).map((m: { name: string; spend: number }) => {
          const split = body.members.find((bm: BookingMember) => bm.name === m.name);
          return split ? { ...m, spend: (m.spend || 0) + split.amount } : m;
        });
        return { ...cr, totalSpend: newSpend, nightsOut: newNights, level, nextLevel, members: updatedMembers };
      });
      await kv.set(`crews:${userId}`, updatedCrews);
    }

    return c.json({ booking, bookings: updated });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** PATCH /bookings/:id — mark a member as paid or update status */
app.patch("/bookings/:id", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const bookingId = Number(c.req.param("id"));
  try {
    const { memberName, paid, status } = await c.req.json() as { memberName?: string; paid?: boolean; status?: string };
    const existing = ((await kv.get(`bookings:${userId}`)) ?? []) as Booking[];
    const updated = existing.map((b) => {
      if (b.id !== bookingId) return b;
      if (memberName !== undefined && paid !== undefined) {
        const members = b.members.map((m) => m.name === memberName ? { ...m, paid } : m);
        const allPaid = members.every((m) => m.paid || m.role === 'host');
        return { ...b, members, status: allPaid ? 'confirmed' : b.status };
      }
      if (status) return { ...b, status: status as Booking['status'] };
      return b;
    });
    await kv.set(`bookings:${userId}`, updated);
    return c.json({ booking: updated.find((b) => b.id === bookingId) });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Instagram Graph API (OAuth with Instagram Login) ─────────────────────────
// Uses the new Instagram API with Instagram Login (replaces deprecated Basic Display API).
// Requires a Meta app with "instagram_business_basic" permission and a
// Business or Creator Instagram account.

/** GET /instagram/login — initiate OAuth flow */
app.get("/instagram/login", (c) => {
  const userId = c.req.query("userId") || "default_user";

  if (!INSTAGRAM_CLIENT_ID) {
    return c.json({ error: "INSTAGRAM_CLIENT_ID not configured" }, 500);
  }

  const scope = "instagram_business_basic,instagram_business_manage_messages";
  const authUrl =
    `https://api.instagram.com/oauth/authorize` +
    `?client_id=${INSTAGRAM_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(INSTAGRAM_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(`instagram:${userId}`)}`;

  return c.json({ authUrl });
});

/** GET /instagram/callback — exchange code for short-lived token, then long-lived token */
app.get("/instagram/callback", async (c) => {
  const code     = c.req.query("code");
  const rawState = c.req.query("state"); // "instagram:userId"
  const error    = c.req.query("error");

  if (error) {
    return c.json({ error: `Instagram authorization failed: ${error}` }, 400);
  }
  if (!code || !rawState) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const state  = rawState; // keep for any fallback
  const userId = rawState.startsWith("instagram:") ? rawState.slice(10) : rawState;
  if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
    return c.json({ error: "Instagram credentials not configured" }, 500);
  }

  try {
    // Step 1: Exchange authorization code for a short-lived access token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_CLIENT_ID,
        client_secret: INSTAGRAM_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: INSTAGRAM_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error(`[Instagram] Short-lived token error ${tokenRes.status}: ${body}`);
      return c.json({ error: "Failed to exchange code for token" }, 500);
    }

    const shortToken = await tokenRes.json() as {
      access_token: string;
      user_id: number;
    };

    // Step 2: Exchange short-lived token for a long-lived token (60-day)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${INSTAGRAM_CLIENT_SECRET}` +
      `&access_token=${shortToken.access_token}`
    );

    if (!longRes.ok) {
      const body = await longRes.text();
      console.error(`[Instagram] Long-lived token error ${longRes.status}: ${body}`);
      return c.json({ error: "Failed to exchange for long-lived token" }, 500);
    }

    const longToken = await longRes.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    // Step 3: Fetch the user's Instagram profile
    const profileRes = await fetch(
      `https://graph.instagram.com/v21.0/me` +
      `?fields=id,username,account_type,media_count` +
      `&access_token=${longToken.access_token}`
    );
    const profile = profileRes.ok ? await profileRes.json() : {};

    // Persist in KV
    await kv.set(`instagram_token_${userId}`, {
      access_token: longToken.access_token,
      expires_at: Date.now() + longToken.expires_in * 1000,
      instagram_user_id: shortToken.user_id,
      username: (profile as { username?: string }).username || null,
    });

    return c.json({ success: true, userId, profile });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Instagram] Callback error: ${msg}`);
    return c.json({ error: msg }, 500);
  }
});

interface InstagramMediaItem {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

/** GET /instagram/media — fetch user's media (IMAGE/VIDEO) */
app.get("/instagram/media", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const limit = Math.min(Number(c.req.query("limit") || "12"), 50);

  const stored = await kv.get(`instagram_token_${userId}`) as {
    access_token: string;
    expires_at: number;
    username?: string;
  } | null;

  if (!stored?.access_token) {
    return c.json({ connected: false, data: [] });
  }

  // Warn if token is close to expiry (< 7 days)
  const daysLeft = (stored.expires_at - Date.now()) / 86_400_000;
  if (daysLeft < 0) {
    return c.json({ connected: false, expired: true, data: [] });
  }

  try {
    const mediaRes = await fetch(
      `https://graph.instagram.com/v21.0/me/media` +
      `?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp` +
      `&limit=${limit}` +
      `&access_token=${stored.access_token}`
    );

    if (!mediaRes.ok) {
      const body = await mediaRes.text();
      console.error(`[Instagram] Media fetch error ${mediaRes.status}: ${body}`);
      return c.json({ connected: true, data: [], error: "Failed to fetch media" });
    }

    const json = await mediaRes.json() as { data: InstagramMediaItem[] };

    // Only return IMAGE and VIDEO (exclude CAROUSEL_ALBUM children)
    const media = (json.data || []).filter(
      (item) => item.media_type === "IMAGE" || item.media_type === "VIDEO"
    );

    return c.json({
      connected: true,
      username: stored.username,
      token_expires_days: Math.floor(daysLeft),
      data: media,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Instagram] Media error: ${msg}`);
    return c.json({ connected: true, data: [], error: msg });
  }
});

/** GET /instagram/status — check connection status without fetching media */
app.get("/instagram/status", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const stored = await kv.get(`instagram_token_${userId}`) as {
    access_token: string;
    expires_at: number;
    username?: string;
  } | null;

  if (!stored?.access_token) return c.json({ connected: false });
  const daysLeft = Math.floor((stored.expires_at - Date.now()) / 86_400_000);
  if (daysLeft < 0) return c.json({ connected: false, expired: true });
  return c.json({ connected: true, username: stored.username, token_expires_days: daysLeft });
});

/** DELETE /instagram/disconnect — revoke & remove token */
app.delete("/instagram/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    await kv.del(`instagram_token_${userId}`);
    return c.json({ success: true });
  } catch (err) {
    console.error(`[Instagram] Disconnect error: ${err}`);
    return c.json({ success: false, error: "Failed to disconnect" }, 500);
  }
});

// ── Club registry: maps club name patterns → scrape config ──────────────────
interface ClubScrapeConfig {
  eventsUrl: string;
  portalBase: string;
  parser: "parkhouse_webflow" | "portal_only" | "crescent_club_html";
}

const CLUB_REGISTRY: Array<{ match: string; config: ClubScrapeConfig }> = [
  {
    match: "park house houston",
    config: {
      eventsUrl: "https://parkhousehouston.com/member-events",
      portalBase: "https://member.houston.parkhouse.com/",
      parser: "parkhouse_webflow",
    },
  },
  {
    match: "park house dallas",
    config: {
      eventsUrl: "https://www.parkhousedallas.com/member-events",
      portalBase: "https://member.dallas.parkhouse.com/",
      parser: "parkhouse_webflow",
    },
  },
  {
    match: "park house",
    config: {
      eventsUrl: "https://parkhousehouston.com/member-events",
      portalBase: "https://member.houston.parkhouse.com/",
      parser: "parkhouse_webflow",
    },
  },
  {
    match: "crescent club",
    config: {
      eventsUrl: "https://crescentclubandspa.com/events-original/",
      portalBase: "https://crescentclubandspa.com/events-original/",
      parser: "crescent_club_html",
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
interface ScrapedEvent {
  id: string;
  title: string;
  description: string;
  rawDate: string;        // short display like "Feb 20"
  isoDate?: string;       // full ISO date like "2026-02-20" when available
  portalUrl: string;
  type: string;
  isSoldOut?: boolean;
}

function classifyEventType(description: string): string {
  if (/wine|champagne|bourbon|whiskey|cocktail|spirits|tasting/i.test(description)) return "Cocktails";
  if (/dinner|lunch|brunch|caviar|culinary|omakase|chef|menu/i.test(description)) return "Dining";
  if (/music|jazz|band|concert|dj|dance|velvet room|dancefloor|luke|kelly clarkson/i.test(description)) return "Music";
  if (/art|gallery|exhibit|museum|panel|artist/i.test(description)) return "Culture";
  if (/yoga|wellness|skin|beauty|workout|fitness|meditat/i.test(description)) return "Wellness";
  if (/poker|bingo|quiz|trivia|game|mahjong|darty/i.test(description)) return "Entertainment";
  if (/mixer|network|member.*mix|founder|book.*sign|author|talk/i.test(description)) return "Networking";
  return "Culture";
}

function _deriveTitle(description: string): string {
  const first = description.split(/[.!?]/)[0].trim();
  if (first.length > 0 && first.length <= 70) return first;
  return description.slice(0, 67).trimEnd() + "…";
}

// Park House Webflow CMS structure (confirmed from live HTML):
// Each event is a .w-dyn-item block containing:
//   <h3 data-event-date="February 20, 2026" class="h3 social">Feb 20</h3>
//   <div class="h4-events event-name">EVENT NAME</div>
//   <div class="h4-events sold-out [w-condition-invisible]"> - Sold out!</div>  ← optional
//   <p class="p b_social">Short description / seating info</p>
//   <a href=".../page/login?m=Y">View Event</a>  ← login-gated, not a direct portal link
//
// We parse each item using the data-event-date anchor, extracting name + description.
function parseParkhouseWebflow(html: string, portalBase: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  // Split on each w-dyn-item boundary to isolate individual event blocks
  // Each item starts with the role="listitem" class="item_perks w-dyn-item" div
  const itemRe = /role="listitem"[^>]+w-dyn-item[^>]*>(.*?)(?=role="listitem"|<footer|<\/ul|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section)/gis;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRe.exec(html)) !== null) {
    const block = itemMatch[1];

    // 1. Extract the full date from data-event-date
    const dateAttrMatch = /data-event-date="([^"]+)"/i.exec(block);
    if (!dateAttrMatch) continue;
    const fullDate = dateAttrMatch[1]; // e.g. "February 20, 2026"

    // Parse to a display rawDate like "Feb 20"
    const parsedDate = new Date(fullDate);
    if (isNaN(parsedDate.getTime())) continue;
    const shortMonth = parsedDate.toLocaleDateString("en-US", { month: "short" });
    const day = parsedDate.getDate();
    const rawDate = `${shortMonth} ${day}`;

    // 2. Extract event name — Houston uses 'h4-events event-name', Dallas uses 'h4 event-name'
    const nameMatch =
      /class="h4-events event-name"[^>]*>([^<]+)</i.exec(block) ||
      /class="h4 event-name"[^>]*>([^<]+)</i.exec(block);
    const eventName = nameMatch ? nameMatch[1].trim() : "";
    if (!eventName) continue;

    // 3. Sold-out: div is visible (NOT w-condition-invisible) — handles both class prefixes
    const soldOutMatch =
      /class="h4-events sold-out(?!.*w-condition-invisible)[^"]*"/.test(block) ||
      /class="h4 sold-out(?!.*w-condition-invisible)[^"]*"/.test(block);

    // 4. Description from <p class="p b_social">
    const descMatch = /<p[^>]*class="p b_social"[^>]*>([^<]+)<\/p>/i.exec(block);
    const shortDesc = descMatch ? descMatch[1].trim() : "";

    // 5. Combine name + desc
    const titleStr = eventName;
    const descStr = shortDesc && shortDesc.toLowerCase() !== eventName.toLowerCase()
      ? `${eventName} — ${shortDesc}`
      : eventName;

    // 6. Portal URL — Dallas has real UUID deep-links; Houston redirects to login
    const portalLinkMatch = /href="(https:\/\/member\.[^"]*parkhouse\.com\/event\/[^"]+)"/i.exec(block);
    const portalUrl = portalLinkMatch ? portalLinkMatch[1] : portalBase + "events";

    // Use full ISO date string as stable ID
    const id = `ph_${parsedDate.toISOString().slice(0, 10)}_${titleStr.replace(/\s+/g, "_").toLowerCase().slice(0, 20)}`;

    events.push({
      id,
      title: titleStr,
      description: descStr,
      rawDate,
      isoDate: parsedDate.toISOString().slice(0, 10), // e.g. "2026-02-20"
      isSoldOut: soldOutMatch,
      portalUrl,
      type: classifyEventType(descStr),
    });
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return events.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// ── Crescent Club HTML parser ─────────────────────────────────────────────────
// CONFIRMED page structure (from browser inspection of /events-original/):
//
// LISTING SECTION (.event div):
//   <h3>09/21</h3>             ← date (first h3)
//   <h3>EVENT TITLE</h3>       ← event name (second h3, what we want!)
//   <p>400 Crescent Court…</p> ← address
//   <h4>6:00 PM</h4>           ← time only (no date)
//   <a href="#event-modal-NNN" class="btn …">RSVP</a>
//
// MODAL SECTION (#event-modal-NNN):
//   <h4>EVENT TITLE</h4>       ← title (h4, confirmed!)
//   <h5>09/21 6:00 PM</h5>     ← date+time (h5, confirmed!)
//   <h3>Reserve your spot</h3> ← RSVP form heading — DO NOT use as title
function parseCrescentClubHtml(html: string, portalBase: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  // ── Strategy A: scan the LISTING section ─────────────────────────────────
  // Each event block in the listing is bounded by the RSVP anchor.
  // We read backward from each <a href="#event-modal-NNN"> anchor to find:
  //   - The event title: the LAST h3 before the anchor that is NOT a date (MM/DD)
  //   - The date: the h3 that purely matches MM/DD
  //   - The time: the h4 before the anchor
  const anchorRe = /href="[^"]*#event-modal-(\d+)"/g;
  let aMatch: RegExpExecArray | null;
  const seenIds = new Set<string>();

  while ((aMatch = anchorRe.exec(html)) !== null) {
    const modalId = aMatch[1];
    if (seenIds.has(modalId)) continue;
    seenIds.add(modalId);

    const anchorIdx = aMatch.index;
    // Look at the preceding 2000 chars for h3/h4 tags belonging to this event
    const preceding = html.slice(Math.max(0, anchorIdx - 2000), anchorIdx);

    // Collect all h3 texts in this window
    const h3Texts: string[] = [];
    const h3Re = /<h3[^>]*>([^<]{1,100})<\/h3>/gi;
    let h3m: RegExpExecArray | null;
    while ((h3m = h3Re.exec(preceding)) !== null) h3Texts.push(h3m[1].trim());

    // Date h3: purely matches MM/DD (e.g. "09/21")
    const dateh3 = h3Texts.find(t => /^\d{1,2}\/\d{1,2}$/.test(t));
    // Title h3: the last h3 that is NOT the date pattern
    const titleh3 = [...h3Texts].reverse().find(t => !/^\d{1,2}\/\d{1,2}$/.test(t) && t.length >= 4);

    // Time h4: the last h4 before the anchor
    const h4Texts: string[] = [];
    const h4Re = /<h4[^>]*>([^<]{1,50})<\/h4>/gi;
    let h4m: RegExpExecArray | null;
    while ((h4m = h4Re.exec(preceding)) !== null) h4Texts.push(h4m[1].trim());
    const timeh4 = h4Texts[h4Texts.length - 1] ?? "";

    if (!titleh3 || !dateh3) continue;

    // Parse date: "MM/DD" → proper Date
    const [mm, dd] = dateh3.split("/").map(Number);
    const yr = new Date().getFullYear();
    // Use noon UTC to avoid any timezone day-shift when ISO-serialising
    const candidate = new Date(Date.UTC(yr, mm - 1, dd, 12, 0, 0));
    if (candidate.getTime() < Date.now() - 30 * 86_400_000) {
      candidate.setUTCFullYear(yr + 1);
    }
    const isoDate = candidate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const rawDate = `${candidate.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${dd}`;

    const portalUrl = `${portalBase}#event-modal-${modalId}`;
    const description = `${titleh3}${timeh4 ? ` at ${timeh4}` : ""} · ${rawDate}. Exclusive members-only event at The Crescent Club & Spa, 400 Crescent Court, Dallas, TX.`;

    events.push({
      id: `cc_${modalId}`,
      title: titleh3,
      description,
      rawDate,
      isoDate,
      portalUrl,
      type: classifyEventType(titleh3),
      isSoldOut: false,
    });
  }

  // ── Strategy B: fallback from modal sections (if listing scan found nothing) ─
  if (events.length === 0) {
    const modalIds: string[] = [];
    const modalIdRe = /#event-modal-(\d+)/g;
    let mm2: RegExpExecArray | null;
    while ((mm2 = modalIdRe.exec(html)) !== null) {
      if (!modalIds.includes(mm2[1])) modalIds.push(mm2[1]);
    }

    for (const modalId of modalIds) {
      const sectionRe = new RegExp(`id=["']event-modal-${modalId}["'][^>]*>([\\s\\S]{0,3000})`, "i");
      const sm = sectionRe.exec(html);
      if (!sm) continue;
      const section = sm[1];

      // Title: first <h4> that is NOT a date pattern
      const h4Re2 = /<h4[^>]*>([^<]+)<\/h4>/gi;
      let h4m2: RegExpExecArray | null;
      let title = "";
      while ((h4m2 = h4Re2.exec(section)) !== null) {
        const t = h4m2[1].trim();
        if (!/^\d{1,2}\/\d{1,2}/.test(t) && t.length >= 4) { title = t; break; }
      }

      // Date+time: first <h5> matching MM/DD HH:MM
      const h5m = /<h5[^>]*>(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)<\/h5>/i.exec(section);
      if (!h5m || !title) continue;

      const [mm3, d2] = h5m[1].split("/").map(Number);
      const time = h5m[2].trim();
      const yr = new Date().getFullYear();
      const cand = new Date(Date.UTC(yr, mm3 - 1, d2, 12, 0, 0));
      if (cand.getTime() < Date.now() - 30 * 86_400_000) cand.setUTCFullYear(yr + 1);
      const isoDate = cand.toISOString().slice(0, 10);
      const rawDate = `${cand.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d2}`;

      events.push({
        id: `cc_${modalId}`,
        title,
        description: `${title} at ${time} · ${rawDate}. Exclusive members-only event at The Crescent Club & Spa, Dallas.`,
        rawDate,
        isoDate,
        portalUrl: `${portalBase}#event-modal-${modalId}`,
        type: classifyEventType(title),
        isSoldOut: false,
      });
    }
  }

  return events;
}

// ── Date resolver: maps "Month Day" to the most sensible absolute year ────────
function resolveEventDate(rawDate: string): Date | null {
  const now = Date.now();
  const DAY = 86_400_000;
  const yr = new Date().getFullYear();
  const candidates = [
    new Date(`${rawDate} ${yr}`),
    new Date(`${rawDate} ${yr - 1}`),
    new Date(`${rawDate} ${yr + 1}`),
  ].filter(d => !isNaN(d.getTime()));
  if (candidates.length === 0) return null;
  const valid = candidates.filter(d => d.getTime() <= now + 365 * DAY);
  const pool = valid.length > 0 ? valid : candidates;
  const upcoming = pool.filter(d => d.getTime() >= now - DAY);
  if (upcoming.length > 0) return upcoming.sort((a, b) => a.getTime() - b.getTime())[0];
  return pool.sort((a, b) => b.getTime() - a.getTime())[0];
}

/**
 * GET /member-club/events?clubName=<name>
 * Fetches real upcoming events for a known private club.
 */
app.get("/member-club/events", async (c) => {
  const clubName = (c.req.query("clubName") || "").toLowerCase().trim();
  if (!clubName) return c.json({ error: "clubName is required" }, 400 as ContentfulStatusCode);

  const entry = CLUB_REGISTRY.find(r => clubName.includes(r.match));
  if (!entry) {
    return c.json({ error: "Club not found in registry", events: [] }, 404 as ContentfulStatusCode);
  }

  const { eventsUrl, parser } = entry.config;

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(eventsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    clearTimeout(to);

    if (!res.ok) {
      return c.json({ error: `Events page returned ${res.status}`, events: [] }, 502 as ContentfulStatusCode);
    }

    const html = await res.text();
    let scraped: ScrapedEvent[] = [];
    if (parser === "parkhouse_webflow") scraped = parseParkhouseWebflow(html, entry.config.portalBase);
    if (parser === "crescent_club_html") scraped = parseCrescentClubHtml(html, entry.config.portalBase);
    // portal_only clubs have no public event feed — return empty so frontend uses curated fallback
    if (parser === "portal_only") {
      return c.json({ events: [], total: 0, portalUrl: entry.config.portalBase, source: "portal_only" });
    }

    const nowMs = Date.now();
    const DAY = 86_400_000;

    const upcoming = scraped.filter(ev => {
      // Prefer isoDate (exact, from data-event-date attribute)
      if (ev.isoDate) {
        return new Date(ev.isoDate).getTime() >= nowMs - DAY;
      }
      // Fallback: ambiguous rawDate — use resolveEventDate heuristic
      if (!ev.rawDate) return true;
      const d = resolveEventDate(ev.rawDate);
      return d ? d.getTime() >= nowMs - DAY : true;
    }).slice(0, 25);

    return c.json({ events: upcoming, source: eventsUrl, total: upcoming.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[MemberClub] ${msg}`);
    return c.json({ error: msg, events: [] }, 500 as ContentfulStatusCode);
  }
});

Deno.serve(app.fetch);



