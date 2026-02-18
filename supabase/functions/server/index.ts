import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";

const app = new Hono().basePath("/server");

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");
const SPOTIFY_REDIRECT_URI = Deno.env.get("SPOTIFY_REDIRECT_URI") || "https://localhost:3000/spotify/callback";

// SoundCloud OAuth configuration
const SOUNDCLOUD_CLIENT_ID = Deno.env.get("SOUNDCLOUD_CLIENT_ID");
const SOUNDCLOUD_CLIENT_SECRET = Deno.env.get("SOUNDCLOUD_CLIENT_SECRET");
const SOUNDCLOUD_REDIRECT_URI = Deno.env.get("SOUNDCLOUD_REDIRECT_URI") || "https://localhost:3000/soundcloud/callback";

// Instagram OAuth configuration
const INSTAGRAM_CLIENT_ID = Deno.env.get("INSTAGRAM_CLIENT_ID");
const INSTAGRAM_CLIENT_SECRET = Deno.env.get("INSTAGRAM_CLIENT_SECRET");
const INSTAGRAM_REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI") || "https://localhost:3000/instagram/callback";

// Eventbrite configuration
const EVENTBRITE_API_KEY = Deno.env.get("EVENTBRITE_API_KEY") || "VUASYGB2SRP4JRPDCR";

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
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
    console.log("Spotify login error: SPOTIFY_CLIENT_ID not configured");
    return c.json({ error: "Spotify client ID not configured" }, 500);
  }

  const scopes = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "playlist-read-private"
  ].join(" ");

  const state = userId; // Use userId as state to identify user after callback

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
  const state = c.req.query("state"); // This is the userId
  const error = c.req.query("error");

  if (error) {
    console.log(`Spotify callback error: ${error}`);
    return c.json({ error: `Spotify authorization failed: ${error}` }, 400);
  }

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.log("Spotify callback error: Client credentials not configured");
    return c.json({ error: "Spotify credentials not configured" }, 500);
  }

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
      console.log(`Spotify token exchange error: ${tokenResponse.status} - ${error}`);
      return c.json({ error: "Failed to exchange code for token" }, tokenResponse.status);
    }

    const tokenData = await tokenResponse.json();

    // Store tokens in KV store with userId as key
    await kv.set(`spotify_token_${state}`, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      scope: tokenData.scope
    });

    return c.json({
      success: true,
      message: "Spotify connected successfully",
      userId: state
    });
  } catch (error) {
    console.log(`Spotify callback processing error: ${error.message}`);
    return c.json({ error: `Failed to process Spotify callback: ${error.message}` }, 500);
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

// Eventbrite Events Endpoint
app.get("/eventbrite/events", async (c) => {
  const city = c.req.query("city");
  const lat = c.req.query("lat");
  const lon = c.req.query("lon");
  const query = c.req.query("q");
  const categories = c.req.query("categories");
  const sortBy = c.req.query("sort_by");

  const locationName = city || "Miami";

  // Try Eventbrite API first
  if (EVENTBRITE_API_KEY) {
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
        const realEvents = data.events || [];
        if (realEvents.length > 0) {
          return c.json(realEvents);
        }
      }
    } catch (error) {
      console.error(`Eventbrite fetch error: ${error.message}`);
    }
  }

  // Fallback: return curated events
  console.log(`Returning curated events for: ${locationName}`);
  return c.json(generateCuratedEvents(locationName, query || undefined));
});

// OpenAI Configuration
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// OpenAI Chat - AI Concierge
app.post("/chat", async (c) => {
  if (!OPENAI_API_KEY) {
    return c.json({
      message: "I am Agent-X. Please configure my OpenAI API Key to unlock full intelligence. (Mock Response)",
      tiles: []
    });
  }

  try {
    const { message, conversationHistory, location } = await c.req.json();

    // Construct system prompt with location awareness
    let systemPrompt = "You are Agent-X, an elite nightlife concierge. Your tone is sophisticated, insider, and professional. You have access to exclusive inventory and trends. Keep responses concise and high-value.";
    if (location) {
      systemPrompt += ` The user is currently at coordinates: ${location.lat}, ${location.lng}.`;
    }
    systemPrompt += " RESTRICTION: You MUST return a valid JSON object with detailed structure. Format: { \"message\": \"Your conversational response here\", \"tiles\": [ { \"name\": \"Venue Name\", \"type\": \"Club|Bar|Lounge\", \"description\": \"Short vibe description\", \"imageUrl\": \"keywords for unsplash\", \"priceRange\": \"$$$\", \"bookingEnabled\": true } ] }. Return empty array for tiles if no recommendations.";

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // Parse the JSON content from the model
    let parsedContent;
    try {
      parsedContent = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error("Failed to parse OpenAI JSON:", data.choices[0].message.content);
      // Fallback if model fails to return JSON
      parsedContent = { message: data.choices[0].message.content, tiles: [] };
    }

    return c.json(parsedContent);
  } catch (error) {
    console.error("OpenAI error:", error);
    return c.json({ message: "I'm currently recalibrating my neural network. Please try again briefly.", tiles: [] });
  }
});

// SoundCloud OAuth
app.get("/soundcloud/login", (c) => {
  const userId = c.req.query("userId");

  if (!SOUNDCLOUD_CLIENT_ID) {
    return c.json({ error: "SoundCloud Client ID not configured" }, 500);
  }

  const authUrl = `https://secure.soundcloud.com/connect?client_id=${SOUNDCLOUD_CLIENT_ID}&redirect_uri=${encodeURIComponent(SOUNDCLOUD_REDIRECT_URI)}&response_type=code&state=${userId}`;

  return c.json({ authUrl });
});

// Profile Endpoint (Mock/KV)
app.get("/profile", async (c) => {
  const userId = c.req.query("userId");
  // In a real app, verify auth token. For now, return mock profile augmented with KV data.

  const defaultProfile = {
    name: 'Alex Rivera',
    username: '@alexrivera',
    tier: 'Platinum',
    points: 8450,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=200&h=200",
    stats: { sessions: 12, hostScore: 98, socialScore: 850 }
  };

  // Try to get from KV if implemented, else return default
  return c.json(defaultProfile);
});

// Instagram Mock (for completeness)
app.get("/instagram/media", (c) => {
  return c.json({ data: [] });
});
app.get("/instagram/login", (c) => c.json({ authUrl: "https://instagram.com" })); // Placeholder

Deno.serve(app.fetch);
