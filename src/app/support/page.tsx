import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Support and FAQ for the VTO Virtual Try-On iOS app: account deletion, subscriptions, free limits, content reporting, and contact information.",
};

const CONTACT_EMAIL = "a.selimfedakar@gmail.com";

const faqs = [
  {
    question: "How does the virtual try-on work?",
    answer: (
      <>
        You pick a full-body photo of yourself and a photo of a garment inside
        the app. Both images are sent over an encrypted connection to our AI
        processing service, which renders the garment onto your photo and
        returns the result in seconds. Generated images are saved to your
        account so you can revisit them. See the{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-4">
          Privacy Policy
        </Link>{" "}
        for full details on how photos are handled.
      </>
    ),
  },
  {
    question: "How do I delete my account and data?",
    answer: (
      <>
        Account deletion is available directly in the app: open{" "}
        <strong className="text-white">
          Profile → Danger Zone → Delete My Account
        </strong>
        . This permanently removes your profile, try-on history, and stored
        images. Deletion is immediate and irreversible. You can also request
        deletion by emailing{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-accent underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </>
    ),
  },
  {
    question: "How do subscriptions and billing work?",
    answer: (
      <>
        Subscriptions are purchased and managed entirely through your Apple ID.
        To view, change, or cancel a subscription, open the iPhone{" "}
        <strong className="text-white">
          Settings → your name → Subscriptions
        </strong>{" "}
        (or the App Store app → your profile → Subscriptions). Refunds are
        handled by Apple at{" "}
        <a
          href="https://reportaproblem.apple.com"
          className="text-accent underline underline-offset-4"
        >
          reportaproblem.apple.com
        </a>
        .
      </>
    ),
  },
  {
    question: "Is there a free tier? What are the limits?",
    answer: (
      <>
        Yes. Free accounts get{" "}
        <strong className="text-white">5 free try-on generations per day</strong>.
        The counter resets daily. Subscribing removes this limit.
      </>
    ),
  },
  {
    question: "What is the content policy, and how do I report content?",
    answer: (
      <>
        VTO is for trying on clothing. Uploading unlawful, sexually explicit,
        or abusive imagery — or photos of people without their consent — is
        prohibited and may lead to account termination. If you encounter
        content that violates this policy, use the{" "}
        <strong className="text-white">report option in the app</strong> on the
        relevant image, or email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-accent underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        with a screenshot. Reports are reviewed promptly.
      </>
    ),
  },
  {
    question: "My try-on failed or looks wrong. What can I do?",
    answer: (
      <>
        Results are best with a well-lit, front-facing, full-body photo against
        a simple background, and a clear photo of a single garment. If a
        generation fails or looks off, try again with a cleaner photo — and if
        the problem persists, contact us and we will look into it.
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-foreground">
      <header className="border-b border-card-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-sm font-medium text-muted transition-colors hover:text-white">
            ← Back to VTO
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Support
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Answers to common questions about the VTO Virtual Try-On iOS app. Not
          finding what you need? Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-accent underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we will get back to you as soon as possible.
        </p>

        <section aria-labelledby="faq-heading" className="mt-12">
          <h2 id="faq-heading" className="text-xl font-bold text-white">
            Frequently asked questions
          </h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-card-border bg-card px-6 py-4 open:pb-6"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.question}
                    <span
                      aria-hidden="true"
                      className="text-accent transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="contact-heading" className="mt-14">
          <h2 id="contact-heading" className="text-xl font-bold text-white">
            Contact
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            For anything else — bugs, feedback, data requests — email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-accent underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            . Please include your account email and, if relevant, a screenshot.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            You may also want to read our{" "}
            <Link href="/privacy" className="text-accent underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-accent underline underline-offset-4">
              Terms of Use
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
