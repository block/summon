import type {
  CapabilityPack,
  ComponentPack,
  SurfacePlan,
} from '@anarchitecture/summon/engine';

export type GhostCapsuleMode = 'capsule' | 'raw';

export interface SummonGhostCapsule {
  schema: 'summon.ghost-capsule/v1';
  mode: 'capsule';
  product: string;
  targetPath: string;
  surface: {
    mode: 'static' | 'interactive';
    purpose: string | null;
    runtime: string | null;
    data: string | null;
    authority: string | null;
    persistence: string | null;
    shape: string | null;
  };
  selectedRefs: {
    situations: string[];
    principles: string[];
    experienceContracts: string[];
    patterns: string[];
    checks: string[];
  };
  obligations: string[];
  composition: string[];
  visualRules: string[];
  contentRules: string[];
  avoid: string[];
  vocabulary: {
    tokens: string[];
    components: string[];
    libraries: string[];
  };
  intentNote?: string;
  warnings: string[];
  budgetChars: number;
  prompt: string;
}

export interface GhostCapsuleBuildInput {
  raw: unknown;
  product: string;
  targetPath: string;
  userPrompt?: string;
  mode?: 'static' | 'interactive';
  surfacePlan?: SurfacePlan | null;
  shape?: string | null;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
}

interface NormalizedGhostMemory {
  summary: Record<string, unknown>;
  topology: Record<string, unknown>;
  situations: GhostSituation[];
  principles: GhostPrinciple[];
  experienceContracts: GhostExperienceContract[];
  patterns: GhostPattern[];
  vocabulary: {
    tokens: string[];
    components: string[];
    libraries: string[];
  };
  checks: GhostCheck[];
  intent: string | null;
  warnings: string[];
}

interface GhostScoped {
  applies_to?: Record<string, unknown>;
  paths?: unknown;
  surface_types?: unknown;
  situations?: unknown;
}

interface GhostSituation extends GhostScoped {
  id: string;
  title?: string;
  user_intent?: string;
  product_obligation?: string;
  surface_type?: string;
  hierarchy?: Record<string, unknown>;
  refuses?: string[];
  principles?: string[];
  experience_contracts?: string[];
  patterns?: string[];
  evidence?: unknown;
}

interface GhostPrinciple extends GhostScoped {
  id: string;
  status?: string;
  principle?: string;
  guidance?: string[];
  counterexamples?: string[];
  check_refs?: string[];
}

interface GhostExperienceContract extends GhostScoped {
  id: string;
  status?: string;
  contract?: string;
  obligations?: string[];
  check_refs?: string[];
}

interface GhostPattern extends GhostScoped {
  id: string;
  status?: string;
  kind?: string;
  pattern?: string;
  guidance?: string[];
  anti_patterns?: string[];
  check_refs?: string[];
}

interface GhostCheck {
  id: string;
  active: boolean;
  summary?: string;
  pattern?: string;
  description?: string;
}

const STATIC_BUDGET = 4000;
const INTERACTIVE_BUDGET = 6000;
const MAX_BULLET_CHARS = 190;

export function ghostContextMode(env: NodeJS.ProcessEnv = process.env): GhostCapsuleMode {
  return env.SUMMON_GHOST_CONTEXT_MODE?.trim().toLowerCase() === 'raw' ? 'raw' : 'capsule';
}

