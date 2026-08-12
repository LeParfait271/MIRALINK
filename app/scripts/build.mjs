import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(appRoot, '..');
const dist = path.join(appRoot, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const name of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icon.svg']) {
  await cp(path.join(appRoot, name), path.join(dist, name));
}
await cp(path.join(appRoot, 'src'), path.join(dist, 'src'), { recursive: true });

const version = JSON.parse(await readFile(path.join(projectRoot, 'VERSION.json'), 'utf8'));
await writeFile(path.join(dist, 'build-info.json'), `${JSON.stringify(version, null, 2)}\n`);

console.log(`MiraLink ${version.version} built in ${dist}`);
