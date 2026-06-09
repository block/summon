import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export const publicPackageDirs = [
  'packages/summon',
  'packages/summon-server',
  'packages/summon-react',
];

function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase().startsWith('npm_config_')) {
      delete env[key];
    }
  }
  return env;
}

async function createNpmScratch() {
  const dir = await mkdtemp(join(tmpdir(), 'summon-npm-'));
  const cacheDir = join(dir, 'cache');
  const userConfig = join(dir, '.npmrc');
  const globalConfig = join(dir, '.npm-globalrc');
  await mkdir(cacheDir, { recursive: true });
  await writeFile(userConfig, 'registry=https://registry.npmjs.org/\n');
  await writeFile(globalConfig, '');
  return { cacheDir, globalConfig, userConfig };
}

export async function readPackageManifest(packageDir) {
  const manifestPath = join(rootDir, packageDir, 'package.json');
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

export function tarballFileName(manifest) {
  const scopedName = manifest.name.startsWith('@')
    ? manifest.name.slice(1).replace('/', '-')
    : manifest.name;
  return `${scopedName}-${manifest.version}.tgz`;
}

export async function packPublicPackages(options = {}) {
  const {
    dryRun = false,
    destinationDir,
    json = true,
  } = options;
  const scratch = await createNpmScratch();
  if (destinationDir) await mkdir(destinationDir, { recursive: true });

  const out = [];
  for (const packageDir of publicPackageDirs) {
    const packagePath = join(rootDir, packageDir);
    const args = [
      'pack',
      packagePath,
      '--cache',
      scratch.cacheDir,
      '--globalconfig',
      scratch.globalConfig,
      '--userconfig',
      scratch.userConfig,
    ];
    if (json) args.push('--json');
    if (dryRun) args.push('--dry-run');
    if (destinationDir) args.push('--pack-destination', destinationDir);

    const stdout = execFileSync('npm', args, {
      cwd: dirname(scratch.userConfig),
      env: cleanEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const parsed = json ? JSON.parse(stdout) : [];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of entries) {
      out.push({
        packageDir,
        ...entry,
        ...(destinationDir && entry.filename
          ? { tarballPath: join(destinationDir, entry.filename) }
          : {}),
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  const destinationIndex = process.argv.indexOf('--pack-destination');
  const destinationDir = destinationIndex >= 0 ? process.argv[destinationIndex + 1] : undefined;
  const result = await packPublicPackages({ dryRun, destinationDir });
  console.log(JSON.stringify(result, null, 2));
}
