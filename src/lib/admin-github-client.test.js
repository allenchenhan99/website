import { describe, expect, test } from 'vitest';

import * as githubClient from '../../public/admin/github-client.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

describe('admin token storage', () => {
  test('uses the current tab by default and remembers only when requested', () => {
    expect(typeof githubClient.saveAdminToken).toBe('function');
    const session = new MemoryStorage();
    const local = new MemoryStorage();

    githubClient.saveAdminToken('github_pat_session', false, session, local);
    expect(session.getItem('allenlin_admin_token')).toBe('github_pat_session');
    expect(local.getItem('allenlin_admin_token')).toBeNull();

    githubClient.saveAdminToken('github_pat_remembered', true, session, local);
    expect(session.getItem('allenlin_admin_token')).toBeNull();
    expect(local.getItem('allenlin_admin_token')).toBe('github_pat_remembered');
  });

  test('prefers the current-tab token and clears both stores on logout', () => {
    expect(typeof githubClient.readAdminToken).toBe('function');
    expect(typeof githubClient.clearAdminToken).toBe('function');
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    session.setItem('allenlin_admin_token', 'session-token');
    local.setItem('allenlin_admin_token', 'remembered-token');

    expect(githubClient.readAdminToken(session, local)).toBe('session-token');
    githubClient.clearAdminToken(session, local);
    expect(githubClient.readAdminToken(session, local)).toBe('');
  });
});

describe('GitHub admin identity and content loading', () => {
  test('invokes the browser fetch function without binding it to the client', async () => {
    const fetcher = function (url) {
      expect(this).toBeUndefined();
      return Response.json(String(url).endsWith('/user')
        ? { login: 'allenchenhan99' }
        : { permissions: { push: true } });
    };
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_test',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    await expect(client.verify()).resolves.toEqual({ login: 'allenchenhan99' });
  });

  test('accepts only the owner account with write access to the website repository', async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/user')) {
        return Response.json({ login: 'allenchenhan99' });
      }
      return Response.json({ permissions: { push: true } });
    };
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_test',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    await expect(client.verify()).resolves.toEqual({ login: 'allenchenhan99' });
    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.github.com/user',
      'https://api.github.com/repos/allenchenhan99/website',
    ]);
    for (const { init } of calls) {
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer github_pat_test');
    }
  });

  test('rejects a valid token for a different GitHub account', async () => {
    const fetcher = async () => Response.json({ login: 'someone-else' });
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_other',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    await expect(client.verify()).rejects.toThrow(/allenchenhan99/i);
  });

  test('loads all editable collections at one repository revision', async () => {
    const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
    const fetcher = async (url) => {
      const path = String(url);
      if (path.includes('/git/ref/heads/main')) {
        return Response.json({ object: { sha: 'head-sha' } });
      }
      if (path.includes('posts/perfume.json')) {
        return Response.json({ encoding: 'base64', content: encode([{ id: 1, name: 'Starwalker' }]) });
      }
      if (path.includes('posts/music.json')) {
        return Response.json({ encoding: 'base64', content: encode([{ id: 2, title: 'Nujabes' }]) });
      }
      if (path.includes('src/data/articles.json')) {
        return Response.json({ encoding: 'base64', content: encode([{ id: 'article-1', type: 'journal', title: 'Note' }]) });
      }
      return Response.json({ message: 'Not found' }, { status: 404 });
    };
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_test',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    await expect(client.loadContent()).resolves.toEqual({
      perfume: [{ id: 1, name: 'Starwalker' }],
      music: [{ id: 2, title: 'Nujabes' }],
      articles: [{ id: 'article-1', type: 'journal', title: 'Note' }],
      revision: 'head-sha',
    });
  });
});

