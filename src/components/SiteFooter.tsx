import Link from "next/link";

const CONTACT_EMAIL = "a.selimfedakar@gmail.com";

export default function SiteFooter() {
  return (
    <footer className="border-t border-card-border/60 bg-black">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-white">
            VTO — Virtual Try-On
          </p>
          <p className="mt-1 text-xs text-muted">
            © {new Date().getFullYear()} VTO. All rights reserved.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/support" className="text-muted transition-colors hover:text-white">
            Support
          </Link>
          <Link href="/privacy" className="text-muted transition-colors hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted transition-colors hover:text-white">
            Terms
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-muted transition-colors hover:text-white"
          >
            {CONTACT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  );
}
