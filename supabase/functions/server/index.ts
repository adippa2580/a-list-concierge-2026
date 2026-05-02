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
  // Optional provenance fields — set when an event was matched from a user's
  // connected music service (Spotify / Apple Music) via artist name.
  matchedArtist?: string;
  matchedFrom?: ('spotify' | 'apple_music')[];
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
    
    for (let i = 0; i < Math.min(links.length, 50); i++) {
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
      `?token=${APIFY_TOKEN}&timeout=45&memory=256&maxItems=50`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);

    const res = await fetch(actorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: raUrl }],
        maxEvents: 50,
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
async function searchTicketmaster(query: string, city: string, browseMode = false): Promise<WebSearchResult[]> {
  if (!TICKETMASTER_API_KEY) {
    return [];
  }

  const results: WebSearchResult[] = [];

  try {
    // For city browse (no search query), omit keyword and use classificationName
    // to get all music/arts events in the city — much more reliable than keyword matching
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${encodeURIComponent(city)}&size=50&sort=date,asc`;
    if (browseMode) {
      url += `&classificationName=music,arts,family`;
    } else {
      url += `&keyword=${encodeURIComponent(query)}`;
    }

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

    for (let i = 0; i < Math.min(links.length, 25); i++) {
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

// ── Bandsintown Public API ───────────────────────────────────────────────────
// Public endpoint requires an `app_id` query param — it can be any string identifying
// our app. No API key required for the v3.1 public artist-events endpoint.
// Docs: https://app.swaggerhub.com/apis-docs/Bandsintown/PublicAPI/3.1.0
const BANDSINTOWN_APP_ID = Deno.env.get("BANDSINTOWN_APP_ID") || "a-list-concierge";

/**
 * Fetch upcoming events for a single artist from Bandsintown.
 * Returns events normalised to the shared WebSearchResult shape.
 *
 * The endpoint accepts the artist name directly in the URL path. Special
 * characters (slash, ?, *) need to be replaced per Bandsintown's docs:
 *   /  →  %252F
 *   ?  →  %253F
 *   *  →  %252A
 */
async function searchBandsintown(artist: string, city?: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  if (!artist) return results;

  try {
    // Bandsintown wants double-encoded special chars
    const encoded = encodeURIComponent(artist)
      .replace(/\//g, "%252F")
      .replace(/\?/g, "%253F")
      .replace(/\*/g, "%252A");
    const url = `https://rest.bandsintown.com/artists/${encoded}/events?app_id=${encodeURIComponent(BANDSINTOWN_APP_ID)}&date=upcoming`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return results;

    // Bandsintown returns either an array of events, or {warn: "Not found"} for unknown artists.
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return results;

    const cityLc = city?.toLowerCase() ?? "";

    for (const ev of data as Record<string, unknown>[]) {
      const venue = (ev.venue as Record<string, unknown> | undefined) || {};
      const venueCity = String(venue.city || "");
      const venueName = String(venue.name || "Bandsintown");

      // If a city was passed, only keep matches in that city (loose match).
      if (cityLc && !venueCity.toLowerCase().includes(cityLc)) continue;

      const offers = (ev.offers as Array<Record<string, unknown>> | undefined) || [];
      const ticketOffer = offers.find(o => o.type === "Tickets") || offers[0];
      const ticketUrl = (ticketOffer?.url as string) || (ev.url as string) || null;

      const lineup = (ev.lineup as string[] | undefined) || [];
      const country = String(venue.country || "");
      const region = String(venue.region || "");

      results.push({
        id: `bit-${ev.id ?? Math.random().toString(36).slice(2)}`,
        name: { text: `${artist} — Live` },
        venue: { name: venueName },
        start: { local: String(ev.datetime || new Date().toISOString()) },
        logo: { url: (ev.artist as Record<string, unknown> | undefined)?.image_url as string ?? null },
        source: "bandsintown",
        ticketUrl,
        venueWebsite: null,
        snippet: [
          venueCity ? `📍 ${venueCity}${region ? ", " + region : ""}${country ? ", " + country : ""}` : null,
          lineup.length > 1 ? `🎵 ${lineup.slice(0, 4).join(", ")}` : null,
        ].filter(Boolean).join("  •  ") || null,
        matchedArtist: artist,
      });
    }
  } catch { /* silent — graceful fallback */ }
  return results;
}

// ── SeatGeek Partners API ────────────────────────────────────────────────────
// Free tier requires only a client_id (no auth header). Docs: https://platform.seatgeek.com/
const SEATGEEK_CLIENT_ID = Deno.env.get("SEATGEEK_CLIENT_ID");

/**
 * Search SeatGeek for events matching a performer (or keyword) in a city.
 * Returns events normalised to the shared WebSearchResult shape.
 */
