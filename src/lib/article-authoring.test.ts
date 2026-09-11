import { describe, expect, it } from 'vitest';
import { validateArticles } from './articles';
import { demoArticles } from './articles.fixtures';
import { articleHtml } from './article-markdown';
describe('article authoring', () => {
  it('validates identities, dates, topics and links before saving', () => {
    expect(() => validateArticles(demoArticles)).not.toThrow();
    for (const patch of [{slug:'../escape'}, {date:'2026-02-30'}, {topic:'unknown'}, {link:'javascript:alert(1)'}, {body:''}]) {
      expect(() => validateArticles([{...demoArticles[0],...patch}])).toThrow();
    }
    expect(() => validateArticles([demoArticles[0],demoArticles[0]])).toThrow();
  });
  it('renders useful Markdown without executing HTML or unsafe URLs', () => {
    const html=articleHtml('## Heading\n\n**bold** [reference](https://example.com)\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))');
    expect(html).toContain('<h2>Heading</h2>'); expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"'); expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });
});
