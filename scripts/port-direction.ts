#!/usr/bin/env tsx
/**
 * port-direction — convert a portable `expression.md` into a Summon design
 * direction. Expressions may represent design systems, product surfaces, or
 * brand-specific variants; Summon treats the resulting files uniformly.
 *
 *   pnpm port-direction <path-to-expression.md> [<id>]
 *
 * If <id> is omitted, derived from the expression's frontmatter `id:` field
 * (or its parent directory name as a fallback). Reads ANTHROPIC_API_KEY from
 * apps/server/.env or the environment. Writes
 * apps/server/directions/<id>/{tokens.css,prompt.md,meta.json}.
 *
 * The conversion is a single LLM call (Opus 4.7 by default, override with
 * SUMMON_PORT_MODEL). The reference public direction is embedded in the
 * system prompt as a calibration exemplar so Summon's evolving direction
 * format is the source of truth, not a hard-coded schema in this script.
 */

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileTokenContract, coerceOpts } from "../packages/engine/src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const SERVER_ROOT = join(REPO_ROOT, "apps", "server");
const DIRECTIONS_ROOT = join(SERVER_ROOT, "directions");
const REFERENCE_DIRECTION_ID = "ghost";
const MODEL = process.env.SUMMON_PORT_MODEL ?? "claude-opus-4-7";

loadDotEnv(join(SERVER_ROOT, ".env"));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "[port-direction] ANTHROPIC_API_KEY is not set (looked in apps/server/.env and env).",
  );
  process.exit(1);
}

const [, , expressionArg, explicitId] = process.argv;
if (!expressionArg) {
  console.error("Usage: pnpm port-direction <path-to-expression.md> [<id>]");
  process.exit(1);
}
const expressionPath = resolve(expressionArg);
if (!existsSync(expressionPath)) {
  console.error(`[port-direction] file not found: ${expressionPath}`);
  process.exit(1);
}
const expressionContent = readFileSync(expressionPath, "utf-8");

const id = normalizeId(
  explicitId ?? deriveIdFromExpression(expressionContent, expressionPath),
);
if (!id) {
  console.error("[port-direction] could not derive an id");
  process.exit(1);
}
if (id === REFERENCE_DIRECTION_ID) {
  console.error(
    `[port-direction] refusing to overwrite the reference direction "${REFERENCE_DIRECTION_ID}"`,
  );
  process.exit(1);
}

const reference = loadReferenceDirection();
const systemPrompt = buildSystemPrompt(reference);

const emitDirectionTool: Anthropic.Tool = {
  name: "emit_direction",
  description:
    "Emit a Summon design direction (tokens.css + prompt.md + meta.json + judgment trace) derived from an expression.md.",
  input_schema: {
    type: "object",
    properties: {
      meta: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          opts: {
            type: "object",
            description:
              "Per-family opt-outs. Set `shadows: \"none\"` if the source's shadow vocabulary is deliberate-none — the validator then accepts a tokens.css with no `--shadow-*` declarations, and the per-direction prompt block tells the model not to synthesize box-shadow.",
            properties: {
              shadows: { type: "string", enum: ["none", "default"] },
            },
          },
          sourceExpression: {
            type: "object",
            description:
              "Optional provenance for the source expression. Include fields only when known.",
            properties: {
              id: { type: "string" },
              path: { type: "string" },
              commit: { type: "string" },
              hash: { type: "string" },
            },
          },
        },
        required: ["name", "description"],
      },
      tokens_css: { type: "string" },
      prompt_md: { type: "string" },
      rationale: {
        type: "object",
        properties: {
          accent_pick: { type: "string" },
          bg_pick: { type: "string" },
          radius_pill_pick: { type: "string" },
          notes: { type: "string" },
        },
        required: ["accent_pick", "bg_pick", "radius_pill_pick", "notes"],
      },
    },
    required: ["meta", "tokens_css", "prompt_md", "rationale"],
  },
};

const client = new Anthropic();
console.log(
  `[port-direction] porting "${expressionPath}" → directions/${id}/ via ${MODEL}`,
);

const response = await client.messages.create({
  model: MODEL,
  max_tokens: 8000,
  system: systemPrompt,
  tools: [emitDirectionTool],
  tool_choice: { type: "tool", name: "emit_direction" },
  messages: [
    {
      role: "user",
      content: `Convert this expression.md into a Summon direction with id \`${id}\`. The source path was \`${expressionPath}\`.\n\n\`\`\`markdown\n${expressionContent}\n\`\`\``,
    },
  ],
});

