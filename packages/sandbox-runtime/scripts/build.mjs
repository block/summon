import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const checkOnly = process.argv.includes('--check');

async function main() {
  const [bootstrapSource, tokensSource] = await Promise.all([
    readFile(join(src, 'bootstrap.js'), 'utf8'),
    readFile(join(src, 'tokens.css'), 'utf8'),
  ]);

  if (checkOnly) {
    if (!bootstrapSource.trim()) throw new Error('bootstrap.js is empty');
    if (!tokensSource.trim()) throw new Error('tokens.css is empty');
    return;
  }

  await mkdir(dist, { recursive: true });
  await Promise.all([
    writeFile(join(dist, 'bootstrap.js'), bootstrapSource),
    writeFile(join(dist, 'tokens.css'), tokensSource),
    writeFile(
      join(dist, 'assets.js'),
      [
        `export const bootstrapSource = ${JSON.stringify(bootstrapSource)};`,
        `export const tokensSource = ${JSON.stringify(tokensSource)};`,
        '//# sourceMappingURL=assets.js.map',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(dist, 'assets.d.ts'),
      [
        'export declare const bootstrapSource: string;',
        'export declare const tokensSource: string;',
        '//# sourceMappingURL=assets.d.ts.map',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(dist, 'assets.js.map'),
      JSON.stringify({
        version: 3,
        file: 'assets.js',
        sources: ['../src/bootstrap.js', '../src/tokens.css'],
        sourcesContent: [bootstrapSource, tokensSource],
        names: [],
        mappings: '',
      }),
    ),
    writeFile(
      join(dist, 'assets.d.ts.map'),
      JSON.stringify({
        version: 3,
        file: 'assets.d.ts',
        sources: ['../src/assets.ts'],
        sourcesContent: [
          "export const bootstrapSource = '';\nexport const tokensSource = '';\n",
        ],
        names: [],
        mappings: '',
      }),
    ),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
