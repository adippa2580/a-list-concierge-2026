import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

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
app.get("/make-server-82c84e62/spotify/login", (c) => {
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
app.get("/make-server-82c84e62/spotify/callback", async (c) => {
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

// ChatGPT and other endpoints omitted for brevity in this sync script, but full server file is present in project.
Deno.serve(app.fetch);