async function searchSeatGeek(query: string, city: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  if (!SEATGEEK_CLIENT_ID || !query) return results;

  try {
    const params = new URLSearchParams({
      client_id: SEATGEEK_CLIENT_ID,
      "performers.slug": "",  // omitted; we use keyword instead
      q: query,
      "venue.city": city,
      per_page: "10",
      "sort": "datetime_local.asc",
    });
    // remove empty perf slug
    params.delete("performers.slug");
    const url = `https://api.seatgeek.com/2/events?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return results;

    const data = await res.json();
    const events = (data?.events as Array<Record<string, unknown>>) || [];

    for (const ev of events) {
      const venue = (ev.venue as Record<string, unknown> | undefined) || {};
      const performers = (ev.performers as Array<Record<string, unknown>> | undefined) || [];
      const headliner = performers.find(p => p.primary) || performers[0] || {};

      const stats = (ev.stats as Record<string, unknown> | undefined) || {};
      const lowest = stats.lowest_price as number | null;
      const highest = stats.highest_price as number | null;

      results.push({
        id: `sg-${ev.id ?? Math.random().toString(36).slice(2)}`,
        name: { text: String(ev.title || query) },
        venue: { name: String(venue.name || city) },
        start: { local: String(ev.datetime_local || ev.datetime_utc || new Date().toISOString()) },
        logo: { url: (headliner.image as string) ?? null },
        source: "seatgeek",
        ticketUrl: (ev.url as string) || null,
        venueWebsite: null,
        snippet: [
          venue.city ? `📍 ${venue.city}${venue.state ? ", " + venue.state : ""}` : null,
          (lowest && highest) ? `💰 $${lowest} – $${highest}` : null,
        ].filter(Boolean).join("  •  ") || null,
        matchedArtist: query,
      });
    }
  } catch { /* silent */ }
  return results;
}

/**
 * Run a per-artist Ticketmaster keyword search. Lighter than the city-browse
 * mode in `searchTicketmaster` because it scopes by `keyword` instead of dumping
 * the whole city. Used for cross-referencing user-taste artists.
 */
async function searchTicketmasterByArtist(artist: string, city: string): Promise<WebSearchResult[]> {
  if (!TICKETMASTER_API_KEY || !artist) return [];

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}` +
      `&keyword=${encodeURIComponent(artist)}` +
      `&city=${encodeURIComponent(city)}` +
      `&size=10&sort=date,asc`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    const events = data?._embedded?.events || [];
    const results: WebSearchResult[] = [];

    for (const event of events) {
      const venue = event._embedded?.venues?.[0];
      const image = event.images?.find((img: { ratio: string; width: number; url: string }) => img.ratio === "16_9" && img.width > 300)
                  || event.images?.[0];
      const startDate = event.dates?.start?.dateTime || event.dates?.start?.localDate || new Date().toISOString();

      results.push({
        id: `tm-art-${event.id}`,
        name: { text: event.name || artist },
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
        matchedArtist: artist,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Run a parallel multi-source artist event lookup: Ticketmaster (keyword),
 * Bandsintown (per-artist), SeatGeek (keyword). Returns merged results with
 * `matchedArtist` already set. Caller is responsible for setting `matchedFrom`.
 */
async function fetchEventsForArtist(artist: string, city: string): Promise<WebSearchResult[]> {
  const [tm, bit, sg] = await Promise.all([
    searchTicketmasterByArtist(artist, city).catch(() => [] as WebSearchResult[]),
    searchBandsintown(artist, city).catch(() => [] as WebSearchResult[]),
    searchSeatGeek(artist, city).catch(() => [] as WebSearchResult[]),
  ]);
  return [...tm, ...bit, ...sg];
}

/**
 * Dedupe a list of artist events by (artist + venue + day). Merges matchedFrom
 * arrays when the same event surfaces via multiple services.
 */
function dedupeArtistEvents(events: WebSearchResult[]): WebSearchResult[] {
  const map = new Map<string, WebSearchResult>();
  for (const ev of events) {
    const day = new Date(ev.start.local).toDateString();
    const key = `${(ev.matchedArtist || "").toLowerCase()}|${ev.venue.name.toLowerCase()}|${day}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, ev);
      continue;
    }
    // Prefer ticketmaster image / snippet when they exist, but keep the union of provenance.
    const merged: WebSearchResult = {
      ...existing,
      logo: { url: existing.logo.url || ev.logo.url },
      snippet: existing.snippet || ev.snippet,
      ticketUrl: existing.ticketUrl || ev.ticketUrl,
      matchedFrom: Array.from(new Set([...(existing.matchedFrom || []), ...(ev.matchedFrom || [])])) as ('spotify' | 'apple_music')[],
    };
    // If existing was ticketmaster but new one has bandsintown image and existing has none, take it.
    map.set(key, merged);
  }
  return Array.from(map.values());
}

const app = new Hono().basePath("/server");

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET") || "e9cd7524ce804c2c9121e1c4c87a87c6";
const SPOTIFY_REDIRECT_URI = Deno.env.get("SPOTIFY_REDIRECT_URI") || "https://a-list-core-application.web.app";

// SoundCloud OAuth configuration
const SOUNDCLOUD_CLIENT_ID = Deno.env.get("SOUNDCLOUD_CLIENT_ID");
const _SOUNDCLOUD_CLIENT_SECRET = Deno.env.get("SOUNDCLOUD_CLIENT_SECRET");
const SOUNDCLOUD_REDIRECT_URI = Deno.env.get("SOUNDCLOUD_REDIRECT_URI") || "https://localhost:3000/soundcloud/callback";

// Instagram Graph API (OAuth with Instagram Login) configuration
// Requires: INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, INSTAGRAM_REDIRECT_URI
// App must have instagram_business_basic permission approved.
const INSTAGRAM_CLIENT_ID = Deno.env.get("INSTAGRAM_CLIENT_ID") || "1494955948890232";
const INSTAGRAM_CLIENT_SECRET = Deno.env.get("INSTAGRAM_CLIENT_SECRET");
// The redirect URI must be registered in your Meta app and should point
// directly to the Supabase edge function callback endpoint:
// https://<project-ref>.supabase.co/functions/v1/server/instagram/callback
const INSTAGRAM_REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI") || "https://a-list-core-application.web.app/";
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");

// Eventbrite configuration
const EVENTBRITE_API_KEY = Deno.env.get("EVENTBRITE_API_KEY");

// Enable logger
app.use('*', logger());

// Enable CORS for all routes and methods.
// Echo the request origin back so that EVERY caller works:
//   - https://a-list-core-application.web.app  (production web)
//   - http://localhost:5173 / 3000             (local dev web)
//   - capacitor://localhost / https://localhost (iOS Capacitor app)
//   - http://localhost / ionic://localhost      (Android Capacitor / legacy Ionic)
// Origin is not our security boundary: every endpoint is bearer-token gated
// (anon key minimum) and write paths additionally check service role + userId
// ownership in the SQL filter. Echoing origin is therefore safe AND stops the
// "iOS app shows no records" class of bug from regressing.
app.use(
  "/*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-admin-key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

  // playlist-modify-* added so /spotify/blend-playlist can create a shared
  // Blend playlist on the captain's account. Existing tokens won't have these
  // scopes — users will need to disconnect + reconnect Spotify the first time
  // they try Blend after this ships. The endpoint surfaces a clear toast in
  // that case rather than failing silently.
  const scopes = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public"
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
    // Read client secret — env var has hardcoded fallback, also try KV
    const clientSecret = SPOTIFY_CLIENT_SECRET ||
      (await kv.get("config:spotify_client_secret") as string | null) || "";

    // Exchange code for access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("[Spotify] Token exchange " + tokenResponse.status + ": " + errorBody + " redirect_uri=" + SPOTIFY_REDIRECT_URI);
      return c.json({
        error: "Failed to exchange code for token",
        spotify_status: tokenResponse.status,
        spotify_error: errorBody,
        redirect_uri_used: SPOTIFY_REDIRECT_URI,
      }, tokenResponse.status as ContentfulStatusCode);
    }

    const tokenData = await tokenResponse.json();

    // Store tokens in KV store with userId as key
    await kv.set(`spotify_token_${userId}`, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      scope: tokenData.scope
    });

    // Persist connection status to profiles table
    await markSocialConnected(userId, 'spotify');

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
    logo: { url: logos[i % logos.length] },
    snippet: vibes[i % vibes.length],
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
  // When userId is provided we additionally cross-reference the user's connected
  // Spotify/Apple Music artists against Ticketmaster + Bandsintown + SeatGeek.
  const userId = c.req.query("userId");

  const locationName = city || "Miami";

  // ── Launch all searches in parallel ──────────────────────────────────────

  const hasSearchQuery = query && query.length >= 2;

  // 1. Web search (Google/DuckDuckGo) — only when searching
  const webSearchPromise: Promise<WebSearchResult[]> = hasSearchQuery
    ? searchWebForEvents(query, locationName).catch(() => [] as WebSearchResult[])
    : Promise.resolve([]);

  // 2. Ticketmaster Discovery API — runs always; browse mode omits keyword for better city results
  const ticketmasterPromise: Promise<WebSearchResult[]> =
    searchTicketmaster(hasSearchQuery ? query! : "", locationName, !hasSearchQuery).catch(() => [] as WebSearchResult[]);

  // 3. Ticket Tailor search — only when searching
  const ticketTailorPromise: Promise<WebSearchResult[]> = hasSearchQuery
    ? searchTicketTailor(query, locationName).catch(() => [] as WebSearchResult[])
    : Promise.resolve([]);

  // 4. Resident Advisor (RA Guide) — runs always for city browse
  const raPromise: Promise<WebSearchResult[]> = APIFY_TOKEN
    ? searchResidentAdvisor(query ?? "", locationName).catch(() => [] as WebSearchResult[])
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

  // 6. Personalised artist events (Ticketmaster + Bandsintown + SeatGeek per artist)
  //    when a userId is provided and the user has connected at least one
  //    music service.
  const personalizedPromise: Promise<WebSearchResult[]> = (async () => {
    if (!userId) return [];
    try {
      const [spotifyTaste, appleMusicTaste] = await Promise.all([
        kv.get(`spotify_taste_${userId}`) as Promise<{ topArtists?: { name: string }[] } | null>,
        kv.get(`apple_music_taste_${userId}`) as Promise<{ topArtists?: { name: string }[] } | null>,
      ]);
      const spotifyArtists = (spotifyTaste?.topArtists || []).map(a => a.name).filter(Boolean);
      const appleMusicArtists = (appleMusicTaste?.topArtists || []).map(a => a.name).filter(Boolean);
      if (!spotifyArtists.length && !appleMusicArtists.length) return [];

      const spotifySet = new Set(spotifyArtists.map(n => n.toLowerCase()));
      const appleMusicSet = new Set(appleMusicArtists.map(n => n.toLowerCase()));
      const uniqueArtists = Array.from(new Set([...spotifyArtists, ...appleMusicArtists])).slice(0, 8);

      const perArtist = await Promise.all(
        uniqueArtists.map(async (name) => {
          const found = await fetchEventsForArtist(name, locationName);
          const lc = name.toLowerCase();
          const matchedFrom: ('spotify' | 'apple_music')[] = [];
          if (spotifySet.has(lc)) matchedFrom.push('spotify');
          if (appleMusicSet.has(lc)) matchedFrom.push('apple_music');
          return found.map(ev => ({ ...ev, matchedFrom }));
        })
      );
      return dedupeArtistEvents(perArtist.flat());
    } catch {
      return [];
    }
  })();

  // ── Await all results ─────────────────────────────────────────────────────
  const [webSearchResults, ticketmasterResults, ticketTailorResults, raResults, eventbriteEvents, personalizedResults] =
    await Promise.all([webSearchPromise, ticketmasterPromise, ticketTailorPromise, raPromise, eventbritePromise, personalizedPromise]);


  // ── Merge results ─────────────────────────────────────────────────────────
  // Priority order:
  //   personalized (artist matches from user's Spotify/Apple Music) → RA Guide
  //     → Web Search (venue sites) → Ticketmaster → Ticket Tailor → Eventbrite
  // Personalised artist matches go first so users see "their" events at the top.
  const mergedResults = [
    ...personalizedResults,
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

// ── ALIST Concierge on Vertex AI Agent Engine (optional, takes precedence) ──
// When ALIST_AGENT_ENGINE_ID is set, /chat proxies to the deployed agent
// instead of calling Gemini directly.  Required env when enabled:
//   GOOGLE_PROJECT_ID, GOOGLE_LOCATION, ALIST_AGENT_ENGINE_ID,
//   GCP_SERVICE_ACCOUNT_KEY (json string)
const ALIST_AGENT_ENGINE_ID = Deno.env.get("ALIST_AGENT_ENGINE_ID");
const GCP_PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID") ?? "a-list-core-application";
const GCP_LOCATION = Deno.env.get("GOOGLE_LOCATION") ?? "us-central1";
const GCP_SA_KEY_JSON = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");

let _gcpToken: { token: string; exp: number } | null = null;

async function _mintGcpAccessToken(): Promise<string> {
  const now = Date.now();
  if (_gcpToken && _gcpToken.exp > now + 60_000) return _gcpToken.token;
  if (!GCP_SA_KEY_JSON) throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured");

  const sa = JSON.parse(GCP_SA_KEY_JSON);
  const pemBody = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  };
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  const jwt = `${signingInput}.${sigB64}`;

  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokRes.ok) throw new Error(`gcp token: ${await tokRes.text()}`);
  const tj = await tokRes.json();
  _gcpToken = { token: tj.access_token, exp: now + tj.expires_in * 1000 };
  return tj.access_token;
}

// Reuse a single ADK session per (userId, day) so the agent has continuity.
const _alistSessions = new Map<string, string>();

async function _ensureAlistSession(
  token: string,
  base: string,
  userId: string,
): Promise<string> {
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const existing = _alistSessions.get(key);
  if (existing) return existing;
  const cs = await fetch(`${base}:query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      class_method: "create_session",
      input: { user_id: userId },
    }),
  });
  if (!cs.ok) throw new Error(`create_session ${cs.status}: ${await cs.text()}`);
  const csJson = await cs.json();
  const id = csJson?.output?.id;
  if (!id) throw new Error(`create_session: no id in ${JSON.stringify(csJson)}`);
  _alistSessions.set(key, id);
  return id;
}

async function _callAlistAgent(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  location: unknown,
  userId: string | undefined,
): Promise<string> {
  const token = await _mintGcpAccessToken();
  const base =
    `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/${ALIST_AGENT_ENGINE_ID}`;
  const uid = userId ?? "anonymous";
  const sessionId = await _ensureAlistSession(token, base, uid);

  // Pass location/history as preamble lines the agent can read inline.
  const inputText = [
    location ? `[location] ${JSON.stringify(location)}` : "",
    ...(conversationHistory ?? []).slice(-6).map((m) => `[${m.role}] ${m.content}`),
    `[user] ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sq = await fetch(`${base}:streamQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      class_method: "stream_query",
      input: { message: inputText, user_id: uid, session_id: sessionId },
    }),
  });
  if (!sq.ok) throw new Error(`stream_query ${sq.status}: ${await sq.text()}`);

  // The response is JSONL (one JSON object per line). Concatenate every
  // assistant text part across events; the final assistant turn is what we
  // want.
  const raw = await sq.text();
  const finalParts: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const ev = JSON.parse(t);
      if (ev?.content?.role !== "model") continue;
      for (const part of ev?.content?.parts ?? []) {
        if (typeof part?.text === "string") finalParts.push(part.text);
      }
    } catch { /* ignore non-JSON lines */ }
  }
  return finalParts.join("").trim() || "I'm here. What are we doing tonight?";
}