export function buildSummonGhostCapsule(input: GhostCapsuleBuildInput): SummonGhostCapsule {
  const memory = normalizeGhostMemory(input.raw);
  const surface = surfaceContext(input);
  const queryTerms = queryTermsFor(input, surface);
  const selectedSituations = rankItems(memory.situations, queryTerms, input, (item) =>
    [
      item.id,
      item.title,
      item.user_intent,
      item.product_obligation,
      item.surface_type,
      ...(item.refuses ?? []),
    ].filter(isString).join(' '),
  ).slice(0, 2);
  const situationRefs = refsFromSituations(selectedSituations);

  const selectedPrinciples = rankItems(
    accepted(memory.principles),
    queryTerms,
    input,
    (item) => [item.id, item.principle, ...(item.guidance ?? [])].filter(isString).join(' '),
    (item) => situationRefs.principles.has(item.id) ? 80 : 0,
  ).slice(0, 4);
  const selectedContracts = rankItems(
    accepted(memory.experienceContracts),
    queryTerms,
    input,
    (item) => [item.id, item.contract, ...(item.obligations ?? [])].filter(isString).join(' '),
    (item) => situationRefs.experienceContracts.has(item.id) ? 80 : 0,
  ).slice(0, 4);
  const selectedPatterns = rankItems(
    accepted(memory.patterns),
    queryTerms,
    input,
    (item) => [item.id, item.kind, item.pattern, ...(item.guidance ?? []), ...(item.anti_patterns ?? [])].filter(isString).join(' '),
    (item) => (situationRefs.patterns.has(item.id) ? 80 : 0) + patternKindPriority(item.kind),
  ).slice(0, 4);

  const selectedCheckIds = uniqueStrings([
    ...selectedPrinciples.flatMap((item) => item.check_refs ?? []),
    ...selectedContracts.flatMap((item) => item.check_refs ?? []),
    ...selectedPatterns.flatMap((item) => item.check_refs ?? []),
  ].map(stripRefPrefix));
  const activeChecks = memory.checks
    .filter((check) => check.active)
    .filter((check) => selectedCheckIds.length === 0 || selectedCheckIds.includes(check.id))
    .slice(0, 5);

  const selectedRefs = {
    situations: selectedSituations.map((item) => item.id),
    principles: selectedPrinciples.map((item) => item.id),
    experienceContracts: selectedContracts.map((item) => item.id),
    patterns: selectedPatterns.map((item) => item.id),
    checks: activeChecks.map((item) => item.id),
  };

  const obligations = uniqueStrings([
    ...selectedSituations.map((item) => item.product_obligation),
    ...selectedContracts.map((item) => item.contract),
    ...selectedContracts.flatMap((item) => item.obligations ?? []),
    ...selectedPrinciples.map((item) => item.principle),
  ].filter(isString)).slice(0, 5);
  const composition = uniqueStrings([
    ...selectedPatterns
      .filter((item) => item.kind === 'composition' || item.kind === 'visual' || !item.kind)
      .flatMap((item) => [item.pattern, ...(item.guidance ?? [])]),
  ].filter(isString)).slice(0, 4);
  const visualRules = uniqueStrings([
    ...stringArray(memory.summary.tone).map((tone) => `Tone: ${tone}`),
    ...selectedPrinciples.flatMap((item) => item.guidance ?? []),
    ...selectedPatterns
      .filter((item) => item.kind === 'visual')
      .flatMap((item) => [item.pattern, ...(item.guidance ?? [])]),
  ].filter(isString)).slice(0, 5);
  const contentRules = uniqueStrings([
    ...selectedPatterns
      .filter((item) => item.kind === 'content' || item.kind === 'behavioral')
      .flatMap((item) => [item.pattern, ...(item.guidance ?? [])]),
    ...selectedSituations.flatMap((item) => Object.values(item.hierarchy ?? {}).filter(isString)),
  ].filter(isString)).slice(0, 4);
  const avoid = uniqueStrings([
    ...selectedSituations.flatMap((item) => item.refuses ?? []),
    ...selectedPatterns.flatMap((item) => item.anti_patterns ?? []),
    ...selectedPrinciples.flatMap((item) => item.counterexamples ?? []),
    ...activeChecks.map((check) => check.summary ?? check.description ?? check.pattern),
  ].filter(isString)).slice(0, 5);
  const vocabulary = filterVocabulary(memory.vocabulary, input.components);

  const baseCapsule = {
    schema: 'summon.ghost-capsule/v1' as const,
    mode: 'capsule' as const,
    product: input.product,
    targetPath: input.targetPath || '.',
    surface,
    selectedRefs,
    obligations,
    composition,
    visualRules,
    contentRules,
    avoid,
    vocabulary,
    ...(memory.intent ? { intentNote: truncateSentence(memory.intent, 240) } : {}),
    warnings: memory.warnings,
    budgetChars: surface.mode === 'interactive' || surface.runtime === 'declarative' || surface.runtime === 'worker'
      ? INTERACTIVE_BUDGET
      : STATIC_BUDGET,
  };

  const prompt = renderCapsuleWithinBudget(baseCapsule);
  return {
    ...baseCapsule,
    prompt,
  };
}

