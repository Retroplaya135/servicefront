import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] ?? '');
const document = JSON.parse(await readFile(path, 'utf8'));

const result = {
  business: document.identity?.displayName,
  recipe: document.theme?.recipeKey,
  services: document.services?.length,
  pages: document.pages?.length,
  evidence: document.provenance?.evidence?.length,
};

if (!result.business || !result.recipe || !Number.isInteger(result.services) || !Number.isInteger(result.pages)) {
  throw new Error('example does not contain the expected site-specification fields');
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