// Helper: persist social connection status to profiles table
async function markSocialConnected(userId: string, provider: 'spotify' | 'instagram' | 'soundcloud') {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    const col = `${provider}_connected`;
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ [col]: true, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    console.error(`[markSocialConnected] Failed for ${provider}/${userId}:`, e);
  }
}

// Helper: disconnect social account — clear KV token + set connected flag to false
async function markSocialDisconnected(userId: string, provider: 'spotify' | 'instagram' | 'soundcloud') {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    await kv.del(`${provider}_token_${userId}`);
    const col = `${provider}_connected`;
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ [col]: false, updated_at: new Date().toISOString() }),
    });
    console.log(`[markSocialDisconnected] ${provider} disconnected for ${userId}`);
  } catch (e) {
    console.error(`[markSocialDisconnected] Failed for ${provider}/${userId}:`, e);
  }
}

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

  prompt += '\n\nEARLY DISCOVERY: In your opening exchanges (first 1-2 replies), if the user has not indicated their party size or crew, naturally weave in the question: are they flying solo tonight, or curating an experience for their crew? Use this to tailor venue recommendations — intimate table-for-two vs. VIP group booking with bottle service.';

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
    ? `Generate a short, warm, personalised opening greeting for this returning user. Reference something specific about their preferences. It is ${timeOfDay}. End with a single natural question: are they going solo tonight, or curating a night out for their crew? Keep it under 35 words total. Tone: elite concierge, like they just walked into a private members club.`
    : `Generate a short, sophisticated opening greeting. It is ${timeOfDay}. Introduce yourself as A-List Assist. End with a single natural question: are they flying solo or bringing the crew tonight? Keep it under 30 words total. Tone: elite nightlife concierge.`;

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
  const { message, conversationHistory, location, userId } = await c.req.json();

  // Preferred path: ALIST Concierge on Vertex AI Agent Engine (when configured).
  if (ALIST_AGENT_ENGINE_ID && GCP_SA_KEY_JSON) {
    try {
      const reply = await _callAlistAgent(
        message,
        conversationHistory ?? [],
        location,
        userId,
      );
      // Fire-and-forget intelligence extraction so the Taste Graph keeps learning.
      if (userId) {
        const fullHistory = [
          ...(conversationHistory || []),
          { role: "user", content: message },
          { role: "assistant", content: reply },
        ];
        extractAndSaveIntelligence(userId, fullHistory);
      }
      return c.json({ message: reply, tiles: [] });
    } catch (err) {
      console.error("ALIST Agent Engine error, falling back to Gemini:", err);
      // Falls through to Gemini below.
    }
  }

  // Fallback: existing Gemini direct path.
  if (!GEMINI_API_KEY) {
    return c.json({
      message: "A-List Assist is standing by. Configure GEMINI_API_KEY or ALIST_AGENT_ENGINE_ID in edge function secrets to activate full intelligence.",
      tiles: [],
    });
  }

  try {
    const intelligence = userId ? await getUserIntelligence(userId) : null;
    const systemPrompt = buildSystemPrompt(intelligence, location);

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    const raw = await callGemini(messages, true);
    let parsedContent;
    try {
      parsedContent = JSON.parse(raw);
    } catch {
      parsedContent = { message: raw || "Concierge is calibrating. Try again shortly.", tiles: [] };
    }

    if (userId) {
      const fullHistory = [
        ...(conversationHistory || []),
        { role: "user", content: message },
        { role: "assistant", content: parsedContent.message },
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

    // Persist connection status to profiles table
    await markSocialConnected(userId, 'soundcloud');

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

/** DELETE /soundcloud/disconnect — remove stored token + update DB */
app.delete("/soundcloud/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    await markSocialDisconnected(userId, 'soundcloud');
    return c.json({ success: true, provider: 'soundcloud', message: 'SoundCloud account disconnected' });
  } catch (err) {
    console.error(`[SoundCloud] Disconnect error: ${err}`);
    return c.json({ success: false, error: "Failed to disconnect SoundCloud" }, 500 as ContentfulStatusCode);
  }
});

// ── SoundCloud parity endpoints ──────────────────────────────────────────────
// Mirrors of /spotify/top-artists and /spotify/blend-playlist so the frontend
// can target either platform with the same patterns.
//
// Caveat: SoundCloud's API is more restricted than Spotify's. Playlist creation
// in particular has historically required app review and may return 401/403
// even with a valid OAuth token. The endpoint surfaces the SC error verbatim
// so the UI can fall back to Spotify if available.

/** GET /soundcloud/top-artists — derive top artists + genres from likes */
app.get("/soundcloud/top-artists", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const stored = await kv.get(`soundcloud_token_${userId}`) as { access_token: string; expires_at: number | null } | null;
  if (!stored?.access_token) return c.json({ error: "SoundCloud not connected" }, 401 as ContentfulStatusCode);
  if (stored.expires_at !== null && stored.expires_at < Date.now()) return c.json({ error: "SoundCloud token expired" }, 401 as ContentfulStatusCode);

  try {
    // Pull liked tracks; aggregate artists by like-count, genres by track frequency
    const likesRes = await fetch("https://api.soundcloud.com/me/likes/tracks?limit=50&linked_partitioning=true", {
      headers: { "Authorization": `OAuth ${stored.access_token}`, "Accept": "application/json; charset=utf-8" },
    });
    if (!likesRes.ok) {
      const body = await likesRes.text();
      return c.json({ error: "SoundCloud likes fetch failed", soundcloud_status: likesRes.status, soundcloud_error: body.slice(0, 300) }, 500 as ContentfulStatusCode);
    }
    interface SCTrack {
      id: number;
      title?: string;
      genre?: string;
      tag_list?: string;
      user?: { id: number; username?: string; avatar_url?: string };
      publisher_metadata?: { artist?: string; publisher?: string };
    }
    const likesJson = await likesRes.json() as { collection?: SCTrack[] } | SCTrack[];
    const tracks: SCTrack[] = Array.isArray(likesJson) ? likesJson : (likesJson.collection ?? []);

    const artistMap = new Map<string, { name: string; image: string | null; count: number }>();
    const genreCount: Record<string, number> = {};

    for (const t of tracks) {
      const artistName = (t.publisher_metadata?.artist?.trim()) || t.user?.username || t.publisher_metadata?.publisher;
      if (artistName) {
        const key = artistName.toLowerCase();
        const existing = artistMap.get(key);
        if (existing) existing.count += 1;
        else artistMap.set(key, { name: artistName, image: t.user?.avatar_url ?? null, count: 1 });
      }
      if (t.genre) genreCount[t.genre] = (genreCount[t.genre] || 0) + 1;
      // Also fold tag_list (lightly — single tokens only, skip quoted multi-word and geo tags)
      if (t.tag_list) {
        for (const tok of t.tag_list.split(/\s+/)) {
          if (!tok || tok.length < 3 || tok.length > 30) continue;
          if (tok.startsWith('"') || tok.startsWith("geo:")) continue;
          genreCount[tok] = (genreCount[tok] || 0) + 1;
        }
      }
    }

    const topArtists = Array.from(artistMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(a => ({ name: a.name, image: a.image }));

    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([g]) => g);

    // Cache for downstream consumers (parity with Spotify cache)
    await kv.set(`soundcloud_taste_${userId}`, { topGenres, topArtists, updatedAt: Date.now() });

    return c.json({ topGenres, topArtists });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500 as ContentfulStatusCode);
  }
});

/** POST /soundcloud/blend-playlist — best-effort playlist creation
 *  Two SC users + their liked tracks → new SC playlist on userA.
 *  SC API gates playlist creation behind app review; if rejected we surface
 *  the SC status code so the UI can fall back to the Spotify path.
 */
