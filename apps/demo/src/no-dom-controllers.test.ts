import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const srcRoot = new URL('.', import.meta.url).pathname;
const artifactFiles = new Set([
  'adversarial-artifact.ts',
]);

const forbiddenPatterns = [
  { label: 'document.getElementById', pattern: /document\.getElementById\(/ },
  { label: 'document.querySelector', pattern: /document\.querySelector(All)?\(/ },
  { label: 'document.createElement', pattern: /document\.createElement\(/ },
  { label: 'innerHTML assignment', pattern: /\.innerHTML\s*=/ },
  { label: 'classList mutation', pattern: /\.classList\./ },
];

test('demo host pages stay React-state driven instead of DOM-controller driven', () => {
  const violations: string[] = [];
  for (const file of walk(srcRoot)) {
    const rel = relative(srcRoot, file);
    if (artifactFiles.has(rel) || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
    const source = rel === 'main.tsx'
      ? readFileSync(file, 'utf8').replace("document.getElementById('root')", '')
      : readFileSync(file, 'utf8');
    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(source)) violations.push(`${rel}: ${label}`);
    }
  }

  assert.deepEqual(violations, []);
});

test('generate page exposes experimental runtime selection through the UI request path', () => {
  const page = readFileSync(join(srcRoot, 'pages/generate/GeneratePage.tsx'), 'utf8');
  const stage = readFileSync(join(srcRoot, 'pages/generate/components/GenerationStage.tsx'), 'utf8');
  const stream = readFileSync(join(srcRoot, 'pages/generate/hooks/useSurfaceStream.ts'), 'utf8');

  assert.match(stage, /id="stream-type-picker"/);
  assert.match(stage, /overline="Runtime"/);
  assert.match(stage, /value=\{experimentalRuntime\}/);
  assert.match(stage, /function runtimeGroups/);
  assert.match(stage, /hover:opacity-85/);
  assert.match(stage, /html-static/);
  assert.match(stage, /html-stream/);
  assert.doesNotMatch(stage, /unsafe/);
  assert.doesNotMatch(page, /unsafeRuntimeGateEnabled/);
  assert.match(stream, /experimentalRuntime: opts\.experimentalRuntime/);
});

test('generate defaults to showcase mode with broker and a catalog fingerprint', () => {
  const page = readFileSync(join(srcRoot, 'pages/generate/GeneratePage.tsx'), 'utf8');

  assert.match(page, /const \[playgroundMode, setPlaygroundMode\] = useState\(false\)/);
  assert.match(page, /const \[agentBrokerEnabled, setAgentBrokerEnabled\] = useState\(true\)/);
  assert.match(page, /const \[runProfile, setRunProfile\] = useState<RunProfile>\("quality"\)/);
  assert.match(page, /const \[fingerprintId, setFingerprintId\] = useState<string \| null>\(\s*DEFAULT_FINGERPRINT_ID,\s*\)/);
  assert.match(page, /No Ghost fingerprint catalog is available/);
});

test('scenario selection preserves the selected fingerprint', () => {
  const page = readFileSync(join(srcRoot, 'pages/generate/GeneratePage.tsx'), 'utf8');
  const match = page.match(/function applyScenario\(id: string\) \{[\s\S]*?\n  \}/);

  assert.ok(match, 'expected applyScenario function');
  assert.doesNotMatch(match[0], /setFingerprintId|setDirectionId|DEFAULT_FINGERPRINT_ID/);
});

test('generation callers use fingerprint steering instead of plain directionId payloads', () => {
  const stream = readFileSync(join(srcRoot, 'pages/generate/hooks/useSurfaceStream.ts'), 'utf8');
  const child = readFileSync(join(srcRoot, 'pages/generate/components/ChildSurface.tsx'), 'utf8');
  const batch = readFileSync(join(srcRoot, 'pages/BatchPage.tsx'), 'utf8');

  assert.match(stream, /buildFingerprintSteeringPayload/);
  assert.match(stream, /id: opts\.fingerprintId/);
  assert.doesNotMatch(stream, /\bdirectionId\b/);
  assert.match(child, /buildFingerprintSteeringPayload/);
  assert.doesNotMatch(child, /\bdirectionId\b/);
  assert.match(batch, /\/api\/fingerprints/);
  assert.match(batch, /buildFingerprintSteeringPayload/);
  assert.match(batch, /experimentalRuntime: run\.runtime/);
  assert.match(batch, /name="runtime-mode"/);
  assert.match(batch, /id="batch-runtime"/);
  assert.match(batch, /SUMMON_OUTPUT_RUNTIME_VALUES/);
  assert.doesNotMatch(batch, /\bdirectionId\b/);
});

test('dropdown select items use prompt-scale rounding', () => {
  const ui = readFileSync(join(srcRoot, 'components/ui.tsx'), 'utf8');

  assert.match(ui, /rounded-\[22px\]/);
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}
