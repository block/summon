import '../styles.css';

const cards = [
  {
    href: '/generate.html',
    title: 'Generate',
    body: 'One prompt. Watch Claude paint a UI section-by-section into a locked-down iframe, live as each line of JSONL arrives.',
    icon: (
      <>
        <path d="M3 12c2-4 3.5-4 5.5 0s3.5 4 5.5 0 3.5-4 5.5 0" />
        <circle cx="3" cy="12" r="0.6" fill="currentColor" />
        <circle cx="21" cy="12" r="0.6" fill="currentColor" />
      </>
    ),
  },
  {
    href: '/batch.html',
    title: 'Batch',
    body: 'Fan out N parallel generations. Same prompt to compare consistency, or a seeded sample of asks to compare coverage.',
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
    href: '/fragment-compare.html',
    title: 'Fragment compare',
    body: 'Run one prompt in two locked iframes at the same time: section stream versus experimental block stream.',
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
    <a className="landing-card" href={card.href}>
      <div className="landing-card-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {card.icon}
        </svg>
      </div>
      <div className="landing-card-body">
        <h2>{card.title}</h2>
        <p>{card.body}</p>
      </div>
      <div className="landing-card-cta">
        <span>Open</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="arrow"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

export function LandingPage() {
  return (
    <main className="landing-main">
      <div className="landing-content">
        <header className="landing-header">
          <h1 className="landing-title">summon</h1>
          <p className="landing-tagline">
            Summon renders AI-generated UI in a locked iframe. The UI can only use host tools this app allows.
          </p>
        </header>

        <div className="landing-grid">
          {cards.map((card) => <LandingCard key={card.href} card={card} />)}
        </div>
      </div>
    </main>
  );
}