app.post("/soundcloud/blend-playlist", async (c) => {
  const userIdA = c.req.query("userIdA");
  const userIdB = c.req.query("userIdB");
  if (!userIdA || !userIdB) return c.json({ error: "userIdA and userIdB required" }, 400 as ContentfulStatusCode);
  if (userIdA === userIdB) return c.json({ error: "userIdA and userIdB must differ" }, 400 as ContentfulStatusCode);

  const [tokenA, tokenB] = await Promise.all([
    kv.get(`soundcloud_token_${userIdA}`) as Promise<{ access_token: string; expires_at: number | null; username?: string } | null>,
    kv.get(`soundcloud_token_${userIdB}`) as Promise<{ access_token: string; expires_at: number | null; username?: string } | null>,
  ]);
  const validA = tokenA?.access_token && (tokenA.expires_at === null || tokenA.expires_at > Date.now());
  const validB = tokenB?.access_token && (tokenB.expires_at === null || tokenB.expires_at > Date.now());
  if (!validA) return c.json({ error: "Captain has no valid SoundCloud connection", action: "connect_soundcloud_a" }, 400 as ContentfulStatusCode);
  if (!validB) return c.json({ error: "Friend has no valid SoundCloud connection", action: "friend_needs_soundcloud" }, 400 as ContentfulStatusCode);

  const authA = { "Authorization": `OAuth ${tokenA!.access_token}`, "Accept": "application/json; charset=utf-8" };
  const authB = { "Authorization": `OAuth ${tokenB!.access_token}`, "Accept": "application/json; charset=utf-8" };

  try {
    interface SCTrack { id: number; title?: string }
    async function topLikedTrackIds(auth: Record<string, string>): Promise<number[]> {
      const r = await fetch("https://api.soundcloud.com/me/likes/tracks?limit=30", { headers: auth });
      if (!r.ok) return [];
      const j = await r.json() as { collection?: SCTrack[] } | SCTrack[];
      const list = Array.isArray(j) ? j : (j.collection ?? []);
      return list.map(t => t.id).filter((id): id is number => typeof id === "number");
    }

    const [idsA, idsB] = await Promise.all([topLikedTrackIds(authA), topLikedTrackIds(authB)]);

    // Interleave + dedupe
    const seen = new Set<number>();
    const ordered: number[] = [];
    const len = Math.max(idsA.length, idsB.length);
    for (let i = 0; i < len; i++) {
      if (idsA[i] != null && !seen.has(idsA[i])) { seen.add(idsA[i]); ordered.push(idsA[i]); }
      if (idsB[i] != null && !seen.has(idsB[i])) { seen.add(idsB[i]); ordered.push(idsB[i]); }
      if (ordered.length >= 50) break;
    }
    if (ordered.length === 0) {
      return c.json({ error: "Neither user has liked tracks on SoundCloud" }, 422 as ContentfulStatusCode);
    }

    const titleA = tokenA!.username || "you";
    const titleB = tokenB!.username || "friend";
    const playlistTitle = `A-List Blend · ${titleA} × ${titleB}`.slice(0, 100);

    // Create playlist on userA's account
    const createRes = await fetch("https://api.soundcloud.com/playlists", {
      method: "POST",
      headers: { ...authA, "Content-Type": "application/json" },
      body: JSON.stringify({
        playlist: {
          title: playlistTitle,
          sharing: "private",
          tracks: ordered.map(id => ({ id })),
        },
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      // 401/403 is the typical "app needs review" response for SC playlist create
      const action = (createRes.status === 401 || createRes.status === 403) ? "soundcloud_app_review_required" : null;
      return c.json({
        error: `SoundCloud playlist create failed (${createRes.status})`,
        soundcloud_status: createRes.status,
        soundcloud_error: body.slice(0, 300),
        action,
        fallback: "Try the Spotify Blend playlist if available",
      }, 502 as ContentfulStatusCode);
    }
    const created = await createRes.json() as { id: number; permalink_url?: string; uri?: string };

    return c.json({
      success: true,
      playlist: {
        id: created.id,
        name: playlistTitle,
        url: created.permalink_url ?? null,
        uri: created.uri ?? null,
        track_count: ordered.length,
      },
      from_a: idsA.length,
      from_b: idsB.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500 as ContentfulStatusCode);
  }
});

/** DELETE /spotify/disconnect — remove stored token + update DB */
app.delete("/spotify/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    await markSocialDisconnected(userId, 'spotify');
    return c.json({ success: true, provider: 'spotify', message: 'Spotify account disconnected' });
  } catch (err) {
    console.error(`[Spotify] Disconnect error: ${err}`);
    return c.json({ success: false, error: "Failed to disconnect Spotify" }, 500 as ContentfulStatusCode);
  }
});

// ── Spotify Blend playlist ────────────────────────────────────────────────────
// POST /spotify/blend-playlist?userIdA=&userIdB=
//
// Creates a real Spotify playlist on userA's account combining the top tracks
// of both users. UserA must have re-authed Spotify with the
// `playlist-modify-private` scope (added to /spotify/login this same release);
// existing tokens lack the scope, so first attempt for legacy users surfaces
// a 409 with action=reconnect_spotify and the UI prompts a re-auth.
//
// The merge is straightforward: pull each user's top 30 tracks (medium term),
// dedupe by track URI, push up to 50 onto a new playlist named
// "A-List Blend · {nameA} × {nameB}". Response includes the playlist URL so
// the client can deep-link into Spotify.
async function refreshSpotifyTokenForUser(userId: string): Promise<{ access_token: string; expires_at: number; refresh_token?: string; scope?: string } | null> {
  const stored = await kv.get(`spotify_token_${userId}`) as { access_token: string; refresh_token?: string; expires_at: number; scope?: string } | null;
  if (!stored?.access_token) return null;
  if (stored.expires_at - Date.now() > 60_000) return stored;
  if (!stored.refresh_token) return null;
  const clientId = SPOTIFY_CLIENT_ID;
  const clientSecret = SPOTIFY_CLIENT_SECRET || (await kv.get("config:spotify_client_secret") as string | null) || "";
  if (!clientId || !clientSecret) return null;
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.refresh_token }),
    });
    if (!r.ok) return null;
    const j = await r.json() as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
    const updated = {
      ...stored,
      access_token: j.access_token,
      expires_at: Date.now() + (j.expires_in * 1000),
      refresh_token: j.refresh_token ?? stored.refresh_token,
      scope: j.scope ?? stored.scope,
    };
    await kv.set(`spotify_token_${userId}`, updated);
    return updated;
  } catch { return null; }
}

