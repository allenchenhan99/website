import { describe, expect, test } from 'vitest';

import {
  articlePayload,
  articleTopics,
  filterArticles,
} from '../../public/admin/article-admin.js';

const fields = {
  id: 'article-1',
  type: 'research',
  topic: 'Deep Learning',
  title: ' A useful experiment ',
  slug: 'useful-experiment',
  summary: ' A short summary ',
  date: '2026-09-17',
  status: 'published',
  stage: '已完成',
  featured: true,
  body: '## Results\n\nThe result.',
  link: 'https://github.com/example/project',
  event: '',
  role: '',
};

describe('article admin helpers', () => {
  test('provides topic options for each article type', () => {
    expect(articleTopics('journal')).toEqual(['Competitions', 'Weekly Notes']);
    expect(articleTopics('research')).toEqual(['Agent Systems', 'Deep Learning', 'Quantitative Finance']);
  });

  test('normalizes the form into an article while retaining UUID ids', () => {
    expect(articlePayload(fields)).toEqual({
      id: 'article-1',
      type: 'research',
      topic: 'Deep Learning',
      title: 'A useful experiment',
      slug: 'useful-experiment',
      summary: 'A short summary',
      date: '2026-09-17',
      status: 'published',
      stage: '已完成',
      featured: true,
      body: '## Results\n\nThe result.',
      link: 'https://github.com/example/project',
      event: '',
      role: '',
    });
  });

  test('filters a shared collection to the selected article type', () => {
    const rows = [
      { id: 'j', type: 'journal', title: 'Journal' },
      { id: 'r', type: 'research', title: 'Research' },
    ];
    expect(filterArticles(rows, 'research')).toEqual([rows[1]]);
  });
});