export function ghostCapsuleMeta(capsule: SummonGhostCapsule) {
  return {
    schema: capsule.schema,
    mode: capsule.mode,
    product: capsule.product,
    targetPath: capsule.targetPath,
    surface: capsule.surface,
    selectedRefs: capsule.selectedRefs,
    promptChars: capsule.prompt.length,
    budgetChars: capsule.budgetChars,
    warnings: capsule.warnings,
  };
}

function normalizeGhostMemory(raw: unknown): NormalizedGhostMemory {
  const warnings: string[] = [];
  const obj = asRecord(raw);
  if (!obj) {
    return emptyMemory(['Ghost context was not structured; using a minimal capsule.']);
  }

  const split = splitPackageFromRaw(obj);
  if (split) return split;

  const fingerprint = asRecord(obj.fingerprint ?? asRecord(obj.merged)?.fingerprint);
  if (fingerprint) {
    const nestedSplit = splitPackageFromRaw({
      ...fingerprint,
      checks: obj.checks ?? fingerprint.checks,
      checksRaw: obj.checksRaw ?? fingerprint.checksRaw,
      intent: obj.intent ?? fingerprint.intent,
    });
    if (nestedSplit) return nestedSplit;

    return {
      summary: asRecord(fingerprint.summary) ?? {},
      topology: asRecord(fingerprint.topology) ?? {},
      situations: records(fingerprint.situations).map(normalizeSituation),
      principles: records(fingerprint.principles).map(normalizePrinciple),
      experienceContracts: records(fingerprint.experience_contracts).map(normalizeExperienceContract),
      patterns: records(fingerprint.patterns).map(normalizePattern),
      vocabulary: normalizeVocabulary(fingerprint.implementation_vocabulary),
      checks: checksFromRaw(obj.checks, obj.checksRaw),
      intent: stringValue(obj.intent),
      warnings,
    };
  }

  return emptyMemory(['Ghost context shape was not recognized; using a minimal capsule.']);
}

function splitPackageFromRaw(obj: Record<string, unknown>): NormalizedGhostMemory | null {
  const prose = asRecord(obj.prose);
  const inventory = asRecord(obj.inventory);
  const composition = asRecord(obj.composition);
  if (!prose && !inventory && !composition) return null;
  return {
    summary: asRecord(prose?.summary) ?? {},
    topology: asRecord(inventory?.topology) ?? {},
    situations: records(prose?.situations).map(normalizeSituation),
    principles: records(prose?.principles).map(normalizePrinciple),
    experienceContracts: records(prose?.experience_contracts).map(normalizeExperienceContract),
    patterns: records(composition?.patterns).map(normalizePattern),
    vocabulary: normalizeVocabulary(
      inventory?.building_blocks ?? inventory?.implementation_vocabulary,
    ),
    checks: checksFromRaw(obj.checks, obj.checksRaw),
    intent: stringValue(obj.intent),
    warnings: [],
  };
}

function emptyMemory(warnings: string[]): NormalizedGhostMemory {
  return {
    summary: {},
    topology: {},
    situations: [],
    principles: [],
    experienceContracts: [],
    patterns: [],
    vocabulary: { tokens: [], components: [], libraries: [] },
    checks: [],
    intent: null,
    warnings,
  };
}

function normalizeSituation(value: Record<string, unknown>): GhostSituation {
  const surfaceType = stringValue(value.surface_type);
  return {
    id: idValue(value.id),
    title: stringValue(value.title) ?? undefined,
    user_intent: stringValue(value.user_intent) ?? undefined,
    product_obligation: stringValue(value.product_obligation) ?? undefined,
    surface_type: surfaceType ?? undefined,
    applies_to: asRecord(value.applies_to) ?? undefined,
    paths: value.paths,
    surface_types: value.surface_types ?? (surfaceType ? [surfaceType] : undefined),
    hierarchy: asRecord(value.hierarchy) ?? undefined,
    refuses: stringArray(value.refuses),
    principles: stringArray(value.principles).map(stripRefPrefix),
    experience_contracts: stringArray(value.experience_contracts).map(stripRefPrefix),
    patterns: stringArray(value.patterns).map(stripRefPrefix),
    evidence: value.evidence,
  };
}

