import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicApiManifest = JSON.parse(
  await readFile(join(rootDir, 'scripts/public-api-manifest.json'), 'utf8'),
);
const publicPackages = Object.keys(publicApiManifest);
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

function sortedUnique(values) {
  return Array.from(new Set(values)).sort();
}

function exportedNames(text, kind) {
  const names = [];
  const re = /export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/g;
  let match;
  while ((match = re.exec(text))) {
    const isType = Boolean(match[1]);
    if ((kind === 'type') !== isType) continue;
    for (const raw of match[2].split(',')) {
      const name = raw.trim();
      if (!name) continue;
      names.push(name.split(/\s+as\s+/)[1]?.trim() ?? name);
    }
  }
  return sortedUnique(names);
}

function equalList(a, b) {
  const left = sortedUnique(a);
  const right = sortedUnique(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function listDiff(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const extra = actual.filter((name) => !expectedSet.has(name));
  const missing = expected.filter((name) => !actualSet.has(name));
  return { extra, missing };
}

function assertExportList(failures, label, actual, expected) {
  if (equalList(actual, expected)) return;
  const { extra, missing } = listDiff(actual, expected);
  failures.push(
    `${label} does not match public API manifest` +
      `${extra.length ? `; extra: ${extra.join(', ')}` : ''}` +
      `${missing.length ? `; missing: ${missing.join(', ')}` : ''}`,
  );
}

async function assertNoPublicRootDirs(packageDir, distDir, failures) {
  for (const entry of await readdir(distDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_internal') continue;
    failures.push(`${packageDir}/dist/${entry.name} is a public-looking implementation directory`);
  }
}

async function assertPublicApi(packageDir, distDir, failures) {
  const packageManifest = publicApiManifest[packageDir];
  for (const [subpath, expected] of Object.entries(packageManifest)) {
    const jsPath = join(distDir, `${expected.file}.js`);
    const dtsPath = join(distDir, `${expected.file}.d.ts`);
    const jsText = await readFile(jsPath, 'utf8');
    const dtsText = await readFile(dtsPath, 'utf8');

    if (/export\s+\*/.test(jsText)) {
      failures.push(`${relative(rootDir, jsPath)} must not use export *`);
    }
    if (/export\s+\*/.test(dtsText)) {
      failures.push(`${relative(rootDir, dtsPath)} must not use export *`);
    }

    assertExportList(
      failures,
      `${packageDir} ${subpath} value exports`,
      exportedNames(jsText, 'value'),
      expected.values,
    );
    assertExportList(
      failures,
      `${packageDir} ${subpath} declaration value exports`,
      exportedNames(dtsText, 'value'),
      expected.values,
    );
    assertExportList(
      failures,
      `${packageDir} ${subpath} type exports`,
      exportedNames(dtsText, 'type'),
      expected.types,
    );
  }
}

async function readPublicPackageManifests() {
  return Promise.all(
    publicPackages.map(async (packageDir) => {
      const packageJsonPath = join(rootDir, packageDir, 'package.json');
      const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      return { packageDir, manifest };
    }),
  );
}

function assertPublicPackageVersions(publicPackageManifests, failures) {
  const versions = new Map();
  for (const { manifest } of publicPackageManifests) {
    const packages = versions.get(manifest.version) ?? [];
    packages.push(manifest.name);
    versions.set(manifest.version, packages);
  }

  if (versions.size > 1) {
    failures.push(
      `public package versions must match: ${Array.from(versions)
        .map(([version, packages]) => `${version} (${packages.join(', ')})`)
        .join('; ')}`,
    );
  }

  const corePackage = publicPackageManifests.find(
    ({ manifest }) => manifest.name === '@anarchitecture/summon',
  );
  if (!corePackage) {
    failures.push('public package manifests must include @anarchitecture/summon');
    return;
  }

  const expectedCoreRange = `^${corePackage.manifest.version}`;
  for (const { packageDir, manifest } of publicPackageManifests) {
    if (manifest.name === corePackage.manifest.name) continue;
    const actualRange = manifest.dependencies?.[corePackage.manifest.name];
    if (actualRange !== expectedCoreRange) {
      failures.push(
        `${packageDir}/package.json must depend on ${corePackage.manifest.name}@${expectedCoreRange}`,
      );
    }
  }
}

const failures = [];
const publicPackageManifests = await readPublicPackageManifests();

assertPublicPackageVersions(publicPackageManifests, failures);

for (const { packageDir, manifest } of publicPackageManifests) {
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
  await assertNoPublicRootDirs(packageDir, distDir, failures);
  await assertPublicApi(packageDir, distDir, failures);
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

console.log('public package API and dist are clean');