const toolUse = response.content.find(
  (b): b is Anthropic.ToolUseBlock =>
    b.type === "tool_use" && b.name === "emit_direction",
);
if (!toolUse) {
  console.error(
    "[port-direction] model did not emit the expected tool call. Raw response:",
  );
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

const result = toolUse.input as EmitDirectionPayload;
validatePayload(result);
result.meta.sourceExpression = {
  id: result.meta.sourceExpression?.id ?? id,
  path: result.meta.sourceExpression?.path ?? expressionPath,
  commit: result.meta.sourceExpression?.commit,
  hash: result.meta.sourceExpression?.hash,
};

const outDir = join(DIRECTIONS_ROOT, id);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.css"), ensureTrailingNewline(result.tokens_css));
writeFileSync(join(outDir, "prompt.md"), ensureTrailingNewline(result.prompt_md));
writeFileSync(
  join(outDir, "meta.json"),
  `${JSON.stringify(result.meta, null, 2)}\n`,
);

console.log(`[port-direction] wrote ${outDir}`);
console.log("");
console.log("--- judgment trace ---");
console.log(`accent: ${result.rationale.accent_pick}`);
console.log(`bg:     ${result.rationale.bg_pick}`);
console.log(`pill:   ${result.rationale.radius_pill_pick}`);
if (result.rationale.notes.trim())
  console.log(`notes:  ${result.rationale.notes}`);

// ---------------------------------------------------------------------------

interface EmitDirectionPayload {
  meta: {
    name: string;
    description: string;
    opts?: { shadows?: "none" | "default" };
    sourceExpression?: {
      id?: string;
      path?: string;
      commit?: string;
      hash?: string;
    };
  };
  tokens_css: string;
  prompt_md: string;
  rationale: {
    accent_pick: string;
    bg_pick: string;
    radius_pill_pick: string;
    notes: string;
  };
}

interface ReferenceDirection {
  tokensCss: string;
  promptMd: string;
  metaJson: string;
}

function loadReferenceDirection(): ReferenceDirection {
  const dir = join(DIRECTIONS_ROOT, REFERENCE_DIRECTION_ID);
  return {
    tokensCss: readFileSync(join(dir, "tokens.css"), "utf-8"),
    promptMd: readFileSync(join(dir, "prompt.md"), "utf-8"),
    metaJson: readFileSync(join(dir, "meta.json"), "utf-8"),
  };
}

function buildSystemPrompt(reference: ReferenceDirection): string {
  return `You convert portable \`expression.md\` files into Summon design directions.

Summon is a sandboxed generative-UI framework. Each "direction" is a design language an LLM authors HTML against, expressed as three files in \`apps/server/directions/<id>/\`:

- \`tokens.css\` — CSS custom properties on \`:root\`. The LLM emits markup using \`var(--*)\`; swapping directions = swapping this file.
- \`prompt.md\` — Character / Signature / Decisions prose telling the LLM how the design feels and what the rules are.
- \`meta.json\` — \`{ "name": "...", "description": "..." }\`, with optional \`sourceExpression\` provenance.

# Summon's token vocabulary

\`tokens.css\` MUST use exactly these custom property names. If the source expression does not speak to a slot, derive a sensible value from neighbouring tokens — every slot must exist for the LLM consumer.

- Color: \`--color-bg\`, \`--color-surface\`, \`--color-surface-muted\`, \`--color-border\`, \`--color-border-input\`, \`--color-border-strong\`, \`--color-text\`, \`--color-text-muted\`, \`--color-text-alt\`, \`--color-accent\`, \`--color-accent-fg\`, \`--color-danger\`, \`--color-success\`, \`--color-info\`, \`--color-warning\`.
- Space: \`--space-1\` through \`--space-12\`. Slots 1–6 are REQUIRED (baseline); 7..12 are opportunistic — define only the ones that mirror the source's \`spacing.scale\`. Rough targets: 4 · 8 · 12 · 16 · 24 · 32 · 52 · 75 · 100.
- Radii: \`--radius-pill\`, \`--radius-sm\`, \`--radius-md\`, \`--radius-lg\`, \`--radius-xl\`. \`--radius-pill\` should be ≥ 999px when the source treats interactive elements as pills, otherwise the largest radius in the source's \`surfaces.borderRadii\`.
- Type: \`--font-sans\`, \`--font-mono\`, \`--font-serif\`; \`--text-xs\`, \`--text-sm\`, \`--text-md\`, \`--text-lg\`, \`--text-xl\`, \`--text-2xl\`, \`--text-3xl\`, \`--text-display\`. Build font stacks with system fallbacks (\`system-ui\`, \`-apple-system\`, etc.) so the LLM consumer always renders even without the brand face installed.
- Tracking / leading (always required — derive from typography even if expression doesn't name them explicitly): \`--tracking-label\`, \`--tracking-tight\`, \`--tracking-display\`, \`--leading-display\`, \`--leading-section\`, \`--leading-body\`, \`--leading-reading\`.
- Shadow: \`--shadow-mini\`, \`--shadow-card\`, \`--shadow-elevated\`, \`--shadow-popover\`, \`--shadow-modal\`. If the source declares \`shadowComplexity: deliberate-none\` (or equivalent), OMIT the entire shadow block from \`tokens.css\` AND set \`meta.opts.shadows = "none"\` — both. The validator requires either all five shadows defined or the explicit opt-out.

Always include the body reset that mounts the tokens (use \`color-scheme: light\` or \`dark\` based on the source's dominant surface):

\`\`\`css
html, body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: var(--leading-body, 1.55);
  -webkit-font-smoothing: antialiased;
}
\`\`\`

# Reference direction (calibrate against this)

Here is the existing reference direction. Match this shape and depth — particularly the prose voice of \`prompt.md\` (it instructs an LLM authoring HTML, not a designer authoring tokens), the comment density of \`tokens.css\`, and the brevity of \`meta.json\`. Do not copy values; derive from the source expression.

\`\`\`css
/* tokens.css (reference) */
${reference.tokensCss}
\`\`\`

\`\`\`markdown
<!-- prompt.md (reference) -->
${reference.promptMd}
\`\`\`

\`\`\`json
// meta.json (reference)
${reference.metaJson.trim()}
\`\`\`

# Conversion rules

- \`tokens.css\`: derive every value from \`palette\`, \`spacing.scale\`, \`surfaces.borderRadii\`, \`typography\` in the source. Where the source supplies a \`roles[]\` block (e.g., \`button-primary { background: ..., foreground: ... }\`), use it to disambiguate which palette role becomes \`--color-accent\` / \`--color-accent-fg\`. Open the file with a short comment header naming the source expression's id.
- \`prompt.md\`: rewrite Character / Signature / Decisions in the source's voice but framed for an LLM emitting HTML. Strip evidence file paths (they reference the source repo, not Summon). Keep an imperative, rule-shaped tone — same energy as the reference.
- \`meta.json\`: \`name\` is the source \`id\` Title Cased; \`description\` is one sentence drawn from the source's Character paragraph, rewritten if needed for tightness. Include \`sourceExpression.id\` when the source expression declares one.
- Make judgment calls explicitly in \`rationale\` — which dominant role mapped to \`--color-accent\`, which to \`--color-bg\`, how \`--radius-pill\` was chosen, and any field you couldn't confidently derive.

Emit the result via the \`emit_direction\` tool. Do not respond with prose outside the tool call.`;
}

function loadDotEnv(envPath: string): void {
  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env at that path — fall through to process.env.
  }
}

