import { describe, expect, test, vi } from 'vitest';

import {
  authorizeAdmin,
  handleAdminRequest,
  publishPerfume,
  publishMusic,
  validatePerfumeDraft,
  type AdminEnvironment,
  type AccessContextLike,
  type PerfumePost,
} from './index';

const ADMIN_EMAIL = 'allenchenhan99@gmail.com';

const starwalker: PerfumePost = {
  id: 1,
  date: '2026/09/02',
  brand: 'Montblanc',
  name: 'Starwalker',
  title: '安靜得剛剛好。',
  excerpt: '乾淨、舒服，而且不張揚。',
  content: ['第一段個人觀感。', '第二段個人觀感。'],
  scents: ['Woody', 'Bamboo'],
  notes: {
    top: ['Bamboo', 'Bergamot'],
    middle: ['White Musk', 'Sandalwood'],
    base: ['Ginger', 'Amber'],
  },
  ratings: {
    longevity: 3,
    presence: 2.5,
    sweetness: 2,
    warmth: 2.5,
    complexity: 2.5,
    dailyWearability: 4.5,
  },
  cover: 'assets/images/perfume-starwalker.jpg',
  source: 'https://example.com/starwalker',
};

const environment = {
  ADMIN_EMAIL,
  GITHUB_OWNER: 'allenchenhan99',
  GITHUB_REPO: 'website',
  GITHUB_BRANCH: 'main',
  GITHUB_TOKEN: 'test-secret',
  ASSETS: { fetch: vi.fn() },
} as unknown as AdminEnvironment;

const access = (email?: string): AccessContextLike => ({
  aud: 'test-audience',
  getIdentity: vi.fn(async () => email ? { email } : undefined),
});

describe('Cloudflare Access authorization', () => {
  test('accepts only the configured Access identity, case-insensitively', async () => {
    await expect(authorizeAdmin(access('AllenChenHan99@GMAIL.com'), ADMIN_EMAIL))
      .resolves.toMatchObject({ email: 'AllenChenHan99@GMAIL.com' });
    await expect(authorizeAdmin(access('someone@example.com'), ADMIN_EMAIL)).resolves.toBeUndefined();
    await expect(authorizeAdmin(undefined, ADMIN_EMAIL)).resolves.toBeUndefined();
  });

  test('keeps health public but denies UI and API without Access', async () => {
    const health = await handleAdminRequest(
      new Request('https://admin.example/health'),
      environment,
      {},
    );
    const ui = await handleAdminRequest(
      new Request('https://admin.example/'),
      environment,
      {},
    );

    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ ok: true });
    expect(ui.status).toBe(403);
    expect(environment.ASSETS.fetch).not.toHaveBeenCalled();
  });
});

describe('perfume draft validation', () => {
  test('preserves the complete article, note pyramid, and six subjective ratings', () => {
    expect(validatePerfumeDraft(starwalker)).toEqual(starwalker);
  });

  test('rejects incomplete content and ratings outside 0.5 increments', () => {
    expect(() => validatePerfumeDraft({ ...starwalker, content: [] })).toThrow(/content/i);
    expect(() => validatePerfumeDraft({
      ...starwalker,
      ratings: { ...starwalker.ratings, longevity: 3.2 },
    })).toThrow(/0\.5/i);
  });
});

describe('atomic GitHub publication', () => {
  test('publishes the JSON and optional image in one tree commit', async () => {
    const updated = { ...starwalker, title: 'A quieter title' };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const responses: unknown[] = [
      { object: { sha: 'head-sha' } },
      { tree: { sha: 'base-tree-sha' } },
      { content: Buffer.from(JSON.stringify([starwalker]), 'utf8').toString('base64'), encoding: 'base64' },
      { sha: 'json-blob-sha' },
      { sha: 'image-blob-sha' },
      { sha: 'new-tree-sha' },
      { sha: 'new-commit-sha', html_url: 'https://github.com/example/commit/new-commit-sha' },
      { object: { sha: 'new-commit-sha' } },
    ];
    const githubFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return Response.json(responses.shift(), { status: 200 });
    });

    const result = await publishPerfume(
      environment,
      {
        action: 'upsert',
        revision: 'head-sha',
        perfume: updated,
        image: {
          name: 'starwalker.webp',
          type: 'image/webp',
          base64: 'aW1hZ2UtYnl0ZXM=',
        },
      },
      githubFetch,
      () => 1_800_000_000_000,
    );

    expect(result).toMatchObject({
      commitSha: 'new-commit-sha',
      commitUrl: 'https://github.com/example/commit/new-commit-sha',
      post: { title: 'A quieter title' },
    });
    expect(calls.map(({ url }) => url)).toEqual(expect.arrayContaining([
      expect.stringContaining('/git/ref/heads/main'),
      expect.stringContaining('/git/commits/head-sha'),
      expect.stringContaining('/contents/posts/perfume.json?ref=head-sha'),
      expect.stringContaining('/git/blobs'),
      expect.stringContaining('/git/trees'),
      expect.stringContaining('/git/commits'),
      expect.stringContaining('/git/refs/heads/main'),
    ]));

    const treeCall = calls.find(({ url }) => url.endsWith('/git/trees'));
    const treeBody = JSON.parse(String(treeCall?.init?.body));
    expect(treeBody.base_tree).toBe('base-tree-sha');
    expect(treeBody.tree).toEqual([
      expect.objectContaining({ path: 'posts/perfume.json', sha: 'json-blob-sha' }),
      expect.objectContaining({
        path: 'public/assets/images/uploads/perfume-1-starwalker-1800000000000.webp',
        sha: 'image-blob-sha',
      }),
    ]);

    const commitCall = calls.filter(({ url }) => url.endsWith('/git/commits')).at(-1);
    expect(JSON.parse(String(commitCall?.init?.body))).toMatchObject({
      tree: 'new-tree-sha',
      parents: ['head-sha'],
    });
  });

  test('rejects stale edits before creating any blobs', async () => {
    const githubFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ object: { sha: 'new-head' } }))
      .mockResolvedValueOnce(Response.json({ tree: { sha: 'new-tree' } }));

    await expect(publishPerfume(
      environment,
      { action: 'upsert', revision: 'old-head', perfume: starwalker },
      githubFetch,
    )).rejects.toThrow(/changed since/i);
    expect(githubFetch).toHaveBeenCalledTimes(2);
  });
});

describe('music publication', () => {
  test('publishes a validated music post through the shared atomic commit path', async () => {
    const music = {
      id: 1,
      date: '2026/03/15',
      title: 'Nujabes — Metaphorical Music',
      tag: 'Jazz Hip-Hop',
      cover: '',
      excerpt: 'A personal note.',
    };
    const responses: unknown[] = [
      { object: { sha: 'head-sha' } },
      { tree: { sha: 'base-tree-sha' } },
      { content: Buffer.from(JSON.stringify([music]), 'utf8').toString('base64'), encoding: 'base64' },
      { sha: 'json-blob-sha' },
      { sha: 'new-tree-sha' },
      { sha: 'music-commit-sha', html_url: 'https://github.com/example/music-commit-sha' },
      { object: { sha: 'music-commit-sha' } },
    ];
    const githubFetch = vi.fn(async () => Response.json(responses.shift(), { status: 200 }));

    await expect(publishMusic(
      environment,
      { action: 'upsert', revision: 'head-sha', music: { ...music, excerpt: 'Updated note.' } },
      githubFetch,
    )).resolves.toMatchObject({
      commitSha: 'music-commit-sha',
      post: { excerpt: 'Updated note.' },
    });
  });
});