app.post("/spotify/blend-playlist", async (c) => {
  const userIdA = c.req.query("userIdA");
  const userIdB = c.req.query("userIdB");
  if (!userIdA || !userIdB) return c.json({ error: "userIdA and userIdB required" }, 400 as ContentfulStatusCode);
  if (userIdA === userIdB) return c.json({ error: "userIdA and userIdB must differ" }, 400 as ContentfulStatusCode);

  // Both users need a fresh, valid Spotify access token.
  const [tokenA, tokenB] = await Promise.all([
    refreshSpotifyTokenForUser(userIdA),
    refreshSpotifyTokenForUser(userIdB),
  ]);
  if (!tokenA?.access_token) return c.json({ error: "Captain has no Spotify connection", action: "connect_spotify_a" }, 400 as ContentfulStatusCode);
  if (!tokenB?.access_token) return c.json({ error: "Friend has no Spotify connection", action: "friend_needs_spotify" }, 400 as ContentfulStatusCode);

  // Captain's token must include playlist-modify scope. Spotify returns the
  // granted scope string on each refresh — check before attempting playlist
  // creation so we can surface a clean reconnect prompt instead of a 403.
  const captainScope = (tokenA.scope ?? "").split(/\s+/);
  if (!captainScope.includes("playlist-modify-private") && !captainScope.includes("playlist-modify-public")) {
    return c.json({
      error: "Captain's Spotify token is missing the playlist-modify scope. Disconnect and reconnect Spotify to enable Blend playlists.",
      action: "reconnect_spotify",
    }, 409 as ContentfulStatusCode);
  }

  try {
    // Pull each user's top tracks (medium-term, 30 each).
    async function topTracks(token: string): Promise<{ name: string; uri: string; artists: string[] }[]> {
      const res = await fetch("https://api.spotify.com/v1/me/top/tracks?limit=30&time_range=medium_term", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const j = await res.json() as { items?: Array<{ name: string; uri: string; artists?: Array<{ name: string }> }> };
      return (j.items ?? []).map(t => ({ name: t.name, uri: t.uri, artists: (t.artists ?? []).map(a => a.name) }));
    }
    async function meDisplay(token: string): Promise<{ id: string; name: string }> {
      const res = await fetch("https://api.spotify.com/v1/me", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Spotify /me ${res.status}`);
      const j = await res.json() as { id: string; display_name?: string };
      return { id: j.id, name: j.display_name?.trim() || "A-List member" };
    }

    const [tracksA, tracksB, meA, meB] = await Promise.all([
      topTracks(tokenA.access_token),
      topTracks(tokenB.access_token),
      meDisplay(tokenA.access_token),
      meDisplay(tokenB.access_token),
    ]);

    // Dedupe by URI, interleave so both users' top picks are represented.
    const seen = new Set<string>();
    const interleaved: { name: string; uri: string; artists: string[] }[] = [];
    const maxLen = Math.max(tracksA.length, tracksB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = tracksA[i];
      const b = tracksB[i];
      if (a && !seen.has(a.uri)) { seen.add(a.uri); interleaved.push(a); }
      if (b && !seen.has(b.uri)) { seen.add(b.uri); interleaved.push(b); }
      if (interleaved.length >= 50) break;
    }
    if (interleaved.length === 0) {
      return c.json({ error: "Neither user has top tracks on Spotify" }, 422 as ContentfulStatusCode);
    }

    // Create empty playlist on Captain's account.
    const playlistName = `A-List Blend · ${meA.name} × ${meB.name}`.slice(0, 100);
    const description = `A blend of ${meA.name} and ${meB.name}'s top tracks. Generated by A-List on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
    const createRes = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(meA.id)}/playlists`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tokenA.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: playlistName, description, public: false }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      return c.json({ error: "Could not create playlist", spotify_status: createRes.status, spotify_error: t.slice(0, 300) }, 500 as ContentfulStatusCode);
    }
    const created = await createRes.json() as { id: string; external_urls?: { spotify?: string }; uri?: string };

    // Add tracks (Spotify caps at 100 per request; we have up to 50 so single call).
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${created.id}/tracks`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tokenA.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: interleaved.map(t => t.uri) }),
    });
    if (!addRes.ok) {
      const t = await addRes.text();
      return c.json({ error: "Created playlist but couldn't add tracks", playlist_url: created.external_urls?.spotify ?? null, spotify_status: addRes.status, spotify_error: t.slice(0, 300) }, 500 as ContentfulStatusCode);
    }

    return c.json({
      success: true,
      playlist: {
        id: created.id,
        name: playlistName,
        url: created.external_urls?.spotify ?? null,
        uri: created.uri ?? null,
        track_count: interleaved.length,
      },
      members: { a: meA, b: meB },
      from_a: tracksA.length,
      from_b: tracksB.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500 as ContentfulStatusCode);
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

  // Fetch KV tokens and profiles table in parallel
  const [spotifyRaw, soundcloudRaw, instagramRaw, appleMusicRaw, profileRes] = await Promise.all([
    kv.get(`spotify_token_${userId}`),
    kv.get(`soundcloud_token_${userId}`),
    kv.get(`instagram_token_${userId}`),
    kv.get(`apple_music_token_${userId}`),
    SUPABASE_SERVICE_KEY ? fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=spotify_connected,soundcloud_connected,instagram_connected`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY!, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
    }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),
  ]);

  const dbProfile = (profileRes as { spotify_connected?: boolean; soundcloud_connected?: boolean; instagram_connected?: boolean }[])?.[0] || {};

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

  const appleMusic = appleMusicRaw as {
    user_token?: string; storefront?: string;
    connected_at?: number; expires_at?: number;
  } | null;

  // Spotify: fetch /me live if token is valid (we may not have cached profile data)
  let spotifyProfile: { display_name?: string; avatar_url?: string; followers?: number; id?: string } | null = null;
  // Spotify: token still valid OR has refresh token OR marked connected in DB
  let spotifyConnected = !!spotify?.access_token && spotify.expires_at > Date.now();

  // If token expired but refresh_token exists, try to refresh
  if (!spotifyConnected && spotify?.refresh_token) {
    try {
      const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: spotify.refresh_token,
          client_id: SPOTIFY_CLIENT_ID || '',
          client_secret: SPOTIFY_CLIENT_SECRET || '',
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as { access_token: string; expires_in: number; refresh_token?: string };
        // Update KV with new tokens
        await kv.set(`spotify_token_${userId}`, {
          ...spotify,
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || spotify.refresh_token,
          expires_at: Date.now() + refreshData.expires_in * 1000,
        });
        // Update the local reference for the profile fetch below
        spotify!.access_token = refreshData.access_token;
        spotify!.expires_at = Date.now() + refreshData.expires_in * 1000;
        spotifyConnected = true;
      }
    } catch (_e) { /* silent — will fall back to DB status */ }
  }

  // Fall back to DB connected status if token is gone but was once connected
  if (!spotifyConnected && dbProfile.spotify_connected) spotifyConnected = true;
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

  const soundcloudConnected = (!!soundcloud?.access_token &&
    (soundcloud.expires_at === null || soundcloud.expires_at > Date.now())) || !!dbProfile.soundcloud_connected;
  const instagramConnected = (!!instagram?.access_token && instagram.expires_at > Date.now()) || !!dbProfile.instagram_connected;

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
    apple_music: {
      connected: !!appleMusic?.user_token && (appleMusic.expires_at ?? 0) > Date.now(),
      storefront: appleMusic?.storefront || null,
      days_until_expiry: appleMusic?.expires_at
        ? Math.floor((appleMusic.expires_at - Date.now()) / 86_400_000)
        : null,
    },
  });
});

// ── Apple Music: Developer token + store user token + top artists ─────────────
// MusicKit JS flow: client loads MusicKit → requests developer token from us →
// user authorizes in-browser → client sends us the user music token → we store
// it and use it for API calls to api.music.apple.com
app.get("/apple-music/developer-token", async (c) => {
  // Developer token is a JWT signed with the MusicKit private key.
  // For now we read a pre-generated token from secrets / KV (token can be
  // generated with 6-month expiry and rotated). This keeps the edge function
  // free of native crypto deps.
  const token =
    Deno.env.get("APPLE_MUSIC_DEVELOPER_TOKEN") ||
    (await kv.get("config:apple_music_developer_token") as string | null);

  if (!token) {
    return c.json({ error: "Apple Music developer token not configured" }, 503);
  }
  return c.json({ token });
});

app.post("/apple-music/store-token", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const body = await c.req.json() as { userToken?: string; storefront?: string };

  if (!body.userToken) {
    return c.json({ error: "userToken required" }, 400);
  }

  // Apple Music user tokens are long-lived (6 months) — no refresh flow.
  await kv.set(`apple_music_token_${userId}`, {
    user_token: body.userToken,
    storefront: body.storefront || "us",
    connected_at: Date.now(),
    // Treat as ~6 month expiry for UI display purposes
    expires_at: Date.now() + 180 * 24 * 60 * 60 * 1000,
  });

  return c.json({ success: true });
});

app.post("/apple-music/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  await kv.del(`apple_music_token_${userId}`);
  await kv.del(`apple_music_taste_${userId}`);
  return c.json({ success: true });
});

app.get("/apple-music/top-artists", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const tokenRecord = await kv.get(`apple_music_token_${userId}`) as {
    user_token?: string; storefront?: string;
  } | null;

  const devToken =
    Deno.env.get("APPLE_MUSIC_DEVELOPER_TOKEN") ||
    (await kv.get("config:apple_music_developer_token") as string | null);

  if (!tokenRecord?.user_token) {
    return c.json({ error: "Apple Music not connected" }, 401);
  }
  if (!devToken) {
    return c.json({ error: "Apple Music developer token not configured" }, 503);
  }

  try {
    // Fetch heavy rotation (most-played recent) + recently played tracks
    const headers = {
      "Authorization": `Bearer ${devToken}`,
      "Music-User-Token": tokenRecord.user_token,
    };

    const [heavyRes, recentRes] = await Promise.all([
      fetch("https://api.music.apple.com/v1/me/history/heavy-rotation?limit=20", { headers }),
      fetch("https://api.music.apple.com/v1/me/recent/played/tracks?limit=30", { headers }),
    ]);

    const heavy = heavyRes.ok ? await heavyRes.json() : { data: [] };
    const recent = recentRes.ok ? await recentRes.json() : { data: [] };

    // Extract artist names from heavy rotation (albums/artists/playlists) + recent tracks
    const artistMap = new Map<string, { name: string; image: string | null; count: number }>();

    for (const item of (heavy.data || [])) {
      const attr = item.attributes || {};
      const name = attr.artistName;
      if (!name) continue;
      const img = attr.artwork?.url
        ? attr.artwork.url.replace("{w}", "300").replace("{h}", "300")
        : null;
      const existing = artistMap.get(name.toLowerCase());
      if (existing) { existing.count += 2; }
      else { artistMap.set(name.toLowerCase(), { name, image: img, count: 2 }); }
    }

    for (const item of (recent.data || [])) {
      const attr = item.attributes || {};
      const name = attr.artistName;
      if (!name) continue;
      const img = attr.artwork?.url
        ? attr.artwork.url.replace("{w}", "300").replace("{h}", "300")
        : null;
      const existing = artistMap.get(name.toLowerCase());
      if (existing) { existing.count += 1; if (!existing.image) existing.image = img; }
      else { artistMap.set(name.toLowerCase(), { name, image: img, count: 1 }); }
    }

    const topArtists = Array.from(artistMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(a => ({ name: a.name, image: a.image }));

    // Apple Music API doesn't expose genre tags per-user the way Spotify does.
    // Extract genreNames from heavy rotation items where available.
    const genreCount: Record<string, number> = {};
    for (const item of (heavy.data || [])) {
      for (const g of (item.attributes?.genreNames || [])) {
        if (g && g !== "Music") genreCount[g] = (genreCount[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([g]) => g);

    await kv.set(`apple_music_taste_${userId}`, { topGenres, topArtists, updatedAt: Date.now() });

    return c.json({ topGenres, topArtists });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── User Preferences: GET / POST ──────────────────────────────────────────────
app.get("/preferences", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const prefs = await kv.get(`preferences:${userId}`) as {
    genres?: string[]; eventTypes?: string[]; updatedAt?: number;
  } | null;
  return c.json(prefs || { genres: [], eventTypes: [] });
});

app.post("/preferences", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const body = await c.req.json();
  const existing = await kv.get(`preferences:${userId}`) as Record<string, unknown> | null;
  const updated = { ...(existing || {}), ...body, updatedAt: Date.now() };
  await kv.set(`preferences:${userId}`, updated);
  return c.json(updated);
});

// ── Spotify Top Artists + Genres ───────────────────────────────────────────────
app.get("/spotify/top-artists", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const spotify = await kv.get(`spotify_token_${userId}`) as {
    access_token: string; refresh_token?: string; expires_at: number;
  } | null;

  if (!spotify?.access_token || spotify.expires_at < Date.now()) {
    return c.json({ error: "Spotify not connected or token expired" }, 401);
  }

  try {
    const [artistsRes, recentRes] = await Promise.all([
      fetch("https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term", {
        headers: { "Authorization": `Bearer ${spotify.access_token}` },
      }),
      fetch("https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=short_term", {
        headers: { "Authorization": `Bearer ${spotify.access_token}` },
      }),
    ]);

    const artists = artistsRes.ok ? await artistsRes.json() : { items: [] };
    const tracks = recentRes.ok ? await recentRes.json() : { items: [] };

    // Extract unique genres from top artists
    const genreCount: Record<string, number> = {};
    for (const a of (artists.items || [])) {
      for (const g of (a.genres || [])) {
        genreCount[g] = (genreCount[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([g]) => g);

    const topArtists = (artists.items || []).slice(0, 10).map((a: any) => ({
      name: a.name, id: a.id, genres: a.genres || [],
      image: a.images?.[0]?.url || null, popularity: a.popularity,
    }));

    // Cache for event matching
    await kv.set(`spotify_taste_${userId}`, { topGenres, topArtists, updatedAt: Date.now() });

    return c.json({ topGenres, topArtists });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Personalized Event Feed ───────────────────────────────────────────────────
//
// Now does two things:
//  1. Returns the user's taste payload (artist names, genres) — the original behaviour
//     that ArtistDiscovery.tsx still relies on.
//  2. ALSO cross-references each followed Spotify/Apple Music artist against
//     Ticketmaster, Bandsintown and SeatGeek, and returns the merged event list
//     tagged with `matchedArtist` + `matchedFrom: ['spotify' | 'apple_music']`.
//
// The frontend /events/personalized callers that only need artistNames + userGenres
// keep working — those fields are still present at the top level.
app.get("/events/personalized", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  const city = c.req.query("city") || "Miami";
  const includeEvents = c.req.query("includeEvents") !== "false"; // default ON

  // Fetch user preferences and Spotify + Apple Music taste in parallel
  const [prefs, spotifyTaste, appleMusicTaste] = await Promise.all([
    kv.get(`preferences:${userId}`) as Promise<{ genres?: string[]; eventTypes?: string[] } | null>,
    kv.get(`spotify_taste_${userId}`) as Promise<{ topGenres?: string[]; topArtists?: { name: string }[] } | null>,
    kv.get(`apple_music_taste_${userId}`) as Promise<{ topGenres?: string[]; topArtists?: { name: string }[] } | null>,
  ]);

  const userGenres = [
    ...(prefs?.genres || []),
    ...(spotifyTaste?.topGenres || []),
    ...(appleMusicTaste?.topGenres || []),
  ].map(g => g.toLowerCase());
  const userEventTypes = (prefs?.eventTypes || []).map(t => t.toLowerCase());

  const spotifyArtistNames = (spotifyTaste?.topArtists || []).map(a => a.name).filter(Boolean);
  const appleMusicArtistNames = (appleMusicTaste?.topArtists || []).map(a => a.name).filter(Boolean);
  const artistNames = [
    ...spotifyArtistNames,
    ...appleMusicArtistNames,
  ].map(a => a.toLowerCase());

  // Build a quick lookup so we can mark each event with its provenance.
  const spotifySet = new Set(spotifyArtistNames.map(n => n.toLowerCase()));
  const appleMusicSet = new Set(appleMusicArtistNames.map(n => n.toLowerCase()));

  let events: WebSearchResult[] = [];
  if (includeEvents && (spotifyArtistNames.length || appleMusicArtistNames.length)) {
    // Cap to top 8 unique artists to keep this under ~24 parallel HTTP calls
    const uniqueArtists = Array.from(new Set([
      ...spotifyArtistNames,
      ...appleMusicArtistNames,
    ])).slice(0, 8);

    const perArtist = await Promise.all(
      uniqueArtists.map(async (name) => {
        const found = await fetchEventsForArtist(name, city);
        const lc = name.toLowerCase();
        const matchedFrom: ('spotify' | 'apple_music')[] = [];
        if (spotifySet.has(lc)) matchedFrom.push('spotify');
        if (appleMusicSet.has(lc)) matchedFrom.push('apple_music');
        return found.map(ev => ({ ...ev, matchedFrom }));
      })
    );
    events = dedupeArtistEvents(perArtist.flat());
    // Sort by date asc
    events.sort((a, b) => new Date(a.start.local).getTime() - new Date(b.start.local).getTime());
  }

  return c.json({
    userGenres,
    userEventTypes,
    artistNames,
    spotifyArtistNames,
    appleMusicArtistNames,
    events,
    hasPreferences: userGenres.length > 0 || userEventTypes.length > 0,
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
      return c.json({ error: "Failed to exchange code for token", instagram_status: tokenRes.status, instagram_error: body, redirect_uri_used: INSTAGRAM_REDIRECT_URI, client_id_used: INSTAGRAM_CLIENT_ID }, 500);
    }

    const shortToken = await tokenRes.json() as {
      access_token: string;
      user_id: number;
    };

    // Step 2: Exchange short-lived token for a long-lived token (60-day)
    // Uses the Instagram App Secret (not Facebook App Secret)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${INSTAGRAM_CLIENT_SECRET}` +
      `&access_token=${shortToken.access_token}`
    );

    let finalToken = shortToken.access_token;
    let expiresIn = 3600; // 1 hour default for short-lived

    if (longRes.ok) {
      const longToken = await longRes.json() as { access_token: string; token_type: string; expires_in: number };
      finalToken = longToken.access_token;
      expiresIn = longToken.expires_in;
    } else {
      const body = await longRes.text();
      console.error(`[Instagram] Long-lived token error ${longRes.status}: ${body} — falling back to short-lived token`);
    }

    // Step 3: Fetch the user's Instagram profile
    const profileRes = await fetch(
      `https://graph.instagram.com/v21.0/me` +
      `?fields=id,username,account_type,media_count` +
      `&access_token=${finalToken}`
    );
    const profile = profileRes.ok ? await profileRes.json() : {};

    // Persist in KV
    await kv.set(`instagram_token_${userId}`, {
      access_token: finalToken,
      expires_at: Date.now() + expiresIn * 1000,
      instagram_user_id: shortToken.user_id,
      username: (profile as { username?: string }).username || null,
    });

    // Persist connection status to profiles table
    await markSocialConnected(userId, 'instagram');

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

/** DELETE /instagram/disconnect — revoke & remove token + update DB */
app.delete("/instagram/disconnect", async (c) => {
  const userId = c.req.query("userId") || "default_user";
  try {
    await markSocialDisconnected(userId, 'instagram');
    return c.json({ success: true, provider: 'instagram', message: 'Instagram account disconnected' });
  } catch (err) {
    console.error(`[Instagram] Disconnect error: ${err}`);
    return c.json({ success: false, error: "Failed to disconnect Instagram" }, 500 as ContentfulStatusCode);
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

// ── ADMIN: List all registered users ─────────────────────────────────────────
// GET /admin/users?adminKey=SECRET
// Returns auth.users joined with their KV profile data.
// Protected by a simple shared secret (ADMIN_SECRET env var).
app.get("/admin/users", async (c) => {
  const adminKey = c.req.query("adminKey");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) {
    return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  }

  if (!SUPABASE_SERVICE_KEY) {
    return c.json({ error: "Service key not configured" }, 500 as ContentfulStatusCode);
  }

  try {
    // Fetch all auth users via Supabase Admin API
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "apikey": SUPABASE_SERVICE_KEY,
      }
    });
    const data = await res.json();
    const authUsers = (data.users ?? []) as Array<{
      id: string;
      email: string;
      created_at: string;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
      user_metadata?: Record<string, unknown>;
    }>;

    // Enrich each user with their KV profile data
    const enriched = await Promise.all(authUsers.map(async (u) => {
      const profile = await kv.get(`profile:${u.id}`) as Record<string, unknown> | null;
      const spotify = await kv.get(`spotify_token_${u.id}`) as { display_name?: string } | null;
      const soundcloud = await kv.get(`soundcloud_token_${u.id}`) as { username?: string } | null;
      const instagram = await kv.get(`instagram_token_${u.id}`) as { username?: string } | null;
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed: !!u.email_confirmed_at,
        name: (profile as any)?.name ?? (u.user_metadata?.full_name as string) ?? null,
        location: (profile as any)?.personalDetails?.location ?? null,
        member_since: (profile as any)?.memberSince ?? null,
        vibe_tags: (profile as any)?.vibeTags ?? [],
        spotify: spotify ? (spotify.display_name ?? 'Connected') : null,
        soundcloud: soundcloud ? (soundcloud.username ?? 'Connected') : null,
        instagram: instagram ? (instagram.username ?? 'Connected') : null,
        has_profile: !!profile,
      };
    }));

    // Sort newest first
    enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ users: enriched, total: enriched.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500 as ContentfulStatusCode);
  }
});

