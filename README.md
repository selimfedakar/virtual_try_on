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
