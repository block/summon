// Single source of truth for the @arrow-js/sandbox authoring subset.
//
// The sandbox compiler supports most of @arrow-js/core, but a handful of
// idiomatic Arrow forms are rejected at compile time (see
// @arrow-js/sandbox/src/compiler/template.ts). An LLM cannot infer these from
// general Arrow knowledge and the upstream docs do not spell them out, so we
// own the quirks here and feed them to BOTH:
//   1. the generation prompt (prevent — teach the supported pattern), and
//   2. the validator + repair hints (repair — catch a slip before it crashes).
//
// Keep this list verified against the installed @arrow-js/sandbox version.
// Reference: node_modules/@arrow-js/sandbox/README.md "Supported subset".

/**
 * IDL property bindings (`.value=`, `.checked=`, `.selected=`, ...) are the #1
 * gotcha: the model's natural way to write a controlled input, but the sandbox
 * compiler throws `SandboxCompileError: IDL property bindings like ".value" are
 * not supported`. The supported form is an attribute binding plus an event
 * binding.
 *
 * Matches a `.name=` attribute inside an opening tag, e.g. `<input .value=`.
 */
export const ARROW_IDL_BINDING_RE = /<[a-zA-Z][^>]*\s\.[a-zA-Z][\w-]*\s*=/;

/**
 * The #2 gotcha after IDL bindings: passing a tagged template (or any
 * non-function) to `Array.prototype.map` / `flatMap` / `forEach`. The model
 * pattern-matches to JSX/lit habits and writes `items.map(html`...`)`, which is
 * valid syntax but crashes at VM boot with `TypeError: not a function` because
 * `.map` calls its argument. Arrow's reactive list form requires a function
 * callback: `items.map((item) => html`...`)`. No upstream doc states this
 * plainly, so we own it here and feed it to both the prompt and the validator.
 *
 * Matches `.map(`, `.flatMap(`, or `.forEach(` immediately followed by a
 * tagged-template (`` html` `` or any `ident` + backtick) — the high-confidence,
 * low-false-positive shape. We deliberately do NOT try to flag every
 * non-function argument; that needs real parsing and would block valid code.
 */
export const ARROW_MAP_TEMPLATE_CALLBACK_RE =
  /\.(?:map|flatMap|forEach)\s*\(\s*[A-Za-z_$][\w$]*\s*`/;

/** The controlled-input rewrite the model must use instead of `.value=`. */
export const ARROW_CONTROLLED_INPUT_HINTS: string[] = [
  'Do not use IDL property bindings like `.value="${...}"`, `.checked="${...}"`, or `.selected="${...}"`. The Arrow sandbox compiler rejects them.',
  'For a controlled text input, bind the attribute and the event separately: `<input value="${() => state.amount}" @input="${(e) => state.amount = e.target.value}">`.',
  'For a checkbox, use `checked="${() => state.done}"` plus `@change="${(e) => state.done = e.target.checked}"`.',
  'For a select, use `value="${() => state.unit}"` plus `@change="${(e) => state.unit = e.target.value}"`.',
];

/**
 * The Arrow sandbox authoring quirks, rendered into the generation prompt.
 * These are the specific things the model gets wrong that no doc states plainly.
 */
export const ARROW_SANDBOX_SUBSET_PROMPT_BLOCK: string = [
  'Arrow sandbox quirks (the compiler rejects these — they will crash, so avoid them):',
  '',
  '- No IDL property bindings. Never write `.value="${...}"`, `.checked="${...}"`, `.selected="${...}"`, or any `.property=` attribute. They throw a sandbox compile error.',
  '  - Controlled text input: `<input value="${() => state.q}" @input="${(e) => state.q = e.target.value}">`',
  '  - Checkbox: `<input type="checkbox" checked="${() => state.on}" @change="${(e) => state.on = e.target.checked}">`',
  '  - Select: `<select value="${() => state.unit}" @change="${(e) => state.unit = e.target.value}"> ... </select>`',
  '- No bare `${...}` expressions inside an opening tag. Put every dynamic value in a named, quoted attribute: `disabled="${() => state.busy}"`, not `<button ${...}>`.',
  '- No namespace-style template tags (e.g. `arrow.html`). Import and use `html` directly.',
  '- A `ref` binding must be a single expression.',
  '- Wrap every live read as a function so Arrow tracks it: `${() => state.count}`, never `${state.count}`.',
  '- Return `false` from a boolean attribute binding to remove it; do not inject a bare attribute string.',
  '- Render lists with a function callback: `${() => items.map((item) => html`<li>${() => item.label}</li>`)}`. The `.map()` / `.flatMap()` / `.forEach()` argument must be a function. Never pass a template directly — `items.map(html`...`)` crashes at runtime with `TypeError: not a function`.',
].join('\n');

/** Repair hints for a `.map(html`...`)` style non-function list callback. */
export const ARROW_MAP_CALLBACK_HINTS: string[] = [
  'A list render passed a template (or other non-function) directly to `.map()` / `.flatMap()` / `.forEach()`. These call their argument, so it must be a function.',
  'Wrap each item in an arrow function: `items.map((item) => html`<li>${() => item.label}</li>`)`, not `items.map(html`<li>...</li>`)`.',
  'Keep the whole reactive list read inside a function so Arrow tracks it: `${() => items.map((item) => html`...`)}`.',
];

/** One-line supported-binding summary for inline use in shorter rule lists. */
export const ARROW_BINDING_RULE_LINE: string =
  'Use attribute + event bindings for inputs (`value="${() => state.x}"` plus `@input="${(e) => state.x = e.target.value}"`). Never use IDL property bindings such as `.value=` or `.checked=` — the sandbox compiler rejects them.';
