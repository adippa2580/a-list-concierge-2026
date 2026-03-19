# CLAUDE.md

## Project Overview

A-List is a luxury nightlife discovery and booking app. React 19 single-page frontend with Supabase backend (PostgreSQL + Deno edge functions). The design follows a minimalist high-fashion editorial aesthetic with a dark monochromatic palette.

## Tech Stack

- **Frontend**: React 19, TypeScript (strict), Vite 6, Tailwind CSS v4
- **Backend**: Supabase Edge Functions running Hono 4.7 on Deno
- **Database**: Supabase PostgreSQL with KV store abstraction
- **UI primitives**: Radix UI + Shadcn/UI + CVA (class-variance-authority)
- **Animation**: motion (Framer Motion successor)
- **Icons**: lucide-react
- **Notifications**: sonner (toast)
- **Drawer**: vaul

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

Edge functions (requires Supabase CLI):
```bash
supabase functions deploy server --project-ref <project-id>
```

## Project Structure

```
App.tsx                        # Root component — state-based view routing
main.tsx                       # React entry point
components/                    # Feature components (Home, AIConcierge, VenueDetail, etc.)
  ui/                          # Shadcn/UI primitives (button, dialog, drawer, input, etc.)
  figma/                       # Figma integration components (ImageWithFallback)
supabase/functions/server/
  index.ts                     # Hono API — all backend routes
  kv_store.ts                  # Supabase table-backed KV store utility
  deno.json                    # Deno config for edge functions
styles/globals.css             # Tailwind v4 theme + CSS custom properties
utils/supabase/info.tsx        # Supabase project ID and public anon key
.github/workflows/main.yml    # CI/CD pipeline
```

## Architecture

- **Routing**: No router library. `App.tsx` manages views via `useState` with view types like `home`, `vip`, `social`, `artists`, `venue`, `profile`, `inbox`, `ai-concierge`, etc.
- **State**: React `useState` + localStorage for persistence. Cross-component sync via `window.dispatchEvent(new Event('alist-favourites-updated'))` and `storage` event listeners.
- **API**: Hono server at `/server` base path. Frontend calls edge functions via `fetch()` with `Authorization: Bearer <publicAnonKey>`.
- **Auth**: Supabase Auth (`signInWithPassword`). Some flows use prototype-mode silent fallbacks.

## Coding Conventions

- **Exports**: Named exports only (no default exports)
- **Components**: PascalCase filenames and function names
- **Variables/functions**: camelCase
- **Constants**: UPPER_CASE (e.g., `FAV_KEY`, `CLUBS_KEY`)
- **Types/Interfaces**: PascalCase, defined at top of file before component
- **ClassNames**: Use `cn()` from `components/ui/utils.ts` (clsx + tailwind-merge)
- **Animations**: Use `motion` from `motion/react` with `AnimatePresence`
- **Notifications**: Use `toast()` from `sonner` — `toast.success()`, `toast.error()`, `toast.info()`
- **Imports**: Use `@/*` path alias for root-relative imports
- **TypeScript**: Strict mode. Error catching with `catch (error: unknown)` and type guard `error instanceof Error ? error.message : String(error)`
- **Client directive**: Files use `'use client'` at top

## Component Patterns

UI primitives live in `components/ui/` built on Radix UI + Tailwind:
- Variants via CVA: `buttonVariants`, `badgeVariants`
- Composed with `cn()` for conditional class merging
- Pattern: export component + variants separately

Feature components follow this structure:
```tsx
'use client';
import { icons } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props { ... }

export function ComponentName({ prop }: Props) { ... }
```

## Styling

- Tailwind v4 with `@import "tailwindcss"` in `styles/globals.css`
- CSS custom properties for theme colors (OKLch format): `--primary`, `--secondary`, `--accent`, etc.
- Fonts: Cormorant Garamond (serif headings), Inter (sans body)
- Dark luxury palette: deep blacks, platinum/emerald accents

## State Management Pattern

localStorage-first with event sync:
```tsx
// Read
const data = JSON.parse(localStorage.getItem('alist_key') || '[]');
// Write + notify
localStorage.setItem('alist_key', JSON.stringify(data));
window.dispatchEvent(new Event('alist-key-updated'));
// Listen
window.addEventListener('alist-key-updated', refresh);
window.addEventListener('storage', refresh); // cross-tab
```

## API Patterns (Edge Functions)

Hono routes in `supabase/functions/server/index.ts`:
```ts
const app = new Hono().basePath("/server");
app.use('*', logger(console.log));
app.use(cors(...));
app.get("/venue/search", async (c) => { ... });
app.post("/chat", async (c) => { ... });
```

Frontend calls:
```ts
const res = await fetch(
  `https://${projectId}.supabase.co/functions/v1/server/endpoint`,
  { headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' } }
);
```

## CI/CD

GitHub Actions (`.github/workflows/main.yml`) on push to `main`:
1. Deploy Supabase edge functions
2. Build frontend with Node.js v20

Required GitHub secrets: `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`
Optional: `APIFY_TOKEN`

## Key localStorage Keys

- `alist_favourite_venues` — saved venue list
- `alist_private_clubs` — user's private clubs
- `alist_member_event_count` — member event counter
- `alist_onboarding_done` — onboarding completion flag
- `alist_avatar_url` — user avatar URL
