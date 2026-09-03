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
  title: 'A quiet title.',
  excerpt: 'A perfume post.',
  content: ['First paragraph.', 'Second paragraph.'],
  scents: ['cedar'],
  notes: {
    top: ['Bergamot'],
    middle: ['Cedar'],
    base: ['Amber'],
  },
  ratings: {
    longevity: 3,
    presence: 2.5,
    sweetness: 2,
    warmth: 2.5,
    complexity: 2.5,
    dailyWearability: 4.5,
  },
  source: 'https://example.com/perfume',
  ...overrides,
});

describe('content validation', () => {
  test('parses valid music and perfume post arrays', () => {
    expect(parseMusicPosts([music(1)])).toMatchObject([{ id: 1, cover: '' }]);
    expect(parsePerfumePosts([perfume(2)])).toMatchObject([{
      id: 2,
      title: 'A quiet title.',
      content: ['First paragraph.', 'Second paragraph.'],
      notes: {
        top: ['Bergamot'],
        middle: ['Cedar'],
        base: ['Amber'],
      },
      ratings: {
        longevity: 3,
        presence: 2.5,
        sweetness: 2,
        warmth: 2.5,
        complexity: 2.5,
        dailyWearability: 4.5,
      },
      source: 'https://example.com/perfume',
      cover: '',
    }]);
  });

  test('keeps an HTTPS perfume product image without requiring a local public asset', () => {
    const cover = 'https://images.example.com/starwalker.jpg';
    expect(parsePerfumePosts([perfume(1, { cover })], () => false)[0]?.cover).toBe(cover);
  });

  test('rejects dates outside YYYY/MM/DD format', () => {
    expect(() => parseMusicPosts([music(1, { date: '2026-08-28' })])).toThrow(/date/);
  });

  test.each([
    ['invalid month', '2026/13/01'],
    ['invalid day', '2026/04/31'],
    ['non-leap February 29', '2025/02/29'],
  ])('rejects %s as an impossible calendar date', (_, date) => {
    expect(() => parseMusicPosts([music(1, { date })])).toThrow(/date/i);
    expect(() => parsePerfumePosts([perfume(1, { date })])).toThrow(/date/i);
  });

  test('accepts February 29 in a leap year without changing the date string', () => {
    expect(parseMusicPosts([music(1, { date: '2024/02/29' })])[0]?.date).toBe('2024/02/29');
    expect(parsePerfumePosts([perfume(1, { date: '2024/02/29' })])[0]?.date).toBe('2024/02/29');
  });

  test('rejects duplicate IDs within a collection', () => {
    expect(() => parseMusicPosts([music(1), music(1)])).toThrow(/duplicate id/i);
  });

  test('rejects missing required music and perfume fields', () => {
    expect(() => parseMusicPosts([{ id: 1, date: '2026/08/28' }])).toThrow(/title/);
    expect(() => parsePerfumePosts([perfume(1, { scents: undefined })])).toThrow(/scents/);
    expect(() => parsePerfumePosts([perfume(1, { content: undefined })])).toThrow(/content/);
    expect(() => parsePerfumePosts([perfume(1, { notes: undefined })])).toThrow(/notes/);
    expect(() => parsePerfumePosts([perfume(1, { ratings: undefined })])).toThrow(/ratings/);
  });

  test('rejects incomplete note pyramids and invalid subjective ratings', () => {
    expect(() => parsePerfumePosts([perfume(1, {
      notes: { top: ['Bergamot'], middle: ['Cedar'] },
    })])).toThrow(/notes\.base/);
    expect(() => parsePerfumePosts([perfume(1, {
      ratings: {
        longevity: 3.2,
        presence: 2.5,
        sweetness: 2,
        warmth: 2.5,
        complexity: 2.5,
        dailyWearability: 4.5,
      },
    })])).toThrow(/0\.5/);
    expect(() => parsePerfumePosts([perfume(1, {
      ratings: {
        longevity: 0.5,
        presence: 2.5,
        sweetness: 2,
        warmth: 2.5,
        complexity: 2.5,
        dailyWearability: 4.5,
      },
    })])).toThrow(/between 1 and 5/);
    expect(() => parsePerfumePosts([perfume(1, {
      ratings: {
        longevity: 3,
        sweetness: 2,
        warmth: 2.5,
        complexity: 2.5,
        dailyWearability: 4.5,
      },
    })])).toThrow(/ratings\.presence/);
    expect(() => parsePerfumePosts([perfume(1, {
      ratings: {
        longevity: 3,
        presence: 2.5,
        sweetness: 2,
        warmth: 2.5,
        complexity: 2.5,
        dailyWearability: 4.5,
        freshness: 3,
      },
    })])).toThrow(/unsupported rating/);
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