describe('direct GitHub publication', () => {
  test('publishes an updated collection and image in one atomic commit', async () => {
    const current = [{ id: 1, name: 'Starwalker', cover: 'assets/images/old.webp' }];
    const updated = { ...current[0], name: 'Starwalker Night' };
    const calls = [];
    const responses = [
      { object: { sha: 'head-sha' } },
      { tree: { sha: 'base-tree-sha' } },
      { encoding: 'base64', content: Buffer.from(JSON.stringify(current), 'utf8').toString('base64') },
      { sha: 'json-blob-sha' },
      { sha: 'image-blob-sha' },
      { sha: 'next-tree-sha' },
      { sha: 'next-commit-sha', html_url: 'https://github.com/allenchenhan99/website/commit/next-commit-sha' },
      { object: { sha: 'next-commit-sha' } },
    ];
    const fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json(responses.shift());
    };
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_test',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    const result = await client.publish('perfume', {
      action: 'upsert',
      revision: 'head-sha',
      item: updated,
      image: { type: 'image/webp', base64: 'aW1hZ2U=' },
    }, () => 1_800_000_000_000);

    expect(result).toMatchObject({ post: { id: 1, name: 'Starwalker Night' }, commitSha: 'next-commit-sha' });
    const treeCall = calls.find(({ url }) => url.endsWith('/git/trees'));
    expect(JSON.parse(treeCall.init.body)).toMatchObject({
      base_tree: 'base-tree-sha',
      tree: [
        { path: 'posts/perfume.json', mode: '100644', type: 'blob', sha: 'json-blob-sha' },
        {
          path: 'public/assets/images/uploads/perfume-1-starwalker-night-1800000000000.webp',
          mode: '100644',
          type: 'blob',
          sha: 'image-blob-sha',
        },
      ],
    });
    const refCall = calls.at(-1);
    expect(refCall.url).toContain('/git/refs/heads/main');
    expect(refCall.init.method).toBe('PATCH');
    expect(JSON.parse(refCall.init.body)).toEqual({ sha: 'next-commit-sha', force: false });
  });

  test('publishes an article collection while preserving its string id', async () => {
    const current = [{ id: 'article-1', type: 'journal', title: 'Original', slug: 'original' }];
    const updated = { ...current[0], title: 'Edited', slug: 'edited' };
    const calls = [];
    const responses = [
      { object: { sha: 'head-sha' } },
      { tree: { sha: 'base-tree-sha' } },
      { encoding: 'base64', content: Buffer.from(JSON.stringify(current), 'utf8').toString('base64') },
      { sha: 'json-blob-sha' },
      { sha: 'next-tree-sha' },
      { sha: 'next-commit-sha', html_url: 'https://github.com/allenchenhan99/website/commit/next-commit-sha' },
      { object: { sha: 'next-commit-sha' } },
    ];
    const fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json(responses.shift());
    };
    const client = new githubClient.GitHubAdminClient({
      token: 'github_pat_test',
      owner: 'allenchenhan99',
      repo: 'website',
      branch: 'main',
      fetcher,
    });

    const result = await client.publish('articles', {
      action: 'upsert',
      revision: 'head-sha',
      item: updated,
    });

    expect(result.post).toEqual(updated);
    const treeCall = calls.find(({ url }) => url.endsWith('/git/trees'));
    expect(JSON.parse(treeCall.init.body).tree).toEqual([
      { path: 'src/data/articles.json', mode: '100644', type: 'blob', sha: 'json-blob-sha' },
    ]);
  });

  function publicationClient(before, current) {
    const writes = [];
    const client = new githubClient.GitHubAdminClient({
      token: 'test', owner: 'owner', repo: 'repo',
      fetcher: async (url, init) => {
        const path = String(url);
        if (init.method) {
          writes.push({ path, body: JSON.parse(init.body) });
          return Response.json({sha:'published-sha'});
        }
        if (path.includes('/git/ref/')) return Response.json({object:{sha:'new-head'}});
        if (path.includes('/git/commits/')) return Response.json({tree:{sha:'new-tree'}});
        if (path.includes('/contents/')) return Response.json({encoding:'base64',content:Buffer.from(JSON.stringify(path.endsWith('old-head') ? before : current)).toString('base64')});
        throw new Error('Unexpected request');
      },
    });
    return {client, writes};
  }

  test('publishes across unrelated commits while preserving other entries', async () => {
    const original = {id:1,title:'Original'};
    const {client,writes} = publicationClient([original], [original,{id:2,title:'Another author'}]);
    await client.publish('music',{action:'upsert',revision:'old-head',item:{...original,title:'Edited'}});
    const content = writes.find(call=>call.path.endsWith('/git/blobs')).body.content;
    expect(JSON.parse(content)).toEqual([{id:1,title:'Edited'},{id:2,title:'Another author'}]);
    expect(writes.find(call=>call.path.endsWith('/git/commits')).body.parents).toEqual(['new-head']);
    expect(writes.at(-1).body.force).toBe(false);
  });

  test('recognizes a save that already succeeded without writing again', async () => {
    const edited={id:1,title:'Edited'};
    const {client,writes}=publicationClient([{id:1,title:'Original'}],[edited]);
    await expect(client.publish('music',{action:'upsert',revision:'old-head',item:edited})).resolves.toMatchObject({post:edited,commitSha:'new-head'});
    expect(writes).toEqual([]);
  });

  test('rejects conflicting updates and deletes without writing', async () => {
    for (const action of ['upsert','delete']) {
      const {client,writes}=publicationClient([{id:1,title:'Original'}],[{id:1,title:'Changed elsewhere'}]);
      await expect(client.publish('music',{action,revision:'old-head',id:1,item:{id:1,title:'My edit'}})).rejects.toThrow(/entry changed/i);
      expect(writes).toEqual([]);
    }
  });

  test('does not recreate an entry deleted in another session', async () => {
    const {client,writes}=publicationClient([{id:1,title:'Original'}],[]);
    await expect(client.publish('music',{action:'upsert',revision:'old-head',item:{id:1,title:'My edit'}})).rejects.toThrow(/entry changed/i);
    expect(writes).toEqual([]);
  });

  test('rejects conflicting article updates without writing', async () => {
    const {client,writes} = publicationClient(
      [{id:'article-1',title:'Original'}],
      [{id:'article-1',title:'Changed elsewhere'}],
    );
    await expect(client.publish('articles', {
      action: 'upsert',
      revision: 'old-head',
      item: {id:'article-1',title:'My edit'},
    })).rejects.toThrow(/entry changed/i);
    expect(writes).toEqual([]);
  });
});

describe('post-publication refresh', () => {
  test('reads the returned commit directly and bypasses browser cache', async () => {
    const urls=[];
    const client=new githubClient.GitHubAdminClient({token:'test',owner:'owner',repo:'repo',fetcher:async (url,init)=>{
      urls.push(String(url)); expect(init.cache).toBe('no-store');
      return Response.json({encoding:'base64',content:Buffer.from('[]').toString('base64')});
    }});
    await expect(client.loadContent('saved-sha')).resolves.toEqual({perfume:[],music:[],articles:[],revision:'saved-sha'});
    expect(urls).toHaveLength(3);
    expect(urls.every(url=>url.endsWith('?ref=saved-sha'))).toBe(true);
  });
});