function normalizePrinciple(value: Record<string, unknown>): GhostPrinciple {
  return {
    id: idValue(value.id),
    status: stringValue(value.status) ?? undefined,
    principle: stringValue(value.principle) ?? undefined,
    applies_to: asRecord(value.applies_to) ?? undefined,
    paths: value.paths,
    surface_types: value.surface_types,
    situations: value.situations,
    guidance: stringArray(value.guidance),
    counterexamples: stringArray(value.counterexamples),
    check_refs: stringArray(value.check_refs),
  };
}

function normalizeExperienceContract(value: Record<string, unknown>): GhostExperienceContract {
  return {
    id: idValue(value.id),
    status: stringValue(value.status) ?? undefined,
    contract: stringValue(value.contract) ?? undefined,
    applies_to: asRecord(value.applies_to) ?? undefined,
    paths: value.paths,
    surface_types: value.surface_types,
    situations: value.situations,
    obligations: stringArray(value.obligations),
    check_refs: stringArray(value.check_refs),
  };
}

function normalizePattern(value: Record<string, unknown>): GhostPattern {
  return {
    id: idValue(value.id),
    status: stringValue(value.status) ?? undefined,
    kind: stringValue(value.kind) ?? undefined,
    pattern: stringValue(value.pattern) ?? undefined,
    applies_to: asRecord(value.applies_to) ?? undefined,
    paths: value.paths,
    surface_types: value.surface_types,
    situations: value.situations,
    guidance: stringArray(value.guidance),
    anti_patterns: stringArray(value.anti_patterns),
    check_refs: stringArray(value.check_refs),
  };
}

function normalizeVocabulary(raw: unknown): NormalizedGhostMemory['vocabulary'] {
  const obj = asRecord(raw) ?? {};
  return {
    tokens: stringArray(obj.tokens).slice(0, 20),
    components: stringArray(obj.components).slice(0, 12),
    libraries: stringArray(obj.libraries).slice(0, 8),
  };
}

function checksFromRaw(rawChecks: unknown, rawYaml: unknown): GhostCheck[] {
  const checksObj = asRecord(rawChecks);
  const source = checksObj ?? parseChecksYaml(stringValue(rawYaml));
  return records(source?.checks).map((check) => ({
    id: idValue(check.id),
    active: check.active !== false && stringValue(check.status) !== 'disabled',
    summary: stringValue(check.summary) ?? undefined,
    pattern: stringValue(check.pattern) ?? undefined,
    description: stringValue(check.description) ?? undefined,
  }));
}

function parseChecksYaml(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  const checksMatch = raw.match(/(?:^|\n)checks:\s*\n([\s\S]*)/);
  if (!checksMatch) return null;
  const checks = [...checksMatch[1]!.matchAll(/^\s*-\s+id:\s*([^\n]+)([\s\S]*?)(?=^\s*-\s+id:|\s*$)/gm)]
    .map((match) => {
      const body = match[2] ?? '';
      return {
        id: cleanScalar(match[1] ?? ''),
        active: !/^\s*active:\s*false\s*$/m.test(body),
        summary: cleanScalar(body.match(/^\s*summary:\s*([^\n]+)/m)?.[1] ?? ''),
        pattern: cleanScalar(body.match(/^\s*pattern:\s*([^\n]+)/m)?.[1] ?? ''),
      };
    });
  return { checks };
}

