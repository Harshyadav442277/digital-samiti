import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../../outputs/express-vercel/', import.meta.url);
await mkdir(new URL('src/', output), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('../src/vercel.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('src/index.js', output)),
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
});
const source = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await writeFile(new URL('package.json', output), JSON.stringify({
  name: source.name, version: source.version, private: true, type: 'module',
  engines: { node: '24.x' }, dependencies: source.dependencies,
}, null, 2) + '\n');
await writeFile(new URL('package-lock.json', output), await readFile(new URL('../package-lock.json', import.meta.url)));
await writeFile(new URL('vercel.json', output), JSON.stringify({
  version: 2,
  regions: ['iad1'],
  builds: [{ src: 'src/index.js', use: '@vercel/node' }],
  routes: [{ src: '/(.*)', dest: '/src/index.js' }],
}, null, 2) + '\n');
await writeFile(new URL('.vercelignore', output), '.env*\nnode_modules\n.git\n');
console.log('Prepared deployable Express service under outputs/express-vercel. Environment values are configured separately.');
