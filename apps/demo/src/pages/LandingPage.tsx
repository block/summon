import { Link } from "react-router-dom";

const cards = [
  {
    href: "/generate",
    title: "Generate",
    body: "One prompt. Watch Claude paint a UI section-by-section into a locked-down iframe, live as each line of JSONL arrives.",
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
  {
    href: "/fragment-compare",
    title: "Fragment compare",
    body: "Run one prompt in two locked iframes at the same time: section stream versus experimental block stream.",
    icon: (
      <>
        <path d="M4 5h7v14H4z" />
        <path d="M13 5h7v14h-7z" />
        <path d="M7.5 9h0" />
        <path d="M16.5 9h0" />
        <path d="M7 13h1" />
        <path d="M16 13h1" />
      </>
    ),
  },
];

function LandingCard({ card }: { card: (typeof cards)[number] }) {
  return (
    <Link
      className="group flex flex-col gap-4 rounded-card border border-line bg-black p-5 text-inherit no-underline transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-hover hover:shadow-card"
      to={card.href}
    >
      <div className="flex size-10 items-center justify-center rounded-control bg-surface text-ink transition-colors duration-150 group-hover:bg-ink group-hover:text-black" aria-hidden="true">
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
        <h2 className="m-0 mb-1.5 text-base font-semibold tracking-normal text-ink">{card.title}</h2>
        <p className="m-0 text-[13px] leading-[1.55] text-ink-soft">{card.body}</p>
      </div>
      <div className="mt-auto flex items-center gap-1 text-[13px] font-medium text-ink-muted transition-colors duration-150 group-hover:text-ink">
        <span>Open</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export function LandingPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-[72px]">
      <div className="w-full max-w-[880px]">
        <header className="mb-9">
          <h1 className="m-0 mb-2.5 text-[clamp(64px,9vw,116px)] font-bold leading-[0.88] tracking-normal text-ink">summon</h1>
          <p className="m-0 max-w-[56ch] text-[15px] leading-[1.55] text-ink-soft">
            summon renders ai-generated UI in a locked iframe. the ui can only
            use host tools the app allows.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2.5 max-[600px]:grid-cols-1">
          {cards.map((card) => (
            <LandingCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </main>
  );
}
