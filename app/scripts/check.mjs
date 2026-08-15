import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'scripts'];

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(path));
    } else if (entry.isFile() && path.endsWith('.js') && !path.endsWith('.test.js')) {
      files.push(path);
    }
  }
  return files;
}

const files = roots
  .flatMap((root) => collectJavaScriptFiles(root))
  .sort((left, right) => left.localeCompare(right));

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`JavaScript syntax OK: ${files.length} files`);
