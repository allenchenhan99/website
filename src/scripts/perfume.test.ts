import { describe, expect, test, vi } from 'vitest';

import type { PerfumePost } from '../lib/content';
import {
  createPerfumeDialogController,
  createPerfumeFilterController,
  filterPerfumePosts,
  getPerfumeCoverLoading,
  getPerfumeCoverPresentation,
  getPerfumeFilterOptions,
  type PerfumeFilterState,
} from './perfume';

const posts: PerfumePost[] = [
  {
    id: 1,
    date: '2026/08/01',
    brand: 'Zoologist',
    name: 'Bee',
    title: 'Honey in the quiet.',
    excerpt: 'Warm honey and incense.',
    content: ['Warm honey and incense.'],
    scents: ['Honey', 'Amber'],
    notes: { top: ['Bergamot'], middle: ['Honey'], base: ['Amber'] },
    ratings: {
      longevity: 4,
      presence: 3.5,
      sweetness: 4.5,
      warmth: 4,
      complexity: 3.5,
      dailyWearability: 3,
    },
    cover: 'https://images.example.com/bee.jpg',
    source: 'https://example.com/bee',
  },
  {
    id: 2,
    date: '2026/08/02',
    brand: 'Aesop',
    name: 'Hwyl',
    title: 'A quiet forest.',
    excerpt: 'A quiet forest.',
    content: ['A quiet forest.'],
    scents: ['Woody', 'Incense'],
    notes: { top: ['Cypress'], middle: ['Incense'], base: ['Vetiver'] },
    ratings: {
      longevity: 4,
      presence: 3,
      sweetness: 1,
      warmth: 4,
      complexity: 4,
      dailyWearability: 3.5,
    },
    cover: '',
    source: 'https://example.com/hwyl',
  },
  {
    id: 3,
    date: '2026/08/03',
    brand: 'Zoologist',
    name: 'Squid',
    title: 'Ink below the surface.',
    excerpt: 'Dark marine ink.',
    content: ['Dark marine ink.'],
    scents: ['Amber', 'Marine'],
    notes: { top: ['Pink Pepper'], middle: ['Ink'], base: ['Amber'] },
    ratings: {
      longevity: 4.5,
      presence: 4,
      sweetness: 2,
      warmth: 2.5,
      complexity: 4.5,
      dailyWearability: 2.5,
    },
    cover: 'assets/images/uploads/squid.jpg',
    source: 'https://example.com/squid',
  },
];

describe('perfume filter helpers', () => {
  test('makes only the first compact card cover eager', () => {
    expect(posts.map((_, index) => getPerfumeCoverLoading(index))).toEqual([
      'eager',
      'lazy',
      'lazy',
    ]);
  });

  test('builds sorted unique scent options after All', () => {
    expect(getPerfumeFilterOptions(posts, 'scent')).toEqual([
      'All',
      'Amber',
      'Honey',
      'Incense',
      'Marine',
      'Woody',
    ]);
  });

  test('builds sorted unique brand options after All', () => {
    expect(getPerfumeFilterOptions(posts, 'brand')).toEqual(['All', 'Aesop', 'Zoologist']);
  });

  test('keeps the All sentinel unique even if content repeats that label', () => {
    const repeatedAll = [{ ...posts[0]!, brand: 'All', scents: ['All', 'Amber'] }];
    expect(getPerfumeFilterOptions(repeatedAll, 'scent')).toEqual(['All', 'Amber']);
    expect(getPerfumeFilterOptions(repeatedAll, 'brand')).toEqual(['All']);
  });

  test('All returns every post and a single scent returns matching posts', () => {
    expect(filterPerfumePosts(posts, 'scent', 'All').map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(filterPerfumePosts(posts, 'scent', 'Amber').map(({ id }) => id)).toEqual([1, 3]);
  });

  test('a single brand returns matching posts', () => {
    expect(filterPerfumePosts(posts, 'brand', 'Aesop').map(({ id }) => id)).toEqual([2]);
  });

  test('empty posts produce only All and no matches', () => {
    expect(getPerfumeFilterOptions([], 'scent')).toEqual(['All']);
    expect(getPerfumeFilterOptions([], 'brand')).toEqual(['All']);
    expect(filterPerfumePosts([], 'scent', 'All')).toEqual([]);
  });

  test('missing covers explicitly select the bottle placeholder', () => {
    expect(getPerfumeCoverPresentation(posts[0]!)).toEqual({
      coverUrl: 'https://images.example.com/bee.jpg',
      showPlaceholder: false,
    });
    expect(getPerfumeCoverPresentation(posts[1]!)).toEqual({
      coverUrl: '',
      showPlaceholder: true,
    });
  });
});

describe('perfume filter controller', () => {
  test('updates visible cards, count, featured, more, and empty state', () => {
    const states: PerfumeFilterState[] = [];
    const controller = createPerfumeFilterController(posts, {
      render: (state) => states.push(state),
    });

    expect(states.at(-1)).toMatchObject({
      mode: 'scent',
      activeFilter: 'All',
      visibleIds: [1, 2, 3],
      featuredId: 1,
      gridIds: [2, 3],
      count: 3,
      showMore: true,
      empty: false,
    });

    controller.setFilter('Marine');
    expect(states.at(-1)).toMatchObject({
      activeFilter: 'Marine',
      visibleIds: [3],
      featuredId: 3,
      gridIds: [],
      count: 1,
      showMore: false,
      empty: false,
    });

    controller.setFilter('Citrus');
    expect(states.at(-1)).toMatchObject({
      visibleIds: [],
      featuredId: null,
      gridIds: [],
      count: 0,
      showMore: false,
      empty: true,
    });
  });

  test('changing mode resets the active filter to All and rebuilds tags', () => {
    const render = vi.fn();
    const controller = createPerfumeFilterController(posts, { render });
    controller.setFilter('Amber');
    controller.setMode('brand');

    expect(render.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: 'brand',
      activeFilter: 'All',
      options: ['All', 'Aesop', 'Zoologist'],
      visibleIds: [1, 2, 3],
      count: 3,
    });
  });

  test('initializes safely with zero production-like posts', () => {
    const render = vi.fn();
    expect(() => createPerfumeFilterController([], { render })).not.toThrow();
    expect(render).toHaveBeenCalledWith(expect.objectContaining({
      options: ['All'],
      visibleIds: [],
      featuredId: null,
      count: 0,
      empty: true,
    }));
  });
});

describe('perfume detail dialog controller', () => {
  test('populates and opens one accessible dialog, then closes it', () => {
    const render = vi.fn();
    const showModal = vi.fn();
    const close = vi.fn();
    const controller = createPerfumeDialogController(posts, { render, showModal, close });

    expect(controller.open(2)).toBe(true);
    expect(render).toHaveBeenCalledWith(posts[1]);
    expect(showModal).toHaveBeenCalledOnce();

    controller.close();
    expect(close).toHaveBeenCalledOnce();
  });

  test('ignores unknown posts and remains safe with an empty collection', () => {
    const view = { render: vi.fn(), showModal: vi.fn(), close: vi.fn() };
    const controller = createPerfumeDialogController([], view);

    expect(controller.open(99)).toBe(false);
    expect(view.render).not.toHaveBeenCalled();
    expect(view.showModal).not.toHaveBeenCalled();
  });
});
