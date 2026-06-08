import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const workDir = await mkdtemp(join(tmpdir(), 'summon-public-smoke-'));
const tarballDir = join(workDir, 'tarballs');
const projectDir = join(workDir, 'project');

function run(command, args, cwd = rootDir) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

await writeFile(join(workDir, 'README'), 'Summon public package smoke test scratch directory\n');

await mkdir(tarballDir, { recursive: true });
await mkdir(projectDir, { recursive: true });
for (const packageDir of ['packages/summon', 'packages/summon-server', 'packages/summon-react']) {
  run('npm', ['pack', '--pack-destination', tarballDir], join(rootDir, packageDir));
}

await writeFile(join(projectDir, 'package.json'), JSON.stringify({
  private: true,
  type: 'module',
  dependencies: {
    '@anarchitecture/summon': `file:${join(tarballDir, 'anarchitecture-summon-0.1.0.tgz')}`,
    '@anarchitecture/summon-server': `file:${join(tarballDir, 'anarchitecture-summon-server-0.1.0.tgz')}`,
    '@anarchitecture/summon-react': `file:${join(tarballDir, 'anarchitecture-summon-react-0.1.0.tgz')}`,
    react: '19.2.5',
    'react-dom': '19.2.5',
  },
  pnpm: {
    overrides: {
      '@anarchitecture/summon': `file:${join(tarballDir, 'anarchitecture-summon-0.1.0.tgz')}`,
    },
  },
}, null, 2) + '\n');

run('pnpm', ['install', '--ignore-scripts'], projectDir);

await writeFile(join(projectDir, 'smoke.mjs'), [
  "import { parseProtocolLine, createCapabilityRegistry } from '@anarchitecture/summon';",
  "import { spawnSandbox } from '@anarchitecture/summon/browser';",
  "import { PolicyEngine } from '@anarchitecture/summon/policy';",
  "import { createSurfaceEnvelope } from '@anarchitecture/summon/envelope';",
  "import { bootstrapSource, tokensSource } from '@anarchitecture/summon/assets';",
  "import { createEventStore } from '@anarchitecture/summon/devtools';",
  "import { runSurfaceGeneration, generateSurfaceStream, resolveSurfaceGenerationPlan } from '@anarchitecture/summon-server';",
  "import { SummonSurface, defineReactComponent } from '@anarchitecture/summon-react';",
  "if (typeof parseProtocolLine !== 'function') throw new Error('core import failed');",
  "if (typeof createCapabilityRegistry !== 'function') throw new Error('capability import failed');",
  "if (typeof spawnSandbox !== 'function') throw new Error('browser import failed');",
  "if (typeof PolicyEngine !== 'function') throw new Error('policy import failed');",
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
