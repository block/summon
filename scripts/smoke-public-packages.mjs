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
const server = byName.get('@anarchitecture/summon-server');
const react = byName.get('@anarchitecture/summon-react');
if (!core?.tarballPath || !server?.tarballPath || !react?.tarballPath) {
  throw new Error('public package smoke could not find all packed tarballs');
}

await writeFile(join(projectDir, 'package.json'), JSON.stringify({
  private: true,
  type: 'module',
  packageManager: rootManifest.packageManager,
  dependencies: {
    '@anarchitecture/summon': `file:${core.tarballPath}`,
    '@anarchitecture/summon-server': `file:${server.tarballPath}`,
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

run('pnpm', ['install', '--ignore-scripts'], projectDir);

await writeFile(join(projectDir, 'smoke.mjs'), [
  "import { createCapabilityRegistry, deriveSurfacePlanControls, PolicyEngine } from '@anarchitecture/summon';",
  "import { consumeSurfaceStream, spawnSandbox } from '@anarchitecture/summon/browser';",
  "import { parseProtocolLine, compileSystemContracts, SectionAccumulator } from '@anarchitecture/summon/engine';",
  "import { spawnSandbox as hostSpawnSandbox } from '@anarchitecture/summon/host';",
  "import { PolicyEngine as PolicyEngineFromPolicy } from '@anarchitecture/summon/policy';",
  "import { createSurfaceEnvelope } from '@anarchitecture/summon/envelope';",
  "import { bootstrapSource, tokensSource } from '@anarchitecture/summon/assets';",
  "import { createEventStore } from '@anarchitecture/summon/devtools';",
  "import { runSurfaceGeneration, generateSurfaceStream, resolveSurfaceGenerationPlan } from '@anarchitecture/summon-server';",
  "import { SummonSurface, defineReactComponent } from '@anarchitecture/summon-react';",
  "const root = await import('@anarchitecture/summon');",
  "for (const forbidden of ['spawnSandbox', 'compileSystemContracts', 'buildCapabilitiesBlock']) {",
  "  if (forbidden in root) throw new Error(`root leaked ${forbidden}`);",
  "}",
  "if (typeof createCapabilityRegistry !== 'function' || typeof deriveSurfacePlanControls !== 'function') throw new Error('root import failed');",
  "if (typeof parseProtocolLine !== 'function' || typeof compileSystemContracts !== 'function' || typeof SectionAccumulator !== 'function') throw new Error('engine import failed');",
  "if (typeof spawnSandbox !== 'function') throw new Error('browser import failed');",
  "if (typeof consumeSurfaceStream !== 'function') throw new Error('browser stream import failed');",
  "if (typeof hostSpawnSandbox !== 'function') throw new Error('host import failed');",
  "if (typeof PolicyEngine !== 'function' || typeof PolicyEngineFromPolicy !== 'function') throw new Error('policy import failed');",
  "if (typeof createSurfaceEnvelope !== 'function') throw new Error('envelope import failed');",
  "if (typeof bootstrapSource !== 'string' || typeof tokensSource !== 'string') throw new Error('assets import failed');",
  "if (typeof createEventStore !== 'function') throw new Error('devtools import failed');",
  "if (typeof runSurfaceGeneration !== 'function' || typeof generateSurfaceStream !== 'function' || typeof resolveSurfaceGenerationPlan !== 'function') throw new Error('server import failed');",
  "if (typeof SummonSurface !== 'function' || typeof defineReactComponent !== 'function') throw new Error('react import failed');",
  "console.log('public package smoke imports passed');",
  '',
].join('\n'));

run('node', ['smoke.mjs'], projectDir);
console.log(`public package smoke test completed in ${workDir}`);
