import Link from "next/link";
import AppStoreBadge from "@/components/AppStoreBadge";
import SiteFooter from "@/components/SiteFooter";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/vto-virtual-try-on/id6769989598";

const steps = [
  {
    number: "1",
    title: "Take a selfie",
    description:
      "Snap a full-body photo or pick one from your library. Good lighting and a simple background work best.",
  },
  {
    number: "2",
    title: "Add a clothing item",
    description:
      "Photograph a garment, screenshot it while shopping, or pick a piece from your digital closet.",
  },
  {
    number: "3",
    title: "AI generates a preview",
    description:
      "Our AI service renders the garment onto your photo in seconds — realistic drape, fit, and lighting.",
  },
  {
    number: "4",
    title: "Style the result",
    description:
      "Save the look, compare outfits, get stylist suggestions, and build your favorite combinations.",
  },
];

const features = [
  {
    title: "AI Try-On",
    description:
      "See how any garment looks on you before you buy. Photorealistic previews generated from a single selfie and a garment photo.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.7 3.6L17.5 8l-3.8 1.4L12 13l-1.7-3.6L6.5 8l3.8-1.4z" />
        <path d="M18.5 14l.9 1.9 1.9.7-1.9.7-.9 1.9-.9-1.9-1.9-.7 1.9-.7z" />
        <path d="M6 15l.8 1.7 1.7.6-1.7.6L6 19.6l-.8-1.7-1.7-.6 1.7-.6z" />
      </svg>
    ),
  },
  {
    title: "AI Stylist",
    description:
      "Chat with a personal stylist that knows your closet. Get outfit ideas, color pairings, and advice for any occasion.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12c0 3.9-4 7-9 7-1 0-2-.1-2.9-.4L4 20l1.2-3.2C3.8 15.5 3 13.8 3 12c0-3.9 4-7 9-7s9 3.1 9 7z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
      </svg>
    ),
  },
  {
    title: "Fit Analysis",
    description:
      "Add your height and measurements to get size recommendations and see how a piece is likely to fit your body.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v4H4z" />
        <path d="M7 5v2M11 5v3M15 5v2M19 5v3" />
        <path d="M6 15h12M6 19h8" />
      </svg>
    ),
  },
  {
    title: "Digital Closet",
    description:
      "Keep every garment and generated look in one place. Organize your wardrobe and revisit past try-ons anytime.",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 4v16M3 12h18" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-foreground">
      {/* Header */}
      <header className="border-b border-card-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            VTO
            <span className="ml-2 text-sm font-normal text-accent-soft">
              Virtual Try-On
            </span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6 text-sm">
            <Link href="/support" className="text-muted transition-colors hover:text-white">
              Support
            </Link>
            <a
              href={APP_STORE_URL}
              className="rounded-full bg-white px-4 py-1.5 font-medium text-black transition-colors hover:bg-zinc-200"
            >
              Get the app
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(74,144,208,0.18),transparent_65%)]"
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-24 text-center sm:pt-32">
            <p className="mb-4 rounded-full border border-card-border bg-card px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Now on the App Store
            </p>
            <h1
              id="hero-heading"
              className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl"
            >
              Try it on before
              <br />
              you buy it.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              VTO uses AI to show you how any piece of clothing looks on you —
              from a single selfie. Preview outfits, get styling advice, and
              build your digital closet, all on your iPhone.
            </p>
            <div className="mt-10">
              <AppStoreBadge />
            </div>
            <p className="mt-6 text-xs text-muted">
              Free to use with 5 try-ons per day. Photos are processed securely
              by our AI service and never sold or used for advertising.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section
          aria-labelledby="how-heading"
          className="mx-auto max-w-5xl px-6 py-20"
        >
          <h2
            id="how-heading"
            className="text-center text-3xl font-bold tracking-tight text-white"
          >
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted">
            From selfie to styled look in four steps.
          </p>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-card-border bg-card p-6"
              >
                <span
                  aria-hidden="true"
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent"
                >
                  {step.number}
                </span>
                <h3 className="text-base font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-accent-soft/80">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section
          aria-labelledby="features-heading"
          className="border-y border-card-border/40 bg-[#050b12]"
        >
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2
              id="features-heading"
              className="text-center text-3xl font-bold tracking-tight text-white"
            >
              Everything your wardrobe needs
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-card-border bg-card p-7"
                >
                  <div className="mb-4 inline-flex rounded-xl bg-accent/15 p-3 text-accent">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Honest privacy note */}
        <section
          aria-labelledby="privacy-heading"
          className="mx-auto max-w-3xl px-6 py-20 text-center"
        >
          <h2
            id="privacy-heading"
            className="text-2xl font-bold tracking-tight text-white"
          >
            Honest about your photos
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            To generate a try-on, your photo and the garment image are sent
            over an encrypted connection to our AI processing partner and used
            only to render the result — no facial recognition, no biometric
            analysis, no ad profiling. Generated images are stored in your
            account until you delete them, and you can delete your account and
            all data at any time from inside the app.
          </p>
          <p className="mt-6">
            <Link
              href="/privacy"
              className="text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Read the full Privacy Policy
            </Link>
          </p>
        </section>

        {/* Final CTA */}
        <section
          aria-labelledby="cta-heading"
          className="border-t border-card-border/40"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
            <h2
              id="cta-heading"
              className="text-3xl font-bold tracking-tight text-white"
            >
              Your next outfit is one selfie away.
            </h2>
            <div className="mt-8">
              <AppStoreBadge />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