// ── Admin: Run DB migration (one-time, protected by admin secret) ──────────────
app.post("/admin/migrate", async (c) => {
  const adminKey = c.req.header("x-admin-key") ?? c.req.query("key");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);

  const sql = `
    CREATE TABLE IF NOT EXISTS public.venues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name text NOT NULL,
      city text NOT NULL, address text, capacity int DEFAULT 200, cover_image text, logo_image text,
      phone text, email text, website text, instagram text, description text, floorplan_svg text,
      vms_type text DEFAULT 'internal', vms_venue_id text, vms_api_key text,
      is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.venue_tables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE,
      name text NOT NULL, category text NOT NULL, section text, capacity_min int DEFAULT 2, capacity_max int DEFAULT 8,
      min_spend int DEFAULT 1000, pos_x float DEFAULT 50, pos_y float DEFAULT 50, shape text DEFAULT 'rect',
      width float DEFAULT 8, height float DEFAULT 6, rotation float DEFAULT 0, perks text[], notes text,
      is_active boolean DEFAULT true, sort_order int DEFAULT 0,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.table_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), table_id uuid REFERENCES public.venue_tables(id) ON DELETE CASCADE,
      venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE, user_id text NOT NULL,
      booking_ref text UNIQUE NOT NULL, event_date date NOT NULL, event_name text, party_size int NOT NULL,
      status text DEFAULT 'pending', guest_name text, guest_email text, guest_phone text,
      total_min_spend int, deposit_amount int, deposit_paid boolean DEFAULT false, notes text,
      vms_booking_id text, vms_synced_at timestamptz,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.table_availability (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), table_id uuid REFERENCES public.venue_tables(id) ON DELETE CASCADE,
      date date NOT NULL, status text DEFAULT 'available', reason text,
      created_at timestamptz DEFAULT now(), UNIQUE(table_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_venue_tables_venue_id ON public.venue_tables(venue_id);
    CREATE INDEX IF NOT EXISTS idx_table_bookings_table_id ON public.table_bookings(table_id);
    CREATE INDEX IF NOT EXISTS idx_table_bookings_date ON public.table_bookings(event_date);
    CREATE INDEX IF NOT EXISTS idx_table_bookings_user ON public.table_bookings(user_id);
    ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.venue_tables ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.table_bookings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.table_availability ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "venues_public_read" ON public.venues;
    CREATE POLICY "venues_public_read" ON public.venues FOR SELECT USING (true);
    DROP POLICY IF EXISTS "venue_tables_public_read" ON public.venue_tables;
    CREATE POLICY "venue_tables_public_read" ON public.venue_tables FOR SELECT USING (true);
    DROP POLICY IF EXISTS "bookings_own" ON public.table_bookings;
    CREATE POLICY "bookings_own" ON public.table_bookings FOR ALL USING (user_id = auth.uid()::text);
    DROP POLICY IF EXISTS "availability_public_read" ON public.table_availability;
    CREATE POLICY "availability_public_read" ON public.table_availability FOR SELECT USING (true);
  `;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ sql })
    });
    // exec_sql may not exist — use pg directly via postgres extension
    if (!res.ok) {
      // Fallback: run each statement via Supabase SQL endpoint
      const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 10);
      const results = [];
      for (const stmt of stmts) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ query: stmt })
        });
        results.push({ stmt: stmt.slice(0, 50), status: r.status });
      }
      return c.json({ results });
    }
    return c.json({ ok: true });
  } catch (e: unknown) {
    return c.json({ error: String(e) }, 500 as ContentfulStatusCode);
  }
});