function renderCapsuleWithinBudget(capsule: Omit<SummonGhostCapsule, 'prompt'>): string {
  let next = { ...capsule };
  let prompt = renderCapsule(next);
  if (prompt.length <= capsule.budgetChars) return prompt;

  next = {
    ...next,
    obligations: next.obligations.slice(0, 4),
    composition: next.composition.slice(0, 3),
    visualRules: next.visualRules.slice(0, 3),
    contentRules: next.contentRules.slice(0, 2),
    avoid: next.avoid.slice(0, 3),
    vocabulary: {
      tokens: next.vocabulary.tokens.slice(0, 8),
      components: next.vocabulary.components.slice(0, 6),
      libraries: next.vocabulary.libraries.slice(0, 4),
    },
    ...(next.intentNote ? { intentNote: truncateSentence(next.intentNote, 140) } : {}),
  };
  prompt = renderCapsule(next);
  if (prompt.length <= capsule.budgetChars) return prompt;

  return renderCapsule({
    ...next,
    obligations: next.obligations.slice(0, 3),
    composition: next.composition.slice(0, 2),
    visualRules: [],
    contentRules: [],
    avoid: next.avoid.slice(0, 2),
    vocabulary: { tokens: [], components: [], libraries: [] },
    intentNote: undefined,
    warnings: [...next.warnings, 'Capsule was reduced to fit the prompt budget.'],
  }).slice(0, capsule.budgetChars);
}

function renderCapsule(capsule: Omit<SummonGhostCapsule, 'prompt'>): string {
  const lines = [
    `# ${capsule.product} Ghost Capsule`,
    '',
    'Use this compact Ghost capsule as product-experience guidance for this Summon surface. It is a selected projection of durable Ghost memory, not the full fingerprint.',
    '',
    `- Target: \`${capsule.targetPath}\``,
    `- Surface: ${[
      capsule.surface.purpose,
      capsule.surface.runtime,
      capsule.surface.data,
      capsule.surface.authority,
      capsule.surface.persistence,
    ].filter(Boolean).join('/') || capsule.surface.mode}${capsule.surface.shape ? `; shape=${capsule.surface.shape}` : ''}`,
    '',
    refsLine(capsule),
    section('Product Obligations', capsule.obligations),
    section('Composition Guidance', capsule.composition),
    section('Visual Guidance', capsule.visualRules),
    section('Content Guidance', capsule.contentRules),
    section('Avoid', capsule.avoid),
    vocabularySection(capsule.vocabulary),
    capsule.intentNote ? `## Human-Approved Intent\n\n${truncateSentence(capsule.intentNote, MAX_BULLET_CHARS)}` : '',
    capsule.warnings.length ? section('Capsule Warnings', capsule.warnings.slice(0, 3)) : '',
  ].filter(Boolean);
  return `${lines.join('\n')}\n`;
}

function refsLine(capsule: Omit<SummonGhostCapsule, 'prompt'>): string {
  const refs = [
    ...capsule.selectedRefs.situations.map((id) => `situation:${id}`),
    ...capsule.selectedRefs.principles.map((id) => `principle:${id}`),
    ...capsule.selectedRefs.experienceContracts.map((id) => `experience_contract:${id}`),
    ...capsule.selectedRefs.patterns.map((id) => `pattern:${id}`),
    ...capsule.selectedRefs.checks.map((id) => `check:${id}`),
  ];
  return refs.length ? `Selected Ghost refs: ${refs.map((ref) => `\`${ref}\``).join(', ')}` : '';
}

function section(title: string, values: string[]): string {
  if (values.length === 0) return '';
  return `## ${title}\n\n${values.map((value) => `- ${truncateSentence(value, MAX_BULLET_CHARS)}`).join('\n')}`;
}

function vocabularySection(vocabulary: SummonGhostCapsule['vocabulary']): string {
  const rows = [
    vocabulary.tokens.length ? `- Tokens: ${vocabulary.tokens.map((value) => `\`${value}\``).join(', ')}` : '',
    vocabulary.components.length ? `- Components: ${vocabulary.components.map((value) => `\`${value}\``).join(', ')}` : '',
    vocabulary.libraries.length ? `- Libraries: ${vocabulary.libraries.map((value) => `\`${value}\``).join(', ')}` : '',
  ].filter(Boolean);
  return rows.length ? `## Vocabulary\n\n${rows.join('\n')}` : '';
}

