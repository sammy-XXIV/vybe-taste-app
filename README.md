# Vybe — Cross-Domain Taste Discovery

> Connect Spotify. Vybe reads your top artists and maps your cultural DNA across dining, travel, film, brands, books, and games — connections no single platform makes.

Built for the **Qloo Agentic Hackathon 2026**.

**Live**: https://qloo-taste-agent.vercel.app  
**Demo** (no Spotify): https://qloo-taste-agent.vercel.app/?demo=1

---

## How It Works

1. User connects Spotify via OAuth (`user-top-read` scope)
2. App fetches top 10 artists from Spotify API
3. Top 5 artists are resolved to Qloo entity IDs via `/search`
4. Qloo `/v2/insights` runs in parallel for 7 output domains
5. Results render as cards grouped by domain — click **+ Add to taste** on any card to add it as a signal and refine recommendations live
6. Click **✦ Plan Weekend** to synthesize your matched Travel city, dining spots, films, TV, books, games, and brands into a 48-hour cultural itinerary via `/api/plan`
7. Cache written to `localStorage` — instant load on return visits

### Demo Mode
Append `?demo=1` to skip Spotify auth. Seeds with: Kendrick Lamar, Frank Ocean, Tyler The Creator, SZA, Travis Scott — calls real Qloo API.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router (TypeScript) |
| Auth | NextAuth.js v4 + SpotifyProvider |
| Taste API | Qloo Taste AI (`hackathon.api.qloo.com`) |
| Animation | GSAP 3 (wave / glitch / reveal) |
| Fonts | Bebas Neue + Inter via `next/font/google` |
| Styling | CSS custom properties (no Tailwind runtime) |
| Deploy | Vercel (Edge-compatible) |

---

## Project Structure

```
app/
├── page.tsx                        # Main page — 3 phases: idle / loading / results
├── layout.tsx                      # Font loading, SessionProvider wrapper
├── globals.css                     # CSS tokens (colors, fonts)
├── providers.tsx                   # NextAuth SessionProvider (client)
├── components/
│   ├── SplitHeadline.tsx           # GSAP split-text: wave + glitch + reveal
│   ├── VybeLogo.tsx                # SVG logo (V-shape, red + indigo)
│   └── MotionCanvas.tsx            # Canvas particle field background
└── api/
    ├── auth/[...nextauth]/route.ts # NextAuth catch-all handler
    ├── search/route.ts             # GET — proxies Qloo /search
    ├── insights/route.ts           # POST — parallel Qloo /v2/insights per domain
    ├── plan/route.ts               # POST — 48-hour cultural itinerary from Qloo matches
    └── spotify/top-artists/route.ts# GET — Spotify /me/top/artists?limit=10

lib/
├── qloo.ts                         # Qloo API client (searchEntity, getInsights)
└── auth.ts                         # NextAuth config (JWT + session callbacks)

design-system/vybe/MASTER.md        # Persisted UI/UX design system
```

---

## Qloo API Usage

### Search (entity resolution)
```
GET /search?query=Kendrick+Lamar&type=urn:entity:artist&limit=5
→ { results: { entity_id, name, types[], ... }[] }
```

### Insights (cross-domain recommendations)
```
GET /v2/insights?filter.type=urn:entity:place&limit=8&signal.interests.entities=<entity_id_1>&signal.interests.entities=<entity_id_2>
→ { results: { entities: { entity_id, name, properties }[] } }
```

Output domains queried in parallel:
- `urn:entity:place` — Restaurants / venues
- `urn:entity:destination` — Travel destinations
- `urn:entity:movie` — Films
- `urn:entity:tv_show` — TV shows
- `urn:entity:brand` — Brands
- `urn:entity:book` — Books
- `urn:entity:videogame` — Games

---

## Local Development

### Prerequisites
- Node.js 18+
- Spotify Developer App with redirect URI set
- Qloo hackathon API key

### Setup

```bash
git clone https://github.com/sammy-XXIV/vybe-taste-app
cd vybe-taste-app
npm install
```

Create `.env.local`:
```env
QLOO_API_KEY=your_qloo_key
QLOO_BASE_URL=https://hackathon.api.qloo.com

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback/spotify

NEXTAUTH_SECRET=any_random_string
NEXTAUTH_URL=http://localhost:3000
```

```bash
npm run dev
# → http://localhost:3000
# → http://localhost:3000/?demo=1  (no Spotify needed)
```

### Spotify App Settings
In [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), add redirect URIs:
- `http://localhost:3000/api/auth/callback/spotify` (dev)
- `https://qloo-taste-agent.vercel.app/api/auth/callback/spotify` (prod)

---

## Deployment (Vercel)

```bash
npx vercel --prod
```

Set these env vars in Vercel dashboard or via CLI:
```
QLOO_API_KEY
QLOO_BASE_URL
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_REDIRECT_URI=https://<your-domain>/api/auth/callback/spotify
NEXTAUTH_SECRET
NEXTAUTH_URL=https://<your-domain>
```

---

## Animation System

`SplitHeadline` splits each line into `<span>` per character, then applies one of three GSAP effects:

| Effect | Behavior |
|--------|----------|
| `wave` | Letters ripple in via sine-based stagger (`back.out(2)`) |
| `glitch` | Letters scramble with random chars, snap to real text on complete |
| `reveal` | Clip-mask slide up (`expo.out`) — overflow hidden on line |

Glitch fix: `realChars[]` captured before timeline runs, `done` flag prevents `onUpdate` from overwriting after `onComplete`.

Reduced motion: all GSAP effects skip when `prefers-reduced-motion: reduce`.

---

## Caching

Results stored in `localStorage` under key `vybe_insights_cache`:
```json
{
  "insights": [{ "domain": "...", "type": "...", "entities": [] }],
  "artists": [{ "id": "...", "name": "...", "images": [], "genres": [] }]
}
```
On load, if cache exists → jump straight to results phase, skip Spotify + Qloo calls.
"Reset" button clears cache + signs out.

---

## Powered by Qloo Taste AI

Qloo's cross-domain taste graph links preferences across music, film, dining, travel, and more. This app uses it as the intelligence layer — Spotify provides the taste signal, Qloo provides the cross-domain mapping.
