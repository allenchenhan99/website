import { describe, expect, test } from 'vitest';

import {
  getRecentPosts,
  parseMusicPosts,
  parsePerfumePosts,
} from './content';

const music = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  date: '2026/08/28',
  title: `Music ${id}`,
  tag: 'Jazz',
  excerpt: 'A music post.',
  ...overrides,
});

const perfume = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  date: '2026/08/29',
  brand: 'Maison',
  name: `Perfume ${id}`,
  excerpt: 'A perfume post.',
  scents: ['cedar'],
  ...overrides,
});

describe('content validation', () => {
  test('parses valid music and perfume post arrays', () => {
    expect(parseMusicPosts([music(1)])).toMatchObject([{ id: 1, cover: '' }]);
    expect(parsePerfumePosts([perfume(2)])).toMatchObject([{ id: 2, cover: '' }]);
  });

  test('rejects dates outside YYYY/MM/DD format', () => {
    expect(() => parseMusicPosts([music(1, { date: '2026-08-28' })])).toThrow(/date/);
  });

  test('rejects duplicate IDs within a collection', () => {
    expect(() => parseMusicPosts([music(1), music(1)])).toThrow(/duplicate id/i);
  });

  test('rejects missing required music and perfume fields', () => {
    expect(() => parseMusicPosts([{ id: 1, date: '2026/08/28' }])).toThrow(/title/);
    expect(() => parsePerfumePosts([perfume(1, { scents: undefined })])).toThrow(/scents/);
  });

  test('normalizes missing and unavailable covers to empty strings', () => {
    expect(parseMusicPosts([music(1)])[0]?.cover).toBe('');
    expect(parseMusicPosts([music(1, { cover: 'missing.jpg' })], () => false)[0]?.cover).toBe('');
  });

  test('merges posts in descending date order with prefixed IDs', () => {
    const recent = getRecentPosts(
      parseMusicPosts([music(1)]),
      parsePerfumePosts([perfume(2)]),
    );

    expect(recent[0]?.id).toBe('p2');
    expect(recent[1]?.id).toBe('m1');
  });

  test('limits recent posts to three by default', () => {
    const recent = getRecentPosts(
      parseMusicPosts([music(1), music(2), music(3), music(4)]),
      [],
    );

    expect(recent).toHaveLength(3);
  });
});
