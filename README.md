This is My "Virtual Try-On" Project

An end-to-end Virtual Try-On (VTO) system utilizing latent diffusion models to enable realistic garment transfer. This repository implements a robust asynchronous pipeline between a cross-platform mobile client and a serverless backend.

Live Deployment: https://virtual-try-on-three-sage.vercel.app

Technical Architecture
The system is designed to bypass the limitations of serverless environments (e.g., Vercel's 10-60s timeout) when dealing with heavy AI inference:

Asynchronous Inference: The Next.js API acts as an orchestrator. It triggers the Replicate IDM-VTON model and immediately returns a session state.

State Management: Supabase is used as the single source of truth. The mobile client polls or listens for status changes in the database, ensuring a seamless UX during the 30-40 second generation cycle.

Blob Storage Optimization: High-resolution user captures and AI-generated results are stored in Supabase Storage with optimized CDN delivery.

Monorepo Strategy: Both Web and Mobile codebases coexist. Deployment is optimized via .vercelignore to isolate Expo-specific dependency resolution from the Next.js build pipeline.

Technology Stack
AI Engine: Replicate (IDM-VTON / Stable Diffusion)

Mobile: React Native & Expo (Managed Workflow)

Backend: Next.js 14 (App Router), TypeScript

Database & Storage: Supabase (PostgreSQL, Real-time, Storage)

Deployment: Vercel (API & Web), EAS (Mobile)

Project Structure;
Plaintext
.
├── ai-vto-mobile/       # Expo / React Native Client
├── app/                 # Next.js App Router & Web UI
├── api/                 # AI Orchestration Logic
├── lib/                 # Shared Supabase & Replicate Clients
└── .vercelignore        # Monorepo Build Optimization
Environment Setup
Backend (.env.local)
Kod snippet'i
REPLICATE_API_TOKEN=your_token
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
Mobile (ai-vto-mobile/.env)
Kod snippet'i
EXPO_PUBLIC_API_URL=https://virtual-try-on-three-sage.vercel.app
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
Installation & Development
Install dependencies:

Bash
npm install
cd ai-vto-mobile && npm install
Run Web/API locally:

Bash
npm run dev
Run Mobile locally:

Bash
cd ai-vto-mobile
npx expo start
