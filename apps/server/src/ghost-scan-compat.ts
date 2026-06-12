import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { parse as parseYaml } from 'yaml';

type GhostScanModule = Record<string, unknown>;

export interface GhostStackLayerCompat {
  root: string;
  relativeRoot: string;
  memoryDir: string;
}

export interface GhostStackCompat {
  repoRoot: string;
  targetPath: string;
  memoryDir: string;
  layers: GhostStackLayerCompat[];
  provenance: {
    merge: string;
    layers: Array<{ relativeRoot: string; memoryDir: string }>;
  };
  product: string | null;
  raw: unknown;
}

export interface GhostContextCompat {
  name: string;
  raw: unknown;
  writePrompt: () => Promise<string>;
}

export interface ResolvedGhostRootCompat {
  stack: GhostStackCompat;
  context: GhostContextCompat;
}

let scanModulePromise: Promise<GhostScanModule> | null = null;

function loadScanModule(): Promise<GhostScanModule> {
  scanModulePromise ??= import('@anarchitecture/ghost/scan') as Promise<GhostScanModule>;
  return scanModulePromise;
}

export function normalizeGhostMemoryDir(raw: string): string {
  const normalized = raw.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
  if (!normalized || normalized === '.') return '.ghost';
  if (normalized.startsWith('/') || isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('ghost.memoryDir must be relative');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('ghost.memoryDir must not contain path traversal segments');
  }
  return segments.join('/');
}

export async function readGhostPackageConfig(configPath: string): Promise<any | null> {
  const scan = await loadScanModule();
  const reader = scan.readOptionalPackageConfig;
  if (typeof reader === 'function') {
    return reader(configPath);
  }
  if (!existsSync(configPath) || !statSync(configPath).isFile()) return null;
  const raw = await readFile(configPath, 'utf-8');
  return parseYaml(raw) as any;
}

export async function resolveGhostRootCompat(input: {
  root: string;
  targetPath: string;
  memoryDir: string;
}): Promise<ResolvedGhostRootCompat> {
  const scan = await loadScanModule();
  const newLoader = scan.loadFingerprintStackForPath;
  const newContext = scan.fingerprintStackToPackageContext;
  const newWriter = scan.writePackageContextBundleFromContext;
  const packageRoot = findNearestPackageRoot(input.root, input.targetPath, input.memoryDir);
  if (
    packageRoot &&
    typeof newLoader === 'function' &&
    typeof newContext === 'function' &&
    typeof newWriter === 'function'
  ) {
    const rawStack = await newLoader(input.targetPath, input.root, { memoryDir: input.memoryDir });
    const rawContext = newContext(rawStack);
    return normalizeScannerStack({
      rawStack,
      rawContext,
      writePrompt: () => writeScannerPrompt(rawContext, newWriter),
      product: productFromNewStack(rawStack) ?? nameFromContext(rawContext),
      memoryDir: stringAt(rawStack, 'fingerprint_dir') ?? input.memoryDir,
      layerMemoryDirKey: 'fingerprint_dir',
    });
  }

  if (packageRoot) {
    return loadSplitPackageRoot(input.root, packageRoot, input.targetPath, input.memoryDir);
  }

  const oldLoader = scan.loadMemoryStackForPath;
  const oldContext = scan.memoryStackToPackageMemory;
  const oldWriter = scan.writePackageContextBundleFromMemory;
  if (
    typeof oldLoader === 'function' &&
    typeof oldContext === 'function' &&
    typeof oldWriter === 'function'
  ) {
    const rawStack = await oldLoader(input.targetPath, input.root, { memoryDir: input.memoryDir });
    const rawContext = oldContext(rawStack);
    return normalizeScannerStack({
      rawStack,
      rawContext,
      writePrompt: () => writeScannerPrompt(rawContext, oldWriter),
      product: productFromLegacyStack(rawStack) ?? nameFromContext(rawContext),
      memoryDir: stringAt(rawStack, 'memory_dir') ?? input.memoryDir,
      layerMemoryDirKey: 'memory_dir',
    });
  }

  const legacyRoot = findNearestLegacyRoot(input.root, input.targetPath, input.memoryDir);
  if (legacyRoot) {
    return loadLegacyPackageRoot(input.root, legacyRoot, input.targetPath, input.memoryDir);
  }

  throw new Error(`No ${input.memoryDir}/fingerprint/manifest.yml or ${input.memoryDir}/fingerprint.yml found`);
}

