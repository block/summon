import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicPackages = [
  'packages/summon',
  'packages/summon-server',
  'packages/summon-react',
];
const inspectedExtensions = new Set(['.js', '.d.ts']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

function inspectable(path) {
  return path.endsWith('.d.ts') || inspectedExtensions.has(extname(path));
}

async function assertDist(packageDir) {
  const distDir = join(rootDir, packageDir, 'dist');
  const info = await stat(distDir);
  if (!info.isDirectory()) {
    throw new Error(`${packageDir}/dist is not a directory`);
  }
  return distDir;
}

const failures = [];

for (const packageDir of publicPackages) {
  const packageJsonPath = join(rootDir, packageDir, 'package.json');
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const manifestText = JSON.stringify({
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    optionalDependencies: manifest.optionalDependencies ?? {},
  });
  if (manifest.private) {
    failures.push(`${packageDir}/package.json must not be private`);
  }
  if (manifestText.includes('@summon-internal/')) {
    failures.push(`${packageDir}/package.json exposes @summon-internal dependencies`);
  }
  const distDir = await assertDist(packageDir);
  for await (const file of walk(distDir)) {
    if (file.endsWith('.map')) {
      failures.push(`${relative(rootDir, file)} should not be published in public package dist`);
      continue;
    }
    if (!inspectable(file)) continue;
    const text = await readFile(file, 'utf8');
    if (text.includes('@summon-internal/')) {
      failures.push(`${relative(rootDir, file)} imports @summon-internal`);
    }
    if (text.includes('sourceMappingURL=')) {
      failures.push(`${relative(rootDir, file)} references an unpublished source map`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('public package dist is clean');
