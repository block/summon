/**
 * Sample asks for the demo. Every entry is phrased as a real-life user
 * tool — wanting to do something, see something, decide something, or
 * a mini-app for a real situation. **Never** a UI description ("a form
 * with three fields…"); the LLM infers shape, layout, and interactivity
 * from the ask. The point of this file is to stress-test that inference.
 */

export const QUICKSTART_PROMPT =
  "help me find a weekend hike near me — let me search by distance and difficulty, compare a couple options, and handle the empty and loading states gracefully";

export const SAMPLES: string[] = [
  QUICKSTART_PROMPT,
  "i want to figure out what to cook tonight with whatever's left in my fridge",
  "help me split a vacation rental cost fairly between four friends who stayed different nights",
  "i'm choosing between two job offers and keep going in circles — walk me through it",
  "look up a GitHub username and summarize their profile, top repos, and how active they've been",
  "brainstorm a name for my new coffee cart — playful, easy to say, not already a chain",
  "collect RSVPs for my housewarming with headcount and plus-ones, and let me submit the final guest list",
  "analyze my past three months of spending, compute a savings rate, and flag where it's leaking",
  "draft a price increase email to my clients, let me review it, and require approval before it sends",
  "help me pick a paint color for the living room — north-facing, lots of afternoon shade",
  "i want to track my water intake this week and see if i'm actually hitting my goal",
  "compare leasing vs buying a car for someone who drives about 8k miles a year",
  "build me a quick packing checklist for a 5-day trip to a cold, rainy city",
  "help me decide which of my three side project ideas to actually start this month",
  "search a plant database and tell me which of my picks are safe around cats",
  "i want to plan a reading list of 12 books for the year across a mix of genres",
  "help me prep questions for interviewing a candidate for a junior design role",
  "compare three phone plans for a family of four and let me save the one we choose",
  "walk me through what a 401k match actually means — pretend i've never had one",
  "i keep forgetting to stretch — give me a 5-minute desk routine i can do between meetings",
  "help me and my roommate divide the chores fairly and vote on who does what",
  "create an intake form for freelance project requests — scope, budget, deadline — and let me submit it",
  "i want to log my mood a few times a day and spot what's dragging it down",
  "quiz me on world capitals so i stop losing at bar trivia",
  "help me choose a gift for my dad's 60th — he likes fishing, jazz, and hates clutter",
  "review returns on three savings accounts, score them on fees and rate, and recommend one",
  "draft a heartfelt toast for my best friend's wedding — funny but not roast-level",
  "help me plan a low-pressure first date around $50 that isn't just dinner",
];

export const ALL_PROMPTS: string[] = SAMPLES;

/** Deterministic shuffle using mulberry32. Same seed → same output. */
export function sample(pool: string[], n: number, seed: number): string[] {
  const rng = mulberry32(seed >>> 0);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