function deriveIdFromExpression(content: string, sourcePath: string): string {
  const match = content.match(/^id:\s*(.+)$/m);
  return match?.[1]?.trim() ?? basename(dirname(sourcePath));
}

function normalizeId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : `${s}\n`;
}

function validatePayload(payload: EmitDirectionPayload): void {
  const fail = (msg: string) => {
    console.error(`[port-direction] invalid tool output: ${msg}`);
    process.exit(1);
  };
  if (!payload.meta?.name?.trim()) fail("meta.name missing");
  if (!payload.meta?.description?.trim()) fail("meta.description missing");
  if (!payload.prompt_md?.includes("Character"))
    fail("prompt.md missing Character section");

  // Run the same contract validation the loader uses, so a ported direction
  // can never ship in a state the loader would reject.
  const opts = coerceOpts(payload.meta?.opts);
  const result = compileTokenContract({ css: payload.tokens_css ?? "", opts });
  const blocking = result.issues.filter((issue) => issue.severity === "block");
  const warnings = result.issues.filter((issue) => issue.severity === "warn");
  if (blocking.length > 0) {
    fail(`tokens.css fails contract:\n  ${blocking.map((issue) => issue.message).join("\n  ")}`);
  }
  if (warnings.length > 0) {
    console.warn(
      `[port-direction] tokens.css warnings:\n  ${warnings.map((issue) => issue.message).join("\n  ")}`,
    );
  }
}