function surfaceContext(input: GhostCapsuleBuildInput): SummonGhostCapsule['surface'] {
  return {
    mode: input.mode ?? (input.surfacePlan?.runtime === 'static' ? 'static' : 'interactive'),
    purpose: input.surfacePlan?.purpose ?? null,
    runtime: input.surfacePlan?.runtime ?? null,
    data: input.surfacePlan?.data ?? null,
    authority: input.surfacePlan?.authority ?? null,
    persistence: input.surfacePlan?.persistence ?? null,
    shape: input.shape ?? null,
  };
}

function queryTermsFor(
  input: GhostCapsuleBuildInput,
  surface: SummonGhostCapsule['surface'],
): Set<string> {
  return new Set([
    ...terms(input.userPrompt ?? ''),
    ...terms(input.targetPath),
    ...terms(surface.purpose ?? ''),
    ...terms(surface.runtime ?? ''),
    ...terms(surface.data ?? ''),
    ...terms(surface.authority ?? ''),
    ...terms(surface.shape ?? ''),
  ]);
}

function rankItems<T extends GhostScoped & { id: string }>(
  items: T[],
  queryTerms: Set<string>,
  input: GhostCapsuleBuildInput,
  textFor: (item: T) => string,
  bonus: (item: T) => number = () => 0,
): T[] {
  return [...items].sort((a, b) =>
    scoreItem(b, queryTerms, input, textFor(b)) + bonus(b) -
    (scoreItem(a, queryTerms, input, textFor(a)) + bonus(a)),
  );
}

function scoreItem(
  item: GhostScoped,
  queryTerms: Set<string>,
  input: GhostCapsuleBuildInput,
  text: string,
): number {
  let score = 0;
  const scope = asRecord(item.applies_to) ?? item;
  const paths = stringArray(scope.paths);
  if (paths.some((path) => pathMatches(input.targetPath, path))) score += 60;
  const surfaceTypes = stringArray(scope.surface_types);
  if (surfaceTypes.some((type) => queryTerms.has(type.toLowerCase()))) score += 30;
  const textTerms = terms(text);
  for (const term of textTerms) {
    if (queryTerms.has(term)) score += 4;
  }
  return score;
}

function refsFromSituations(situations: GhostSituation[]) {
  return {
    principles: new Set(situations.flatMap((item) => item.principles ?? [])),
    experienceContracts: new Set(situations.flatMap((item) => item.experience_contracts ?? [])),
    patterns: new Set(situations.flatMap((item) => item.patterns ?? [])),
  };
}

function filterVocabulary(
  vocabulary: NormalizedGhostMemory['vocabulary'],
  componentPack: ComponentPack | null | undefined,
): SummonGhostCapsule['vocabulary'] {
  const allowedComponents = new Set(
    componentPack?.components.map((component) => component.name) ?? [],
  );
  const components = allowedComponents.size
    ? vocabulary.components.filter((component) => allowedComponents.has(component))
    : vocabulary.components;
  return {
    tokens: vocabulary.tokens.slice(0, 12),
    components: components.slice(0, 8),
    libraries: vocabulary.libraries.slice(0, 6),
  };
}

function accepted<T extends { status?: string }>(items: T[]): T[] {
  return items.filter((item) => !item.status || item.status === 'accepted');
}

function patternKindPriority(kind: string | undefined): number {
  if (kind === 'composition') return 30;
  if (kind === 'visual') return 20;
  if (kind === 'content') return 10;
  return 0;
}

function pathMatches(targetPath: string, rawPath: string): boolean {
  const target = normalizePath(targetPath || '.');
  const path = normalizePath(rawPath);
  return path === '.' || target === path || target.startsWith(`${path}/`);
}

function normalizePath(path: string): string {
  return path.trim().replaceAll('\\', '/').replace(/\/+/g, '/').replace(/^\.\/?/, '') || '.';
}

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((term) => term.length >= 3);
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString).map((item) => item.trim()).filter(Boolean) : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function idValue(value: unknown): string {
  return stringValue(value) ?? 'unnamed';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function stripRefPrefix(ref: string): string {
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(':');
  return colon === -1 ? trimmed : trimmed.slice(colon + 1);
}

function truncateSentence(value: string, max: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}
