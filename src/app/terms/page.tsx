import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of Use for the VTO Virtual Try-On iOS app, based on Apple's standard Licensed Application End User License Agreement.",
};

const CONTACT_EMAIL = "a.selimfedakar@gmail.com";
const EFFECTIVE_DATE = "July 7, 2026";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-foreground">
      <header className="border-b border-card-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-sm font-medium text-muted transition-colors hover:text-white"
          >
            ← Back to VTO
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Terms of Use
        </h1>
        <p className="mt-2 text-sm text-muted">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted">
          <section aria-labelledby="terms-eula">
            <h2 id="terms-eula" className="mb-2 text-lg font-bold text-white">
              1. License
            </h2>
            <p>
              Use of the VTO — Virtual Try-On iOS application is governed by
              Apple&apos;s standard{" "}
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                className="text-accent underline underline-offset-4"
              >
                Licensed Application End User License Agreement (EULA)
              </a>
              . By downloading or using the app you agree to that EULA and to
              the additional terms below.
            </p>
          </section>

          <section aria-labelledby="terms-use">
            <h2 id="terms-use" className="mb-2 text-lg font-bold text-white">
              2. Acceptable use
            </h2>
            <p>
              VTO is intended for virtually trying on clothing. You agree not
              to upload unlawful, sexually explicit, or abusive imagery, or
              photos of other people without their consent. We may suspend or
              terminate accounts that violate these rules. You must be at least
              13 years old to use VTO.
            </p>
          </section>

          <section aria-labelledby="terms-subs">
            <h2 id="terms-subs" className="mb-2 text-lg font-bold text-white">
              3. Subscriptions
            </h2>
            <p>
              Optional subscriptions are billed through your Apple ID and
              renew automatically unless cancelled at least 24 hours before the
              end of the current period. Manage or cancel them in your device
              Settings under Subscriptions. Refunds are handled by Apple.
            </p>
          </section>

          <section aria-labelledby="terms-content">
            <h2 id="terms-content" className="mb-2 text-lg font-bold text-white">
              4. Your content and AI results
            </h2>
            <p>
              You retain rights to the photos you upload. Generated try-on
              images are produced by an AI model and are previews, not exact
              representations of real-world fit. Handling of your photos and
              data is described in the{" "}
              <Link
                href="/privacy"
                className="text-accent underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="terms-warranty">
            <h2 id="terms-warranty" className="mb-2 text-lg font-bold text-white">
              5. Disclaimer
            </h2>
            <p>
              The app is provided &quot;as is&quot; without warranties of any
              kind, to the maximum extent permitted by law. We are not liable
              for purchase decisions made based on generated previews.
            </p>
          </section>

          <section aria-labelledby="terms-contact">
            <h2 id="terms-contact" className="mb-2 text-lg font-bold text-white">
              6. Contact
            </h2>
            <p>
              Questions about these terms? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
