import { Link } from "react-router-dom";

const cards = [
  {
    href: "/generate",
    title: "Generate",
    body: "One prompt. Stream Arrow JSONL, render the accepted artifact in the inline sandbox, and inspect diagnostics.",
    icon: (
      <>
        <path d="M3 12c2-4 3.5-4 5.5 0s3.5 4 5.5 0 3.5-4 5.5 0" />
        <circle cx="3" cy="12" r="0.6" fill="currentColor" />
        <circle cx="21" cy="12" r="0.6" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/batch",
    title: "Batch",
    body: "Fan out N parallel generations. Same prompt to compare consistency, or a seeded sample of asks to compare coverage.",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
  },
];

function LandingCard({ card }: { card: (typeof cards)[number] }) {
  return (
    <Link
      className="group flex flex-col gap-4 rounded-card bg-surface-raised p-5 text-inherit no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
      to={card.href}
    >
      <div
        className="flex size-10 items-center justify-center rounded-control bg-surface text-ink transition-colors duration-200 group-hover:bg-ink group-hover:text-ink-inverse"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          {card.icon}
        </svg>
      </div>
      <div>
        <h2 className="m-0 mb-1.5 text-lg font-semibold tracking-normal text-ink">
          {card.title}
        </h2>
        <p className="m-0 text-sm leading-[1.55] text-ink-soft">{card.body}</p>
      </div>
    </Link>
  );
}

export function LandingPage() {
  return (
    <main className="flex flex-1 p-8">
      <div className="w-full ">
        <header className="mb-24">
          <h1 className="m-0 mb-2.5 text-[clamp(64px,9vw,116px)] font-bold leading-[0.88] tracking-normal text-ink">
            summon
          </h1>
          <p className="m-0 max-w-[56ch] text-[15px] leading-[1.55] text-ink-soft">
            summon renders ai-generated UI in an inline Arrow sandbox. the ui
            can only use host tools the app allows.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => (
            <LandingCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </main>
  );
}
