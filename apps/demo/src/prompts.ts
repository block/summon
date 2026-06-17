/**
 * Sample asks for the demo. Every entry is phrased as a real-life user
 * tool — wanting to do something, see something, decide something, or
 * a mini-app for a real situation. **Never** a UI description ("a form
 * with three fields…"); the LLM infers shape, layout, and interactivity
 * from the ask. The point of this file is to stress-test that inference.
 */

export const QUICKSTART_PROMPT =
  "help me build a weeknight dinner finder where i can search for recipes, pick a result, and see loading/error/data states clearly";

export const SAMPLES: string[] = [
  QUICKSTART_PROMPT,
  "help me plan a low-key date night this Friday — budget around $40",
  "i'm picking a name for our new puppy — golden retriever, female, kind of goofy",
  "i want to understand where my money actually goes each month",
  "compare switching to a standing desk vs an ergonomic chair for back pain",
  "i'm trying to decide between Notion and Obsidian for my notes — help me think it through",
  "track my reading toward 24 books this year, with a breakdown by genre",
  "help me cut my monthly subscriptions — i'll list what i pay for and you flag what to drop",
  "i want to plan a 3-day Portland trip for two, first time visiting, around $800",
  "give me a 7-minute morning stretch routine i'll actually stick with",
  "brainstorm birthday gift ideas for my sister — she's 32, into pottery and hiking",
  "help me prep for tomorrow's 1:1 about asking for a promotion to senior engineer",
  "explain Roth vs traditional IRA — assume i know nothing",
  "i want to log how i'm sleeping this week so i can spot patterns",
  "what's actually going on with the housing market right now, in plain English",
  "i'm deciding what to make for dinner — i've got chicken, pasta, and not much energy",
  "draft a thank-you note to my mentor who wrote my grad school reference",
  "help me and my partner vote on weekend activities — we keep getting stuck",
  "quiz me on the EU capitals so i stop embarrassing myself at trivia",
  "what should i wear to an outdoor wedding next weekend — mid-60s, semi-formal",
  "show me a dashboard of my 14 houseplants — when i last watered each, which are thriving",
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
