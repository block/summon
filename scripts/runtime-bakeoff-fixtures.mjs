import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const runtimes = [
  'arrow-control',
  'html-static',
  'html-stream',
];

const bundles = [
  {
    id: 'redline-cinema',
    promptFile: 'apps/server/fingerprints/bundles/redline-cinema/fingerprint/sources/curation/dogfood-prompts-2026-06-22.md',
  },
  {
    id: 'console-chrome-2001',
    promptFile: 'apps/server/fingerprints/bundles/console-chrome-2001/fingerprint/sources/curation/dogfood-eval-prompts-2026-06-22.md',
  },
  {
    id: 'signal-stream',
    promptFile: 'apps/server/fingerprints/bundles/signal-stream/examples/dogfood/prompts.md',
  },
  {
    id: 'technical-contrast',
    promptFile: 'apps/server/fingerprints/bundles/technical-contrast/examples/dogfood/prompts.md',
  },
];

const prompts = [];
for (const bundle of bundles) {
  const text = await readFile(join(rootDir, bundle.promptFile), 'utf8');
  for (const [index, prompt] of extractPrompts(text).entries()) {
    prompts.push({
      id: `${bundle.id}-${String(index + 1).padStart(2, '0')}`,
      bundle: bundle.id,
      prompt,
      promptFile: bundle.promptFile,
    });
  }
}

const matrix = prompts.flatMap((prompt) =>
  runtimes.map((runtime) => ({
    id: `${prompt.id}-${runtime}`,
    runtime,
    fingerprint: prompt.bundle,
    prompt: prompt.prompt,
    promptFile: prompt.promptFile,
  })),
);

process.stdout.write(`${JSON.stringify({
  schema: 'summon.runtime-bakeoff-fixtures/v0',
  generatedAt: new Date().toISOString(),
  runtimes,
  scoring: [
    'accepted artifact rate',
    'repair/block count',
    'unsafe API or HTML/CSS violations',
    'time to first meaningful render',
    'Ghost fidelity against bundle rubric',
    'generic SaaS/card-grid drift',
  ],
  prompts,
  matrix,
}, null, 2)}\n`);

function extractPrompts(markdown) {
  const fenced = markdown.matchAll(/```(?:prompt|text)?\n([\s\S]*?)```/g);
  const fromFences = Array.from(fenced, (match) => cleanPrompt(match[1])).filter(Boolean);
  if (fromFences.length > 0) return fromFences;

  const explicit = Array.from(
    markdown.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?(?:Exact prompt|Prompt)(?:\*\*)?\s*:\s*(.+)/gi),
    (match) => cleanPrompt(match[1]),
  ).filter(Boolean);
  if (explicit.length > 0) return explicit;

  const bullets = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim())
    .map(cleanPrompt)
    .filter(isPromptLikeLine);
  return bullets.length > 0 ? bullets : [markdown.trim()].filter(Boolean);
}

function cleanPrompt(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\*\*/, '')
    .replace(/\*\*$/, '')
    .replace(/^["'“”`]+/, '')
    .replace(/["'“”`]+$/, '')
    .trim();
}

function isPromptLikeLine(line) {
  if (line.length < 20 || line.startsWith('#')) return false;
  if (/^(use these|score each|claims under test|eval axis|expected|strong output|likely failure)/i.test(line)) {
    return false;
  }
  return /^(create|design|build|make|generate)\b/i.test(line);
}
