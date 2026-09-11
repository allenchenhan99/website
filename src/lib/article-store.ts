import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateArticles, type Article } from './articles';
export const articleFile = pathToFileURL(resolve('src/data/articles.json'));
export async function loadArticleStore() {
  const raw = await readFile(articleFile, 'utf8');
  const rows: unknown = JSON.parse(raw); validateArticles(rows);
  return { rows, revision: createHash('sha256').update(raw).digest('hex') };
}
let queue = Promise.resolve();
export function writeArticleStore(rows: Article[], revision: string) {
  const result = queue.then(async () => {
    validateArticles(rows);
    const current = await loadArticleStore();
    if (current.revision !== revision) throw new Error('CONFLICT');
    const raw = JSON.stringify(rows, null, 2) + '\n';
    const temporary = new URL('./articles.json.tmp', articleFile);
    await writeFile(temporary, raw, 'utf8'); await rename(temporary, articleFile);
    return { rows, revision: createHash('sha256').update(raw).digest('hex') };
  });
  queue = result.then(() => {}, () => {}); return result;
}