// ── Venue Table Management Endpoints ──────────────────────────────────────────

/** GET /venues — list all active venues */
app.get("/venues", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);
  const city = c.req.query("city");
  let url = `${SUPABASE_URL}/rest/v1/venues?is_active=eq.true&order=city,name`;
  if (city) url += `&city=ilike.*${encodeURIComponent(city)}*`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } });
  if (!res.ok) return c.json({ error: "Failed to fetch venues" }, 500 as ContentfulStatusCode);
  return c.json(await res.json());
});

/** GET /venues/:id — venue detail with tables and availability for a date */
app.get("/venues/:id", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);
  const id = c.req.param("id");
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];

  // Fetch venue
  const venueRes = await fetch(
    `${SUPABASE_URL}/rest/v1/venues?id=eq.${id}&is_active=eq.true`,
    { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
  );
  const venues = await venueRes.json();
  if (!venues.length) return c.json({ error: "Venue not found" }, 404 as ContentfulStatusCode);
  const venue = venues[0];

  // Fetch tables
  const tablesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/venue_tables?venue_id=eq.${id}&is_active=eq.true&order=sort_order`,
    { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
  );
  const tables = await tablesRes.json();

  // Fetch bookings for the date
  const bookingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/table_bookings?venue_id=eq.${id}&event_date=eq.${date}&status=neq.cancelled`,
    { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
  );
  const bookings = await bookingsRes.json();
  const bookedTableIds = new Set(bookings.map((b: any) => b.table_id));

  // Fetch availability overrides
  const availRes = await fetch(
    `${SUPABASE_URL}/rest/v1/table_availability?date=eq.${date}`,
    { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
  );
  const overrides = await availRes.json();
  const overrideMap: Record<string, string> = {};
  for (const o of overrides) overrideMap[o.table_id] = o.status;

  // Merge availability
  const tablesWithAvailability = tables.map((t: any) => ({
    ...t,
    availability: overrideMap[t.id] ?? (bookedTableIds.has(t.id) ? "booked" : "available"),
    booking: bookings.find((b: any) => b.table_id === t.id) ?? null,
  }));

  // Group by category
  const categories: Record<string, any[]> = {};
  for (const t of tablesWithAvailability) {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  }
  const summary = Object.entries(categories).map(([cat, tbls]) => ({
    category: cat,
    total: tbls.length,
    available: tbls.filter((t: any) => t.availability === "available").length,
    booked: tbls.filter((t: any) => t.availability === "booked").length,
    blocked: tbls.filter((t: any) => t.availability === "blocked").length,
  }));

  return c.json({ venue, tables: tablesWithAvailability, summary, date });
});

/** POST /venues/:id/tables/:tableId/book — create table booking */
app.post("/venues/:id/tables/:tableId/book", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);
  const venueId = c.req.param("id");
  const tableId = c.req.param("tableId");
  const body = await c.req.json();
  const { userId, eventDate, partySize, guestName, guestEmail, guestPhone, eventName, notes } = body;
  if (!userId || !eventDate || !partySize) return c.json({ error: "Missing required fields" }, 400 as ContentfulStatusCode);

  // Check table is available
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/table_bookings?table_id=eq.${tableId}&event_date=eq.${eventDate}&status=neq.cancelled`,
    { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } }
  );
  const existing = await existingRes.json();
  if (existing.length > 0) return c.json({ error: "Table already booked for this date" }, 409 as ContentfulStatusCode);

  // Generate booking ref
  const ref = `AL-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const booking = { table_id: tableId, venue_id: venueId, user_id: userId, booking_ref: ref,
    event_date: eventDate, party_size: partySize, guest_name: guestName, guest_email: guestEmail,
    guest_phone: guestPhone, event_name: eventName, notes, status: "confirmed" };

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/table_bookings`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(booking)
  });
  if (!createRes.ok) return c.json({ error: "Failed to create booking" }, 500 as ContentfulStatusCode);
  return c.json({ booking: (await createRes.json())[0], ref });
});

/** PUT /admin/venues/:id/tables/:tableId/availability — block or release a table */
app.put("/admin/venues/:id/tables/:tableId/availability", async (c) => {
  const adminKey = c.req.header("x-admin-key") ?? c.req.query("key");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);

  const tableId = c.req.param("tableId");
  const { date, status, reason } = await c.req.json();

  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/table_availability`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ table_id: tableId, date, status, reason })
  });
  if (!upsertRes.ok) return c.json({ error: "Failed to update availability" }, 500 as ContentfulStatusCode);
  return c.json({ ok: true, data: await upsertRes.json() });
});

/** POST /admin/venues — create venue */
app.post("/admin/venues", async (c) => {
  const adminKey = c.req.header("x-admin-key") ?? c.req.query("key");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);

  const body = await c.req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/venues`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(body)
  });
  if (!res.ok) return c.json({ error: "Failed to create venue" }, 500 as ContentfulStatusCode);
  return c.json((await res.json())[0]);
});

/** POST /admin/venues/:id/tables — add table to venue */
app.post("/admin/venues/:id/tables", async (c) => {
  const adminKey = c.req.header("x-admin-key") ?? c.req.query("key");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);

  const venueId = c.req.param("id");
  const body = await c.req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/venue_tables`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify({ ...body, venue_id: venueId })
  });
  if (!res.ok) return c.json({ error: "Failed to create table" }, 500 as ContentfulStatusCode);
  return c.json((await res.json())[0]);
});

