const TOKEN_KEY = 'allenlin_admin_token';
const GITHUB_API = 'https://api.github.com';

export function readAdminToken(sessionStore, localStore) {
  return sessionStore.getItem(TOKEN_KEY) || localStore.getItem(TOKEN_KEY) || '';
}

export function saveAdminToken(token, remember, sessionStore, localStore) {
  clearAdminToken(sessionStore, localStore);
  (remember ? localStore : sessionStore).setItem(TOKEN_KEY, token);
}

export function clearAdminToken(sessionStore, localStore) {
  sessionStore.removeItem(TOKEN_KEY);
  localStore.removeItem(TOKEN_KEY);
}

function decodeBase64Utf8(value) {
  const bytes = Uint8Array.from(atob(value.replace(/\s/g, '')), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'entry';
}

function imageExtension(type) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensions[type];
  if (!extension) throw new Error('Image must be JPEG, PNG, or WebP.');
  return extension;
}

export class GitHubAdminClient {
  constructor({ token, owner, repo, branch = 'main', fetcher }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.fetcher = fetcher ?? ((...args) => globalThis.fetch(...args));
    this.repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }

  async request(path, init = {}) {
    const fetcher = this.fetcher;
    const response = await fetcher(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 401
        ? 'GitHub rejected this token.'
        : response.status === 403
          ? 'This token cannot write to the website repository.'
          : response.status === 409 || response.status === 422
            ? 'The repository changed while publishing. Reload and try again.'
            : payload.message || `GitHub request failed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  }

  async verify() {
    const identity = await this.request('/user');
    if (String(identity.login).toLowerCase() !== this.owner.toLowerCase()) {
      throw new Error(`Sign in with the ${this.owner} GitHub account.`);
    }
    const repository = await this.request(this.repositoryPath);
    if (repository.permissions?.push !== true) {
      throw new Error('This token needs Contents: Read and write for the website repository.');
    }
    return { login: identity.login };
  }

  async readJsonFile(path, revision) {
    const file = await this.request(
      `${this.repositoryPath}/contents/${path}?ref=${encodeURIComponent(revision)}`,
    );
    if (file.encoding !== 'base64') throw new Error(`GitHub returned an unsupported encoding for ${path}.`);
    try {
      return JSON.parse(decodeBase64Utf8(file.content));
    } catch {
      throw new Error(`${path} is not valid JSON.`);
    }
  }

  async headRevision() {
    const reference = await this.request(
      `${this.repositoryPath}/git/ref/heads/${encodeURIComponent(this.branch)}`,
    );
    return reference.object.sha;
  }

  async loadContent() {
    const revision = await this.headRevision();
    const [perfume, music] = await Promise.all([
      this.readJsonFile('posts/perfume.json', revision),
      this.readJsonFile('posts/music.json', revision),
    ]);
    return { perfume, music, revision };
  }

  async createBlob(content, encoding) {
    const blob = await this.request(`${this.repositoryPath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content, encoding }),
    });
    return blob.sha;
  }

  async publish(type, request, now = Date.now) {
    const config = {
      perfume: {
        path: 'posts/perfume.json',
        label: (item) => `${item.brand} — ${item.name}`,
        slug: (item) => item.name,
      },
      music: {
        path: 'posts/music.json',
        label: (item) => item.title,
        slug: (item) => item.title,
      },
    }[type];
    if (!config) throw new Error('Unsupported content type.');
    if (!['upsert', 'delete'].includes(request.action)) throw new Error('Unsupported publish action.');

    const headSha = await this.headRevision();
    if (!request.revision || request.revision !== headSha) {
      throw new Error('Content changed since this editor was loaded. Reload before publishing.');
    }
    const commitState = await this.request(`${this.repositoryPath}/git/commits/${headSha}`);
    const collection = await this.readJsonFile(config.path, headSha);
    if (!Array.isArray(collection)) throw new Error(`${config.path} is not an array.`);

    let post;
    let message;
    if (request.action === 'delete') {
      const index = collection.findIndex((item) => item.id === request.id);
      if (index < 0) throw new Error('The selected entry no longer exists.');
      const [removed] = collection.splice(index, 1);
      message = `Delete ${type} entry: ${config.label(removed)}`;
    } else {
      if (!request.item || typeof request.item !== 'object') throw new Error('The entry is incomplete.');
      const requestedId = Number.isSafeInteger(request.item.id) ? request.item.id : undefined;
      const index = requestedId === undefined
        ? -1
        : collection.findIndex((item) => item.id === requestedId);
      const id = index >= 0
        ? collection[index].id
        : Math.max(0, ...collection.map((item) => Number(item.id) || 0)) + 1;
      post = { ...request.item, id };
      if (request.image) {
        post.cover = `assets/images/uploads/${type}-${id}-${slugify(config.slug(post))}-${now()}.${imageExtension(request.image.type)}`;
      }
      if (index >= 0) collection[index] = post;
      else collection.unshift(post);
      message = `${index >= 0 ? 'Update' : 'Add'} ${type} entry: ${config.label(post)}`;
    }

    const changes = [{
      path: config.path,
      content: `${JSON.stringify(collection, null, 2)}\n`,
      encoding: 'utf-8',
    }];
    if (request.image && post) {
      changes.push({
        path: `public/${post.cover}`,
        content: request.image.base64,
        encoding: 'base64',
      });
    }

    const treeEntries = [];
    for (const change of changes) {
      const sha = await this.createBlob(change.content, change.encoding);
      treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha });
    }
    const tree = await this.request(`${this.repositoryPath}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: commitState.tree.sha, tree: treeEntries }),
    });
    const commit = await this.request(`${this.repositoryPath}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
    });
    await this.request(`${this.repositoryPath}/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return {
      post,
      commitSha: commit.sha,
      commitUrl: commit.html_url || `https://github.com/${this.owner}/${this.repo}/commit/${commit.sha}`,
    };
  }
}
