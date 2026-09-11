import { describe, expect, it } from 'vitest';
import { isArticle, visibleArticles } from './articles';
import { demoArticles } from './articles.fixtures';

describe('article preview data', () => {
  it('excludes research drafts from public listings and sorts newest first', () => {
    const articles = visibleArticles(demoArticles, 'research');
    expect(articles.map(article => article.id)).toEqual(['agent-handoffs', 'factor-decay']);
    expect(articles.every(article => article.status === 'published')).toBe(true);
  });
  it('rejects corrupted browser storage rather than treating it as article content', () => {
    expect(demoArticles.every(isArticle)).toBe(true);
    expect(isArticle({ ...demoArticles[0], body: null })).toBe(false);
    expect(isArticle({ ...demoArticles[0], status: 'unknown' })).toBe(false);
    expect(isArticle({ ...demoArticles[0], featured: 'false' })).toBe(false);
  });
});