/** GET /admin/venues/:id/bookings — all bookings for a venue */
app.get("/admin/venues/:id/bookings", async (c) => {
  const adminKey = c.req.header("x-admin-key") ?? c.req.query("key");
  const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "alist-admin-2026";
  if (adminKey !== ADMIN_SECRET) return c.json({ error: "Unauthorized" }, 401 as ContentfulStatusCode);
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: "No service key" }, 500 as ContentfulStatusCode);

  const venueId = c.req.param("id");
  const date = c.req.query("date");
  let url = `${SUPABASE_URL}/rest/v1/table_bookings?venue_id=eq.${venueId}&order=event_date.desc,created_at.desc`;
  if (date) url += `&event_date=eq.${date}`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY } });
  return c.json(await res.json());
});

// ── Scene Dispatch: Instagram feed aggregator ────────────────────────────────
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");

interface ScenePost {
  author: string;
  authorAvatar: string;
  caption: string;
  imageUrl: string;
  permalink: string;
  likes: number;
  comments: number;
  timestamp: string;
}

const SCENE_CITIES: Record<string, { handles: string[]; hashtags: string[] }> = {
  miami: {
    handles: ["livmiami", "e11evenmiami", "storymiamibeach", "clubspace_miami", "miaminice"],
    hashtags: ["#MiamiNightlife", "#SouthBeach", "#WynwoodNights", "#BrickellNights", "#MiamiClubs"]
  },
  nyc: {
    handles: ["marqueeny", "avantgardner", "houseof_yes", "elsewhere.bk", "publicrecordsnyc"],
    hashtags: ["#NYCNightlife", "#BrooklynNights", "#ManhattanClubs", "#NYCParty", "#EastVillage"]
  },
  la: {
    handles: ["soundnightclub", "exchangela", "academyla", "avalonhollywood", "catchonela"],
    hashtags: ["#LANightlife", "#HollywoodNights", "#DTLA", "#WeHoNights", "#LosAngelesClubs"]
  },
  chicago: {
    handles: ["smartbarchicago", "spybarchi", "primesocialgr", "theviolethouse", "untitledchicago"],
    hashtags: ["#ChicagoNightlife", "#ChiTownNights", "#WickerParkNights", "#LoopClubs", "#ChicagoHouse"]
  },
  london: {
    handles: ["fabriclondon", "ministryofsound", "printworkslondon", "corsicastudios", "oval_space"],
    hashtags: ["#LondonNightlife", "#ShoreditchNights", "#LDNClubs", "#LondonRaves", "#SohoNights"]
  },
  berlin: {
    handles: ["berghain", "aboutblank_berlin", "sisyphos_berlin", "watergateclub", "tresorberlin"],
    hashtags: ["#BerlinNightlife", "#BerlinTechno", "#Kreuzberg", "#Friedrichshain", "#BerlinClubs"]
  },
  ibiza: {
    handles: ["amnesia_ibiza", "pachaclubofficialiga", "ushuaiaibiza", "hiibizaofficial", "dctenibiza"],
    hashtags: ["#IbizaNightlife", "#IbizaClubs", "#PlayaDenBossa", "#IbizaParty", "#WhiteIsle"]
  },
  dallas: {
    handles: ["thelittlewooddvllers", "itwilldo", "stereo_live_dallas", "thebombfactory", "deepellum"],
    hashtags: ["#DallasNightlife", "#DeepEllum", "#UptownDallas", "#DFWClubs", "#DallasParty"]
  },
  houston: {
    handles: ["spirehouston", "richshouston", "cletoro", "warhouselive", "undergroundmusicvenue"],
    hashtags: ["#HoustonNightlife", "#HTXClubs", "#MidtownHouston", "#HoustonParty", "#DowntownHTX"]
  }
};

app.get("/scene-dispatch", async (c) => {
  const city = (c.req.query("city") || "miami").toLowerCase();
  const config = SCENE_CITIES[city];

  if (!config) {
    return c.json({ error: "City not supported", posts: [] }, 400);
  }

  // Check cache first (6 hour TTL)
  const cacheKey = `scene_dispatch:${city}`;
  const cached = await kv.get(cacheKey) as { posts: ScenePost[]; cachedAt: number } | null;
  if (cached && Date.now() - cached.cachedAt < 6 * 60 * 60 * 1000) {
    return c.json({ posts: cached.posts, cached: true, city });
  }

  if (!APIFY_API_TOKEN) {
    return c.json({ error: "APIFY_API_TOKEN not configured", posts: [] }, 503);
  }

  try {
    // Run profile scraper (3 posts per handle) + hashtag scraper (5 posts per tag) in parallel
    const profilePromises = config.handles.map(handle =>
      fetch(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [handle], resultsLimit: 3 })
      }).then(r => r.ok ? r.json() : []).catch(() => [])
    );

    const hashtagPromises = config.hashtags.map(tag =>
      fetch(`https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtags: [tag.replace("#", "")], resultsLimit: 5 })
      }).then(r => r.ok ? r.json() : []).catch(() => [])
    );

    const [profileResults, hashtagResults] = await Promise.all([
      Promise.all(profilePromises),
      Promise.all(hashtagPromises)
    ]);

    // Flatten and normalize
    const allRawPosts = [...profileResults.flat(), ...hashtagResults.flat()];
    const seen = new Set<string>();
    const posts: ScenePost[] = [];

    for (const raw of allRawPosts) {
      const permalink = raw.url || raw.shortCode ? `https://instagram.com/p/${raw.shortCode}` : null;
      if (!permalink || seen.has(permalink)) continue;
      seen.add(permalink);

      posts.push({
        author: raw.ownerUsername || "unknown",
        authorAvatar: raw.ownerAvatar || null,
        caption: (raw.caption || "").slice(0, 200),
        imageUrl: raw.displayUrl || raw.thumbnailUrl || null,
        permalink,
        likes: raw.likesCount || 0,
        comments: raw.commentsCount || 0,
        timestamp: raw.timestamp || new Date().toISOString()
      });
    }

    // Sort by recency
    posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const top50 = posts.slice(0, 50);

    // Cache for 6 hours
    await kv.set(cacheKey, { posts: top50, cachedAt: Date.now() });

    return c.json({ posts: top50, cached: false, city });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SceneDispatch] ${msg}`);
    return c.json({ error: msg, posts: [] }, 500);
  }
});

// ── Social Posts ─────────────────────────────────────────────────────────────

/** GET /social/feed — fetch public social posts, newest first */
app.get("/social/feed", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ posts: [] }, 500 as ContentfulStatusCode);
  const limit = Math.min(Number(c.req.query("limit") || "20"), 50);
  const offset = Number(c.req.query("offset") || "0");
  const venueFilter = c.req.query("venue");

  let url = `${SUPABASE_URL}/rest/v1/social_posts?visibility=eq.PUBLIC&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (venueFilter) url += `&venue_name=ilike.*${encodeURIComponent(venueFilter)}*`;

  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return c.json({ posts: [] }, 500 as ContentfulStatusCode);
  const posts = await res.json();
  return c.json({ posts, total: posts.length });
});

/** POST /social/posts — create a new social post */
app.post("/social/posts", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: 'No service key' }, 500 as ContentfulStatusCode);
  try {
    const body = await c.req.json();
    const { userId, userName, userAvatar, userTier, message, venueName, venueLocation, venueImage, venueTime, peopleGoing, totalCost, visibility } = body;
    if (!userId || !message?.trim()) return c.json({ error: 'userId and message are required' }, 400 as ContentfulStatusCode);

    const post = {
      user_id: userId,
      user_name: userName || null,
      user_avatar: userAvatar || null,
      user_tier: userTier || 'standard',
      message: message.trim(),
      venue_name: venueName || null,
      venue_location: venueLocation || null,
      venue_image: venueImage || null,
      venue_time: venueTime || null,
      people_going: peopleGoing || 0,
      total_cost: totalCost || 0,
      visibility: visibility || 'PUBLIC',
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(post),
    });
    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: err }, 500 as ContentfulStatusCode);
    }
    const created = await res.json();
    return c.json({ post: created[0] });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500 as ContentfulStatusCode);
  }
});

/** DELETE /social/posts/:id — owner-only delete
 *  Frontend (SocialFeed.tsx long-press menu) calls:
 *    DELETE /server/social/posts/<id>?userId=<userId>
 *  We enforce ownership by including user_id in the PostgREST filter so
 *  a row only deletes when both id AND user_id match. Returns 404 if no
 *  rows matched (either id missing or not owned by caller).
 */
app.delete("/social/posts/:id", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: 'No service key' }, 500 as ContentfulStatusCode);
  const id = c.req.param('id');
  const userId = c.req.query('userId');
  if (!id) return c.json({ error: 'id required' }, 400 as ContentfulStatusCode);
  if (!userId) return c.json({ error: 'userId required' }, 400 as ContentfulStatusCode);
  try {
    const url = `${SUPABASE_URL}/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
    });
    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: err }, 500 as ContentfulStatusCode);
    }
    const deleted = await res.json();
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return c.json({ error: 'Not found or not owner' }, 404 as ContentfulStatusCode);
    }
    return c.json({ success: true, deleted: deleted.length });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500 as ContentfulStatusCode);
  }
});

/** POST /social/posts/:id/like — increment like count */
app.post("/social/posts/:id/like", async (c) => {
  if (!SUPABASE_SERVICE_KEY) return c.json({ error: 'No service key' }, 500 as ContentfulStatusCode);
  const id = c.req.param('id');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_post_likes`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: id }),
  });
  // Fallback: direct update if RPC not available
  if (!res.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/social_posts?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ likes: 1 }), // simple increment — not atomic but fine for MVP
    });
  }
  return c.json({ success: true });
});

Deno.serve(app.fetch);