async function writeScannerPrompt(rawContext: unknown, writer: unknown): Promise<string> {
  const dir = await makeTempDir();
  try {
    await (writer as (context: unknown, opts: { outDir: string; promptOnly: boolean }) => Promise<unknown>)(
      rawContext,
      { outDir: dir, promptOnly: true },
    );
    return await readFile(join(dir, 'prompt.md'), 'utf-8');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function loadSplitPackageRoot(
  repoRoot: string,
  packageRoot: string,
  targetPath: string,
  memoryDir: string,
): Promise<ResolvedGhostRootCompat> {
  const ghostRoot = join(packageRoot, memoryDir);
  const fingerprintRoot = join(ghostRoot, 'fingerprint');
  const [manifestRaw, proseRaw, inventoryRaw, compositionRaw, checksRaw, intent] = await Promise.all([
    readRequired(join(fingerprintRoot, 'manifest.yml')),
    readOptional(join(fingerprintRoot, 'prose.yml')),
    readOptional(join(fingerprintRoot, 'inventory.yml')),
    readOptional(join(fingerprintRoot, 'composition.yml')),
    readOptional(join(fingerprintRoot, 'enforcement', 'checks.yml')),
    readOptional(join(fingerprintRoot, 'memory', 'intent.md')),
  ]);
  const manifest = parseYaml(manifestRaw) as Record<string, any>;
  const prose = proseRaw ? parseYaml(proseRaw) as Record<string, any> : {};
  const inventory = inventoryRaw ? parseYaml(inventoryRaw) as Record<string, any> : {};
  const composition = compositionRaw ? parseYaml(compositionRaw) as Record<string, any> : {};
  const product = stringAt(prose, 'summary', 'product') ?? stringAt(manifest, 'id') ?? 'Ghost';
  const relRoot = displayRelative(repoRoot, packageRoot);
  const stack = stackForManualRoot({
    repoRoot,
    targetPath,
    memoryDir,
    packageRoot,
    relativeRoot: relRoot,
    product,
  });
  const context = {
    manifest,
    prose,
    inventory,
    composition,
    checksRaw,
    intent,
  };
  return {
    stack,
    context: {
      name: product,
      raw: context,
      writePrompt: () => promptForSplitPackage({ product, manifestRaw, proseRaw, inventoryRaw, compositionRaw, intent }),
    },
  };
}

async function loadLegacyPackageRoot(
  repoRoot: string,
  packageRoot: string,
  targetPath: string,
  memoryDir: string,
): Promise<ResolvedGhostRootCompat> {
  const ghostRoot = join(packageRoot, memoryDir);
  const [fingerprintRaw, checksRaw, intent] = await Promise.all([
    readRequired(join(ghostRoot, 'fingerprint.yml')),
    readOptional(join(ghostRoot, 'checks.yml')),
    readOptional(join(ghostRoot, 'intent.md')),
  ]);
  const fingerprint = parseYaml(fingerprintRaw) as Record<string, any>;
  const product = stringAt(fingerprint, 'summary', 'product') ?? 'Ghost';
  const relRoot = displayRelative(repoRoot, packageRoot);
  return {
    stack: stackForManualRoot({
      repoRoot,
      targetPath,
      memoryDir,
      packageRoot,
      relativeRoot: relRoot,
      product,
    }),
    context: {
      name: product,
      raw: { fingerprint, checksRaw, intent },
      writePrompt: () => promptForLegacyPackage({ product, fingerprintRaw, checksRaw, intent }),
    },
  };
}

function normalizeScannerStack(input: {
  rawStack: any;
  rawContext: any;
  writePrompt: () => Promise<string>;
  product: string | null;
  memoryDir: string;
  layerMemoryDirKey: 'fingerprint_dir' | 'memory_dir';
}): ResolvedGhostRootCompat {
  const rawLayers = Array.isArray(input.rawStack?.layers) ? input.rawStack.layers : [];
  const layers: GhostStackLayerCompat[] = rawLayers.map((layer: any): GhostStackLayerCompat => ({
    root: resolve(String(layer.root ?? input.rawStack.repo_root)),
    relativeRoot: String(layer.relative_root ?? '.'),
    memoryDir: String(layer[input.layerMemoryDirKey] ?? input.memoryDir),
  }));
  const provenanceLayers: GhostStackCompat['provenance']['layers'] = Array.isArray(input.rawStack?.provenance?.layers)
    ? input.rawStack.provenance.layers.map((layer: any) => ({
        relativeRoot: String(layer.relative_root ?? '.'),
        memoryDir: String(layer[input.layerMemoryDirKey] ?? layer.memory_dir ?? input.memoryDir),
      }))
    : layers.map((layer) => ({ relativeRoot: layer.relativeRoot, memoryDir: layer.memoryDir }));
  return {
    stack: {
      repoRoot: resolve(String(input.rawStack.repo_root)),
      targetPath: String(input.rawStack.target_path ?? '.'),
      memoryDir: input.memoryDir,
      layers,
      provenance: {
        merge: String(input.rawStack?.provenance?.merge ?? 'child-wins-by-id'),
        layers: provenanceLayers,
      },
      product: input.product,
      raw: input.rawStack,
    },
    context: {
      name: nameFromContext(input.rawContext) ?? input.product ?? 'Ghost',
      raw: input.rawContext,
      writePrompt: input.writePrompt,
    },
  };
}

function stackForManualRoot(input: {
  repoRoot: string;
  targetPath: string;
  memoryDir: string;
  packageRoot: string;
  relativeRoot: string;
  product: string | null;
}): GhostStackCompat {
  return {
    repoRoot: resolve(input.repoRoot),
    targetPath: input.targetPath,
    memoryDir: input.memoryDir,
    layers: [{
      root: resolve(input.packageRoot),
      relativeRoot: input.relativeRoot,
      memoryDir: input.memoryDir,
    }],
    provenance: {
      merge: 'child-wins-by-id',
      layers: [{ relativeRoot: input.relativeRoot, memoryDir: input.memoryDir }],
    },
    product: input.product,
    raw: null,
  };
}

async function promptForSplitPackage(input: {
  product: string;
  manifestRaw: string;
  proseRaw: string | null;
  inventoryRaw: string | null;
  compositionRaw: string | null;
  intent: string | null;
}): Promise<string> {
  return [
    `# ${input.product} Ghost Fingerprint Context`,
    '',
    'Use this checked-in Ghost fingerprint as a product design direction package for generation.',
    '',
    'Generate from prose + inventory + composition. Prose states intent, inventory supplies source material and evidence, and composition defines reusable surface patterns. Treat checks as validation constraints; only active checks are blocking.',
    '',
    '## Manifest',
    codeBlock(input.manifestRaw),
    input.proseRaw ? `## Prose\n\n${codeBlock(input.proseRaw)}` : '',
    input.inventoryRaw ? `## Inventory\n\n${codeBlock(input.inventoryRaw)}` : '',
    input.compositionRaw ? `## Composition\n\n${codeBlock(input.compositionRaw)}` : '',
    input.intent ? `## Human-Approved Intent\n\n${input.intent.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

async function promptForLegacyPackage(input: {
  product: string;
  fingerprintRaw: string;
  checksRaw: string | null;
  intent: string | null;
}): Promise<string> {
  return [
    `# ${input.product} Ghost Fingerprint Context`,
    '',
    'Use this legacy Ghost fingerprint.yml as compatibility product design direction for generation.',
    '',
    'Generate from the fingerprint intent and composition fields. Treat checks as validation constraints, not as content to render.',
    '',
    '## Fingerprint',
    codeBlock(input.fingerprintRaw),
    input.checksRaw ? `## Checks\n\n${codeBlock(input.checksRaw)}` : '',
    input.intent ? `## Human-Approved Intent\n\n${input.intent.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

function codeBlock(value: string): string {
  return `\`\`\`yaml\n${value.trim()}\n\`\`\``;
}

function findNearestPackageRoot(root: string, targetPath: string, memoryDir: string): string | null {
  return findNearestRootWith(root, targetPath, join(memoryDir, 'fingerprint', 'manifest.yml'));
}

function findNearestLegacyRoot(root: string, targetPath: string, memoryDir: string): string | null {
  return findNearestRootWith(root, targetPath, join(memoryDir, 'fingerprint.yml'));
}

function findNearestRootWith(root: string, targetPath: string, relativeNeedle: string): string | null {
  const repoRoot = resolve(root);
  let cursor = resolve(repoRoot, targetPath);
  if (existsSync(cursor) && statSync(cursor).isFile()) cursor = dirname(cursor);
  while (isWithinOrEqual(repoRoot, cursor)) {
    if (existsSync(join(cursor, relativeNeedle))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return null;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function readRequired(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `summon-ghost-context-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function productFromNewStack(stack: any): string | null {
  return stringAt(stack, 'merged', 'fingerprint', 'prose', 'summary', 'product');
}

function productFromLegacyStack(stack: any): string | null {
  return stringAt(stack, 'merged', 'fingerprint', 'summary', 'product');
}

function nameFromContext(context: any): string | null {
  return typeof context?.name === 'string' && context.name.trim() ? context.name.trim() : null;
}

function stringAt(obj: any, ...path: string[]): string | null {
  let value = obj;
  for (const key of path) {
    value = value?.[key];
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function displayRelative(root: string, path: string): string {
  const rel = relative(resolve(root), resolve(path));
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel || '.' : '.';
}

function isWithinOrEqual(root: string, child: string): boolean {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
