import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.env.SERVICEFRONT_CANDIDATE_ROOT || process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vite']);
const textExtensions = new Set(['.json', '.md', '.mjs', '.ts', '.yaml', '.yml']);
const forbidden = [
  { label: 'absolute workstation path', pattern: /\/Users\// },
  { label: 'private dependency name', pattern: /higgsfield|quanta/i },
  { label: 'private key', pattern: /BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY/ },
  { label: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { label: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
];

const findings = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name)) && entry.name !== '.gitignore') continue;
    if (relative(root, path) === 'tools/check-candidate.mjs') continue;
    const text = await readFile(path, 'utf8');
    for (const rule of forbidden) {
      if (rule.pattern.test(text)) findings.push(`${relative(root, path)}: ${rule.label}`);
    }
  }
}

await scan(root);
if (findings.length) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('candidate scan passed\n');
}
