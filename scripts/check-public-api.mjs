import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const expectedRootExports = [
  'IntentArgsError',
  'PolicyEngine',
  'SURFACE_PERSISTENCE_VALUES',
  'SURFACE_PURPOSE_VALUES',
  'SURFACE_TIER_VALUES',
  'compileSurfacePolicy',
  'createCapabilityRegistry',
  'createComponentRegistry',
  'defineAction',
  'defineApprovalAction',
  'defineCapability',
  'defineComponent',
  'defineDataResource',
  'defineIntent',
  'defineWorkerAction',
  'defineWorkerResource',
  'normalizeSurfacePolicy',
].sort();

const expectedServerExports = [
  'generateSurfaceStream',
  'resolveSurfaceGenerationPlan',
  'runSurfaceGeneration',
  'summarizeContractIssues',
].sort();

const expectedReactExports = [
  'SummonSurface',
  'defineReactComponent',
].sort();

const forbiddenRootExports = [
  'bootstrapSource',
  'buildCapabilitiesBlock',
  'compileSystemContracts',
  'consumeSurfaceStream',
  'createEventStore',
  'createSurfaceEnvelope',
  'parseProtocolLine',
  'SectionAccumulator',
  'spawnSandbox',
  'StreamGraph',
];

async function importDist(packageName, entry = 'index.js') {
  const path = join(rootDir, 'packages', packageName, 'dist', entry);
  return import(pathToFileURL(path).href);
}

function assertExactExports(name, mod, expected) {
  const actual = Object.keys(mod).sort();
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  if (missing.length || extra.length) {
    throw new Error([
      `${name} exports drifted`,
      missing.length ? `missing: ${missing.join(', ')}` : null,
      extra.length ? `extra: ${extra.join(', ')}` : null,
    ].filter(Boolean).join('\n'));
  }
}

function assertHas(name, mod, exports) {
  const missing = exports.filter((item) => !(item in mod));
  if (missing.length) {
    throw new Error(`${name} is missing expected exports: ${missing.join(', ')}`);
  }
}

const core = await importDist('summon');
assertExactExports('@anarchitecture/summon', core, expectedRootExports);
for (const forbidden of forbiddenRootExports) {
  if (forbidden in core) {
    throw new Error(`@anarchitecture/summon root must not export ${forbidden}`);
  }
}

assertHas('@anarchitecture/summon/browser', await importDist('summon', 'browser.js'), [
  'consumeSurfaceStream',
  'createComponentIslandRegistry',
  'createStrictInputRegistry',
  'spawnSandbox',
]);
assertHas('@anarchitecture/summon/engine', await importDist('summon', 'engine.js'), [
  'buildCapabilitiesBlock',
  'compileSystemContracts',
  'createProtocolHardener',
  'parseProtocolLine',
  'SectionAccumulator',
  'StreamGraph',
]);
assertHas('@anarchitecture/summon/host', await importDist('summon', 'host.js'), [
  'createCapabilityRegistry',
  'PolicyEngine',
  'spawnSandbox',
]);
assertHas('@anarchitecture/summon/policy', await importDist('summon', 'policy.js'), [
  'PolicyEngine',
]);
assertHas('@anarchitecture/summon/envelope', await importDist('summon', 'envelope.js'), [
  'createSurfaceEnvelope',
]);
const assets = await importDist('summon', 'assets.js');
if (typeof assets.bootstrapSource !== 'string' || typeof assets.tokensSource !== 'string') {
  throw new Error('@anarchitecture/summon/assets must export bootstrapSource and tokensSource strings');
}
assertHas('@anarchitecture/summon/devtools', await importDist('summon', 'devtools.js'), [
  'createEventStore',
]);

assertExactExports(
  '@anarchitecture/summon-server',
  await importDist('summon-server'),
  expectedServerExports,
);
assertExactExports(
  '@anarchitecture/summon-react',
  await importDist('summon-react'),
  expectedReactExports,
);

const manifest = JSON.parse(await readFile(join(rootDir, 'packages/summon/package.json'), 'utf8'));
for (const subpath of ['./engine', './host']) {
  if (!manifest.exports?.[subpath]) {
    throw new Error(`@anarchitecture/summon package.json must export ${subpath}`);
  }
}

console.log('public API snapshot is stable');
