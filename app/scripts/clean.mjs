import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectories = ['dist', 'test-results', 'playwright-report', 'blob-report'];

for (const directory of generatedDirectories) {
  await rm(path.join(appRoot, directory), { recursive: true, force: true });
}

console.log(`Removed ${generatedDirectories.length} disposable app output directories.`);
