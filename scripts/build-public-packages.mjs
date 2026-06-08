import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const packageAliases = {
  summon: 'summon',
  '@anarchitecture/summon': 'summon',
  'summon-server': 'summon-server',
  '@anarchitecture/summon-server': 'summon-server',
  'summon-react': 'summon-react',
  '@anarchitecture/summon-react': 'summon-react',
};

const requested = process.argv.slice(2).map((name) => packageAliases[name] ?? name);
const targets = requested.length > 0 ? requested : ['summon', 'summon-server', 'summon-react'];

const textExtensions = new Set(['.js', '.d.ts']);
const copiedExtensions = new Set(['.js', '.d.ts', '.css']);

function resolveRoot(...parts) {
  return join(rootDir, ...parts);
}

async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

function rewriteSpecifiers(text, replacements) {
  let next = text;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function stripSourceMapReference(text) {
  return text.replace(/^\/\/# sourceMappingURL=.*(?:\r?\n)?/gm, '');
}

async function copyDistTree(sourceDir, destinationDir, replacements = []) {
  await mkdir(destinationDir, { recursive: true });
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const destination = join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      await copyDistTree(source, destination, replacements);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = entry.name.endsWith('.d.ts') ? '.d.ts' : extname(entry.name);
    if (!copiedExtensions.has(extension)) continue;
    const content = await readFile(source, textExtensions.has(extension) ? 'utf8' : undefined);
    if (textExtensions.has(extension)) {
      await writeText(destination, stripSourceMapReference(rewriteSpecifiers(content, replacements)));
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }
  }
}

async function assertBuilt(packageDir) {
  const distDir = resolveRoot(packageDir, 'dist');
  try {
    const info = await stat(distDir);
    if (info.isDirectory()) return;
  } catch {
    // handled below
  }
  throw new Error(`${packageDir} must be built before public packages are assembled`);
}

async function buildCore() {
  await Promise.all([
    assertBuilt('packages/devtools'),
    assertBuilt('packages/engine'),
    assertBuilt('packages/host'),
    assertBuilt('packages/sandbox-runtime'),
  ]);

  const distDir = resolveRoot('packages/summon/dist');
  await rm(distDir, { recursive: true, force: true });

  await copyDistTree(resolveRoot('packages/engine/dist'), join(distDir, 'engine'));
  await copyDistTree(resolveRoot('packages/devtools/dist'), join(distDir, 'devtools'));
  await copyDistTree(resolveRoot('packages/sandbox-runtime/dist'), join(distDir, 'sandbox-runtime'));
  await copyDistTree(resolveRoot('packages/host/dist'), join(distDir, 'host'), [
    ['@summon-internal/sandbox-runtime/assets', '../sandbox-runtime/assets.js'],
    ['@summon-internal/devtools', '../devtools/index.js'],
    ['@summon-internal/engine', '../engine/index.js'],
  ]);

  const wrappers = {
    'index.js': [
      "export * from './engine/index.js';",
      "export * from './host/index.js';",
      "export * from './devtools/index.js';",
      "export { bootstrapSource, tokensSource } from './sandbox-runtime/assets.js';",
      '',
    ].join('\n'),
    'index.d.ts': [
      "export * from './engine/index.js';",
      "export * from './host/index.js';",
      "export * from './devtools/index.js';",
      "export { bootstrapSource, tokensSource } from './sandbox-runtime/assets.js';",
      '',
    ].join('\n'),
    'browser.js': "export * from './host/browser.js';\n",
    'browser.d.ts': "export * from './host/browser.js';\n",
    'policy.js': "export * from './host/policy.js';\n",
    'policy.d.ts': "export * from './host/policy.js';\n",
    'envelope.js': "export * from './host/envelope.js';\n",
    'envelope.d.ts': "export * from './host/envelope.js';\n",
    'assets.js': "export * from './sandbox-runtime/assets.js';\n",
    'assets.d.ts': "export * from './sandbox-runtime/assets.js';\n",
    'devtools.js': "export * from './devtools/index.js';\n",
    'devtools.d.ts': "export * from './devtools/index.js';\n",
  };

  for (const [file, content] of Object.entries(wrappers)) {
    await writeText(join(distDir, file), content);
  }
}

async function buildServer() {
  await assertBuilt('packages/server');
  const distDir = resolveRoot('packages/summon-server/dist');
  await rm(distDir, { recursive: true, force: true });
  await copyDistTree(resolveRoot('packages/server/dist'), distDir, [
    ['@summon-internal/engine', '@anarchitecture/summon'],
  ]);
}

async function buildReact() {
  await assertBuilt('packages/react');
  const distDir = resolveRoot('packages/summon-react/dist');
  await rm(distDir, { recursive: true, force: true });
  await copyDistTree(resolveRoot('packages/react/dist'), distDir, [
    ['@summon-internal/sandbox-runtime/assets', '@anarchitecture/summon/assets'],
    ['@summon-internal/host/envelope', '@anarchitecture/summon/envelope'],
    ['@summon-internal/devtools', '@anarchitecture/summon/devtools'],
    ['@summon-internal/engine', '@anarchitecture/summon'],
    ['@summon-internal/host', '@anarchitecture/summon'],
  ]);
}

const builders = {
  summon: buildCore,
  'summon-server': buildServer,
  'summon-react': buildReact,
};

for (const target of targets) {
  const build = builders[target];
  if (!build) {
    throw new Error(`Unknown public package target: ${target}`);
  }
  await build();
  console.log(`built ${target}`);
}
