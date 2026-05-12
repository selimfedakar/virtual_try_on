<<<<<<< HEAD
This is My "Virtual Try-On" Project

An end-to-end Virtual Try-On (VTO) system utilizing latent diffusion models to enable realistic garment transfer. This repository implements a robust asynchronous pipeline between a cross-platform mobile client and a serverless backend.

**Live Deployment:** [https://virtual-try-on-three-sage.vercel.app](https://virtual-try-on-three-sage.vercel.app)

---

## Technical Architecture

The system is designed to bypass the limitations of serverless environments when dealing with heavy AI inference:

* **Asynchronous Inference:** The Next.js API acts as an orchestrator, triggering the Replicate IDM-VTON model and immediately returning a session state.
* **State Management:** Supabase serves as the single source of truth. The mobile client polls or listens for status changes, ensuring a seamless UX during the 30-40 second generation cycle.
* **Monorepo Strategy:** Managed via a single repository with deployment optimized using `.vercelignore` to isolate Expo-specific dependency resolution from the Next.js build pipeline.

---

## Technology Stack

* **AI Engine:** Replicate (IDM-VTON / Latent Diffusion Models)
* **Mobile:** React Native & Expo (Managed Workflow)
* **Backend:** Next.js 14 (App Router), TypeScript
* **Database & Storage:** Supabase (PostgreSQL, Real-time, Storage)
* **Deployment:** Vercel (API & Web), EAS (Mobile)

---
## Project Structure

text
.
├── ai-vto-mobile/       # Expo / React Native Client
├── app/                 # Next.js App Router & Web UI
├── api/                 # AI Orchestration Logic
├── lib/                 # Shared Supabase & Replicate Clients
└── .vercelignore        # Monorepo Build Optimization

Backend (.env.local)
REPLICATE_API_TOKEN=your_token
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

Mobile (ai-vto-mobile/.env)
EXPO_PUBLIC_API_URL=[https://virtual-try-on-three-sage.vercel.app](https://virtual-try-on-three-sage.vercel.app)
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key

Install dependencies:
npm install
cd ai-vto-mobile && npm install

Run Web/API locally:
npm run dev

Run Mobile locally:
cd ai-vto-mobile
npx expo start
=======
# VTO — Virtual Try-On

A mobile app that lets you see how any garment looks on you before buying it. You upload a photo of yourself and a photo of the clothing — an AI diffusion model composites them into a photorealistic result.

Built end-to-end as a final-year project: backend, mobile, AI pipeline, and App Store submission. No shortcuts.

---

## How it works

```
person photo  +  garment image
          │
          ▼
  Next.js API  →  Replicate
                  IDM-VTON  (diffusion-based virtual try-on)
          │
          ▼
  generated image  (~5–15 seconds)
          │
          ├── shown immediately in the app
          └── downloaded → re-uploaded to Supabase Storage
               stored as permanent URL → Closet, Share tabs
```

The generation runs server-side through a Next.js API route. The mobile app polls until the result is ready, then displays it immediately while saving to Supabase in the background.

---

## Stack

| layer    | tech                                                  |
|----------|-------------------------------------------------------|
| mobile   | Expo 54, React Native 0.81, Expo Router (file-based)  |
| web      | Next.js 14, deployed on Vercel                        |
| backend  | Supabase — Postgres, Auth, Storage (RLS)              |
| AI model | Replicate — IDM-VTON                                  |
| build    | EAS Build + EAS Submit                                |

---

## Project structure

```
/                           Next.js web app (Vercel)
  src/app/
    page.tsx                landing page
    api/generate/route.ts   Replicate polling endpoint (server-side)
    privacy/page.tsx        privacy policy
  .env.example

ai-vto-mobile/              Expo React Native app (iOS)
  app/
    auth.tsx                sign in / sign up
    (tabs)/
      home.tsx              try-on: pick photos → generate → save
      analysis.tsx          fit analysis
      history.tsx           closet — past generations grid
      stylist.tsx           AI stylist chat
      share.tsx             share a look
  src/lib/
    supabase.ts             client + session
    storage.ts              native binary upload to Supabase Storage
    savedPhotos.ts          camera roll helpers
    savedGarments.ts        local garment persistence
  .env.example
```

---

## Run locally

**Web**
```bash
npm install
cp .env.example .env.local
npm run dev
```

**Mobile**
```bash
cd ai-vto-mobile
npm install
cp .env.example .env
npx expo start
```

Environment variables:

```
# web
REPLICATE_API_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# mobile
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_BACKEND_URL=        # deployed Next.js URL
```

---

## Build & deploy

```bash
# web — push to main, Vercel auto-deploys

# iOS
eas build --platform ios --profile production
eas submit --platform ios
```

---

## Two things I learned the hard way

**1. `fetch().blob()` is broken on React Native.**
When you fetch a remote URL and call `.blob()`, React Native silently returns an empty blob. The upload to Supabase succeeds, the DB row is written, but the stored file is zero bytes. I spent hours thinking the issue was on the Supabase side before realizing the blob was always empty. Fix: use `FileSystem.downloadAsync` to save to a local cache file first, then `FileSystem.uploadAsync` with `BINARY_CONTENT` to send it natively without JS serialization.

**2. Replicate CDN URLs expire.**
Generated images are served from a Replicate CDN with roughly a one-hour TTL. If you store that URL in your database and open the app the next day, every image in your history is broken. The fix is immediate re-upload to your own storage — Supabase in this case — so the DB always holds a permanent URL. Not obvious until your closet tab goes blank.
>>>>>>> 4bbdb33 (docs: add project README with architecture, stack, and learning notes)
