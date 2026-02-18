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

// Eventbrite Events Endpoint
app.get("/eventbrite/events", async (c) => {
  const city = c.req.query("city");
  const lat = c.req.query("lat");
  const lon = c.req.query("lon");
  const query = c.req.query("q");
  const categories = c.req.query("categories");
  const sortBy = c.req.query("sort_by");

  // Use the constant defined at top of file
  if (!EVENTBRITE_API_KEY) {
    return c.json({ error: "Eventbrite API key not configured" }, 500);
  }

  let url = `https://www.eventbriteapi.com/v3/events/search/?token=${EVENTBRITE_API_KEY}&expand=venue`;

  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  }

  if (categories) {
    url += `&categories=${categories}`;
  }

  if (sortBy) {
    url += `&sort_by=${sortBy}`;
  }

  if (lat && lon) {
    url += `&location.latitude=${lat}&location.longitude=${lon}&location.within=20km`;
  } else if (city) {
    url += `&location.address=${encodeURIComponent(city)}`;
  } else {
    url += `&location.address=Miami`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Eventbrite error: ${response.status} - ${errorText}`);
      // Return dummy data on failure to avoid breaking UI during demo
      return c.json([]);
    }

    const data = await response.json();
    // Transform to match frontend expectations if needed, but for now return events
    return c.json(data.events || []);
  } catch (error) {
    console.error(`Eventbrite fetch error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
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
