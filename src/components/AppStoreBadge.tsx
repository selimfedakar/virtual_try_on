const APP_STORE_URL =
  "https://apps.apple.com/us/app/vto-virtual-try-on/id6769989598";

/**
 * Self-authored App Store download button (no external assets).
 * A simple pill with an Apple glyph and the standard two-line label.
 */
export default function AppStoreBadge() {
  return (
    <a
      href={APP_STORE_URL}
      className="inline-flex items-center gap-3 rounded-xl border border-white/25 bg-white px-5 py-3 text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label="Download VTO on the App Store"
    >
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        aria-hidden="true"
        fill="currentColor"
      >
        {/* Apple glyph: leaf + fruit body */}
        <path d="M15.9 1.5c.1 1.1-.3 2.2-1 3-.7.9-1.8 1.5-2.9 1.4-.1-1.1.4-2.2 1-2.9.7-.8 1.9-1.4 2.9-1.5z" />
        <path d="M20.6 17.2c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.2-3.8 3.2-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3-2.6-3.9-2.8-8.5-1.3-11 1.1-1.7 2.9-2.8 4.5-2.8 1.7 0 2.8 1 4.2 1 1.4 0 2.2-1 4.2-1 1.5 0 3 .8 4.1 2.2-3.6 2-3 7.1.6 8.7z" />
      </svg>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[11px] font-medium tracking-wide">
          Download on the
        </span>
        <span className="text-lg font-semibold -mt-0.5">App Store</span>
      </span>
    </a>
  );
}
