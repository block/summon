import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  packPublicPackages,
  rootDir,
} from './pack-public-packages.mjs';

const workDir = await mkdtemp(join(tmpdir(), 'summon-public-smoke-'));
const tarballDir = join(workDir, 'tarballs');
const projectDir = join(workDir, 'project');

function run(command, args, cwd = rootDir) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

await writeFile(join(workDir, 'README'), 'Summon public package smoke test scratch directory\n');

await mkdir(tarballDir, { recursive: true });
await mkdir(projectDir, { recursive: true });
const packed = await packPublicPackages({ destinationDir: tarballDir });
const byName = new Map(packed.map((entry) => [entry.name, entry]));
const rootManifest = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'));
const core = byName.get('@anarchitecture/summon');
const serverPackage = byName.get('@anarchitecture/summon-server');
const react = byName.get('@anarchitecture/summon-react');
if (!core?.tarballPath || !serverPackage?.tarballPath || !react?.tarballPath) {
  throw new Error('public package smoke could not find all packed tarballs');
}

await writeFile(join(projectDir, 'package.json'), JSON.stringify({
  private: true,
  type: 'module',
  packageManager: rootManifest.packageManager,
  dependencies: {
    '@anarchitecture/summon': `file:${core.tarballPath}`,
    '@anarchitecture/summon-server': `file:${serverPackage.tarballPath}`,
    '@anarchitecture/summon-react': `file:${react.tarballPath}`,
    react: '19.2.5',
    'react-dom': '19.2.5',
  },
  pnpm: {
    overrides: {
      '@anarchitecture/summon': `file:${core.tarballPath}`,
    },
  },
}, null, 2) + '\n');
await writeFile(join(projectDir, '.npmrc'), [
  'registry=https://registry.npmjs.org/',
  'link-workspace-packages=false',
  'auto-install-peers=false',
  '',
].join('\n'));

run('pnpm', ['install', '--ignore-scripts'], projectDir);

await writeFile(join(projectDir, 'smoke.mjs'), [
  "import {",
  "  createToolRegistry,",
  "  defineToolHandler,",
  "  PolicyEngine,",
  "} from '@anarchitecture/summon';",
  "import { mountInlineSurface, consumeSurfaceStream } from '@anarchitecture/summon/browser';",
  "import { compileSystemContracts, parseProtocolLine, StreamGraph } from '@anarchitecture/summon/engine';",
  "import { mountInlineSurface as hostMountInlineSurface, PolicyEngine as HostPolicyEngine } from '@anarchitecture/summon/host';",
  "import { PolicyEngine as PolicyEngineFromPolicy } from '@anarchitecture/summon/policy';",
  "import { createSurfaceEnvelope, parseSurfaceEnvelope } from '@anarchitecture/summon/envelope';",
  "import { tokensSource } from '@anarchitecture/summon/assets';",
  "import { createEventStore } from '@anarchitecture/summon/devtools';",
  "import { runSurfaceGeneration, policyFromGoal, summarizeContractIssues } from '@anarchitecture/summon-server';",
  "import { SummonSurface } from '@anarchitecture/summon-react';",
  "",
  "const root = await import('@anarchitecture/summon');",
  "const server = await import('@anarchitecture/summon-server');",
  "if (typeof createToolRegistry !== 'function') throw new Error('tool import failed');",
  "if (typeof defineToolHandler !== 'function' || typeof PolicyEngine !== 'function') throw new Error('policy helper import failed');",
  "if (typeof parseProtocolLine !== 'function' || typeof compileSystemContracts !== 'function') throw new Error('engine compiler import failed');",
  "if (typeof StreamGraph !== 'function') throw new Error('engine diagnostic import failed');",
  "if (typeof mountInlineSurface !== 'function' || typeof consumeSurfaceStream !== 'function') throw new Error('browser import failed');",
  "if (typeof hostMountInlineSurface !== 'function' || typeof HostPolicyEngine !== 'function') throw new Error('host import failed');",
  "if (typeof PolicyEngineFromPolicy !== 'function') throw new Error('policy subpath import failed');",
  "if (typeof createSurfaceEnvelope !== 'function' || typeof parseSurfaceEnvelope !== 'function') throw new Error('envelope import failed');",
  "if (typeof tokensSource !== 'string') throw new Error('assets import failed');",
  "if (typeof createEventStore !== 'function') throw new Error('devtools import failed');",
  "if (typeof runSurfaceGeneration !== 'function' || typeof policyFromGoal !== 'function' || typeof summarizeContractIssues !== 'function') throw new Error('server import failed');",
  "if (!SummonSurface) throw new Error('react import failed');",
  "for (const forbidden of ['spawnSandbox', 'compileSystemContracts', 'buildToolsBlock', 'parseProtocolLine', 'StreamGraph']) {",
  "  if (forbidden in root) throw new Error(`root leaked ${forbidden}`);",
  "}",
  "for (const forbidden of ['buildEditBlock', 'generateSurfaceStream', 'resolveSurfaceGenerationPlan', 'policyFromIntent']) {",
  "  if (forbidden in server) throw new Error(`server exposes ${forbidden}`);",
  "}",
  "",
  "async function expectRejected(specifier) {",
  "  try {",
  "    await import(specifier);",
  "  } catch {",
  "    return;",
  "  }",
  "  throw new Error(`${specifier} should not be importable`);",
  "}",
  "",
  "await expectRejected('@anarchitecture/summon/server');",
  "await expectRejected('@anarchitecture/summon/_internal/engine/index.js');",
  "await expectRejected('@anarchitecture/summon-server/_internal/server/index.js');",
  "await expectRejected('@anarchitecture/summon-react/_internal/react/index.js');",
  "console.log('public package smoke imports passed');",
  '',
].join('\n'));

run('node', ['smoke.mjs'], projectDir);
console.log(`public package smoke test completed in ${workDir}`);
