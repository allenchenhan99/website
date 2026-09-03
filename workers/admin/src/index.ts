import adminCss from '../public/admin.css?raw';
import adminHtml from '../public/index.html?raw';
import adminJavaScript from '../public/admin.js?raw';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const PERFUME_PATH = 'posts/perfume.json';
const MUSIC_PATH = 'posts/music.json';
const MAX_REQUEST_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const perfumeRatingKeys = [
  'longevity',
  'presence',
  'sweetness',
  'warmth',
  'complexity',
  'dailyWearability',
] as const;

type PerfumeRatingKey = typeof perfumeRatingKeys[number];
type JsonRecord = Record<string, unknown>;
type GitHubFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type AccessIdentityLike = { email?: string };

export type AccessContextLike = {
  readonly aud: string;
  getIdentity(): Promise<AccessIdentityLike | undefined>;
};

export type AdminContextLike = {
  access?: AccessContextLike;
};

export type AdminEnvironment = Env & {
  GITHUB_TOKEN: string;
};

export type PerfumePost = {
  id: number;
  date: string;
  brand: string;
  name: string;
  title: string;
  excerpt: string;
  content: string[];
  scents: string[];
  notes: { top: string[]; middle: string[]; base: string[] };
  ratings: Record<PerfumeRatingKey, number>;
  cover: string;
  source: string;
};

export type MusicPost = {
  id: number;
  date: string;
  title: string;
  tag: string;
  excerpt: string;
  cover: string;
};

export type ImageUpload = {
  name: string;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
};

export type PerfumePublishRequest = {
  action: 'upsert' | 'delete';
  revision: string;
  perfume?: unknown;
  id?: number;
  image?: ImageUpload;
};

export type MusicPublishRequest = {
  action: 'upsert' | 'delete';
  revision: string;
  music?: unknown;
  id?: number;
  image?: ImageUpload;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const asRecord = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(`${label} must be an object.`, 400);
  }
  return value as JsonRecord;
};

const requireString = (
  record: JsonRecord,
  field: string,
  label: string,
  allowEmpty = false,
): string => {
  const value = record[field];
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new HttpError(`${label} ${field} must be a non-empty string.`, 400);
  }
  return value.trim();
};

const requireId = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(`${label} id must be a positive integer.`, 400);
  }
  return value;
};

const requireDate = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    throw new HttpError(`${label} date must use YYYY/MM/DD.`, 400);
  }
  const [year, month, day] = value.split('/').map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() + 1 !== month
    || candidate.getUTCDate() !== day
  ) {
    throw new HttpError(`${label} date is not a valid calendar date.`, 400);
  }
  return value;
};

const requireStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(`${label} must be a non-empty list.`, 400);
  }
  const strings = value.map((item) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new HttpError(`${label} must contain only non-empty strings.`, 400);
    }
    return item.trim();
  });
  return strings;
};

const requireCover = (record: JsonRecord, label: string): string => {
  const cover = requireString(record, 'cover', label, true);
  if (
    cover !== ''
    && !/^https:\/\//.test(cover)
    && (!cover.startsWith('assets/images/') || cover.includes('..'))
  ) {
    throw new HttpError(`${label} cover must be an HTTPS URL or a public image path.`, 400);
  }
  return cover;
};

const requireRatings = (value: unknown, label: string): PerfumePost['ratings'] => {
  const record = asRecord(value, label);
  const unsupported = Object.keys(record).filter(
    (key) => !perfumeRatingKeys.includes(key as PerfumeRatingKey),
  );
  if (unsupported.length > 0) {
    throw new HttpError(`${label} has unsupported fields: ${unsupported.join(', ')}.`, 400);
  }
  return Object.fromEntries(perfumeRatingKeys.map((key) => {
    const rating = record[key];
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      throw new HttpError(`${label}.${key} must be between 1 and 5.`, 400);
    }
    if (!Number.isInteger(rating * 2)) {
      throw new HttpError(`${label}.${key} must use increments of 0.5.`, 400);
    }
    return [key, rating];
  })) as PerfumePost['ratings'];
};

export function validatePerfumeDraft(value: unknown, assignedId?: number): PerfumePost {
  const record = asRecord(value, 'Perfume');
  const notes = asRecord(record.notes, 'Perfume notes');
  return {
    id: assignedId ?? requireId(record.id, 'Perfume'),
    date: requireDate(record.date, 'Perfume'),
    brand: requireString(record, 'brand', 'Perfume'),
    name: requireString(record, 'name', 'Perfume'),
    title: requireString(record, 'title', 'Perfume'),
    excerpt: requireString(record, 'excerpt', 'Perfume'),
    content: requireStringArray(record.content, 'Perfume content'),
    scents: requireStringArray(record.scents, 'Perfume scents'),
    notes: {
      top: requireStringArray(notes.top, 'Perfume notes.top'),
      middle: requireStringArray(notes.middle, 'Perfume notes.middle'),
      base: requireStringArray(notes.base, 'Perfume notes.base'),
    },
    ratings: requireRatings(record.ratings, 'Perfume ratings'),
    cover: requireCover(record, 'Perfume'),
    source: requireString(record, 'source', 'Perfume', true),
  };
}

export function validateMusicDraft(value: unknown, assignedId?: number): MusicPost {
  const record = asRecord(value, 'Music post');
  return {
    id: assignedId ?? requireId(record.id, 'Music post'),
    date: requireDate(record.date, 'Music post'),
    title: requireString(record, 'title', 'Music post'),
    tag: requireString(record, 'tag', 'Music post'),
    excerpt: requireString(record, 'excerpt', 'Music post'),
    cover: requireCover(record, 'Music post'),
  };
}

export async function authorizeAdmin(
  accessContext: AccessContextLike | undefined,
  adminEmail: string,
): Promise<AccessIdentityLike | undefined> {
  if (!accessContext || !adminEmail) return undefined;
  const identity = await accessContext.getIdentity();
  if (!identity?.email) return undefined;
  return identity.email.toLocaleLowerCase() === adminEmail.toLocaleLowerCase()
    ? identity
    : undefined;
}

function responseHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return headers;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: responseHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

function githubHeaders(environment: AdminEnvironment): Headers {
  return new Headers({
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${environment.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'allenlin-content-admin',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  });
}

async function githubJson<T>(
  environment: AdminEnvironment,
  path: string,
  fetcher: GitHubFetch,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetcher(`${GITHUB_API}${path}`, {
    ...init,
    headers: githubHeaders(environment),
  });
  if (!response.ok) {
    const isConflict = response.status === 409 || response.status === 422;
    throw new HttpError(
      isConflict
        ? 'The repository changed while publishing. Reload the editor and try again.'
        : `GitHub rejected the publish request (${response.status}).`,
      isConflict ? 409 : 502,
    );
  }
  return response.json<T>();
}

const repositoryPath = (environment: AdminEnvironment): string =>
  `/repos/${encodeURIComponent(environment.GITHUB_OWNER)}/${encodeURIComponent(environment.GITHUB_REPO)}`;

async function getBranchState(environment: AdminEnvironment, fetcher: GitHubFetch) {
  const repo = repositoryPath(environment);
  const branch = encodeURIComponent(environment.GITHUB_BRANCH);
  const reference = await githubJson<{ object: { sha: string } }>(
    environment,
    `${repo}/git/ref/heads/${branch}`,
    fetcher,
  );
  const commit = await githubJson<{ tree: { sha: string } }>(
    environment,
    `${repo}/git/commits/${reference.object.sha}`,
    fetcher,
  );
  return { headSha: reference.object.sha, treeSha: commit.tree.sha };
}

function decodeBase64Utf8(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function readJsonFileAtRef<T>(
  environment: AdminEnvironment,
  path: string,
  ref: string,
  fetcher: GitHubFetch,
): Promise<T> {
  const repo = repositoryPath(environment);
  const file = await githubJson<{ content: string; encoding: string }>(
    environment,
    `${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    fetcher,
  );
  if (file.encoding !== 'base64') throw new HttpError('GitHub returned an unsupported file encoding.', 502);
  try {
    return JSON.parse(decodeBase64Utf8(file.content)) as T;
  } catch {
    throw new HttpError(`${path} is not valid JSON.`, 502);
  }
}

function validateImage(value: unknown): ImageUpload | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, 'Image');
  const name = requireString(record, 'name', 'Image');
  const type = requireString(record, 'type', 'Image') as ImageUpload['type'];
  const base64 = requireString(record, 'base64', 'Image');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    throw new HttpError('Image must be JPEG, PNG, or WebP.', 400);
  }
  let byteLength: number;
  try {
    byteLength = atob(base64).length;
  } catch {
    throw new HttpError('Image data is not valid base64.', 400);
  }
  if (byteLength === 0 || byteLength > MAX_IMAGE_BYTES) {
    throw new HttpError('Image must be between 1 byte and 5 MB.', 400);
  }
  return { name, type, base64 };
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'entry';
}

function imageExtension(type: ImageUpload['type']): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
}

async function createBlob(
  environment: AdminEnvironment,
  content: string,
  encoding: 'utf-8' | 'base64',
  fetcher: GitHubFetch,
): Promise<string> {
  const result = await githubJson<{ sha: string }>(
    environment,
    `${repositoryPath(environment)}/git/blobs`,
    fetcher,
    { method: 'POST', body: JSON.stringify({ content, encoding }) },
  );
  return result.sha;
}

type FileChange = { path: string; content: string; encoding: 'utf-8' | 'base64' };

async function commitFiles(
  environment: AdminEnvironment,
  branchState: { headSha: string; treeSha: string },
  changes: FileChange[],
  message: string,
  fetcher: GitHubFetch,
) {
  const tree = [];
  for (const change of changes) {
    const sha = await createBlob(environment, change.content, change.encoding, fetcher);
    tree.push({ path: change.path, mode: '100644', type: 'blob', sha });
  }
  const repo = repositoryPath(environment);
  const nextTree = await githubJson<{ sha: string }>(
    environment,
    `${repo}/git/trees`,
    fetcher,
    { method: 'POST', body: JSON.stringify({ base_tree: branchState.treeSha, tree }) },
  );
  const commit = await githubJson<{ sha: string; html_url: string }>(
    environment,
    `${repo}/git/commits`,
    fetcher,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: nextTree.sha,
        parents: [branchState.headSha],
      }),
    },
  );
  await githubJson(
    environment,
    `${repo}/git/refs/heads/${encodeURIComponent(environment.GITHUB_BRANCH)}`,
    fetcher,
    { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) },
  );
  return commit;
}

function parsePostList<T>(value: unknown, validator: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new HttpError(`${label} is not an array.`, 502);
  const posts = value.map(validator);
  const ids = posts.map((post) => (post as { id: number }).id);
  if (new Set(ids).size !== ids.length) throw new HttpError(`${label} contains duplicate ids.`, 502);
  return posts;
}

function requireCurrentRevision(revision: unknown, headSha: string): void {
  if (typeof revision !== 'string' || revision.length === 0 || revision !== headSha) {
    throw new HttpError(
      'Content changed since this editor was loaded. Reload the page before publishing.',
      409,
    );
  }
}

export async function publishPerfume(
  environment: AdminEnvironment,
  request: PerfumePublishRequest,
  fetcher: GitHubFetch = fetch,
  now: () => number = Date.now,
) {
  const input = asRecord(request, 'Publish request') as PerfumePublishRequest;
  if (input.action !== 'upsert' && input.action !== 'delete') {
    throw new HttpError('Unsupported perfume action.', 400);
  }
  const image = validateImage(input.image);
  const branchState = await getBranchState(environment, fetcher);
  requireCurrentRevision(input.revision, branchState.headSha);
  const current = parsePostList(
    await readJsonFileAtRef<unknown>(environment, PERFUME_PATH, branchState.headSha, fetcher),
    (item) => validatePerfumeDraft(item),
    'Perfume content',
  );

  let post: PerfumePost | undefined;
  let message: string;
  if (input.action === 'delete') {
    const id = requireId(input.id, 'Perfume');
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) throw new HttpError('Perfume entry was not found.', 404);
    const [removed] = current.splice(index, 1);
    message = `Delete perfume entry: ${removed!.brand} — ${removed!.name}`;
  } else {
    const draftRecord = asRecord(input.perfume, 'Perfume');
    const requestedId = draftRecord.id;
    const existingIndex = typeof requestedId === 'number'
      ? current.findIndex((item) => item.id === requestedId)
      : -1;
    const id = existingIndex >= 0
      ? current[existingIndex]!.id
      : Math.max(0, ...current.map((item) => item.id)) + 1;
    post = validatePerfumeDraft(input.perfume, id);
    if (image) {
      post.cover = `assets/images/uploads/perfume-${id}-${slugify(post.name)}-${now()}.${imageExtension(image.type)}`;
    }
    if (existingIndex >= 0) current[existingIndex] = post;
    else current.unshift(post);
    message = `${existingIndex >= 0 ? 'Update' : 'Add'} perfume entry: ${post.brand} — ${post.name}`;
  }

  const changes: FileChange[] = [{
    path: PERFUME_PATH,
    content: `${JSON.stringify(current, null, 2)}\n`,
    encoding: 'utf-8',
  }];
  if (image && post) {
    changes.push({ path: `public/${post.cover}`, content: image.base64, encoding: 'base64' });
  }
  const commit = await commitFiles(environment, branchState, changes, message, fetcher);
  return { post, commitSha: commit.sha, commitUrl: commit.html_url };
}

export async function publishMusic(
  environment: AdminEnvironment,
  request: MusicPublishRequest,
  fetcher: GitHubFetch = fetch,
  now: () => number = Date.now,
) {
  const input = asRecord(request, 'Publish request') as MusicPublishRequest;
  if (input.action !== 'upsert' && input.action !== 'delete') {
    throw new HttpError('Unsupported music action.', 400);
  }
  const image = validateImage(input.image);
  const branchState = await getBranchState(environment, fetcher);
  requireCurrentRevision(input.revision, branchState.headSha);
  const current = parsePostList(
    await readJsonFileAtRef<unknown>(environment, MUSIC_PATH, branchState.headSha, fetcher),
    (item) => validateMusicDraft(item),
    'Music content',
  );

  let post: MusicPost | undefined;
  let message: string;
  if (input.action === 'delete') {
    const id = requireId(input.id, 'Music post');
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) throw new HttpError('Music post was not found.', 404);
    const [removed] = current.splice(index, 1);
    message = `Delete music post: ${removed!.title}`;
  } else {
    const draftRecord = asRecord(input.music, 'Music post');
    const requestedId = draftRecord.id;
    const existingIndex = typeof requestedId === 'number'
      ? current.findIndex((item) => item.id === requestedId)
      : -1;
    const id = existingIndex >= 0
      ? current[existingIndex]!.id
      : Math.max(0, ...current.map((item) => item.id)) + 1;
    post = validateMusicDraft(input.music, id);
    if (image) {
      post.cover = `assets/images/uploads/music-${id}-${slugify(post.title)}-${now()}.${imageExtension(image.type)}`;
    }
    if (existingIndex >= 0) current[existingIndex] = post;
    else current.unshift(post);
    message = `${existingIndex >= 0 ? 'Update' : 'Add'} music post: ${post.title}`;
  }
  const changes: FileChange[] = [{
    path: MUSIC_PATH,
    content: `${JSON.stringify(current, null, 2)}\n`,
    encoding: 'utf-8',
  }];
  if (image && post) {
    changes.push({ path: `public/${post.cover}`, content: image.base64, encoding: 'base64' });
  }
  const commit = await commitFiles(environment, branchState, changes, message, fetcher);
  return { post, commitSha: commit.sha, commitUrl: commit.html_url };
}

async function loadContent(environment: AdminEnvironment, fetcher: GitHubFetch) {
  const { headSha } = await getBranchState(environment, fetcher);
  const [perfumeValue, musicValue] = await Promise.all([
    readJsonFileAtRef<unknown>(environment, PERFUME_PATH, headSha, fetcher),
    readJsonFileAtRef<unknown>(environment, MUSIC_PATH, headSha, fetcher),
  ]);
  return {
    perfume: parsePostList(perfumeValue, (item) => validatePerfumeDraft(item), 'Perfume content'),
    music: parsePostList(musicValue, (item) => validateMusicDraft(item), 'Music content'),
    revision: headSha,
  };
}

async function readRequestJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError('Content-Type must be application/json.', 415);
  }
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) throw new HttpError('Request is too large.', 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new HttpError('Request is too large.', 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError('Request body must be valid JSON.', 400);
  }
}

function verifySameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError('Cross-origin publish requests are not allowed.', 403);
  }
  if (request.headers.get('X-Admin-Action') !== 'publish') {
    throw new HttpError('Missing publish confirmation header.', 403);
  }
}

function uiResponse(content: string, contentType: string, headOnly = false): Response {
  const headers = responseHeaders({ 'Content-Type': contentType });
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; "
      + "script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; "
      + "form-action 'self'; frame-ancestors 'none'",
  );
  return new Response(headOnly ? null : content, { status: 200, headers });
}

export async function handleAdminRequest(
  request: Request,
  environment: AdminEnvironment,
  context: AdminContextLike,
  fetcher: GitHubFetch = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health') return jsonResponse({ ok: true, service: 'allenlin-content-admin' });

  let identity: AccessIdentityLike | undefined;
  try {
    identity = await authorizeAdmin(context.access, environment.ADMIN_EMAIL);
  } catch (error) {
    console.error('Access identity lookup failed.', { error: error instanceof Error ? error.message : 'unknown' });
  }
  if (!identity) return jsonResponse({ error: 'Cloudflare Access authorization required.' }, 403);

  try {
    if (url.pathname === '/api/content' && request.method === 'GET') {
      return jsonResponse({ ...(await loadContent(environment, fetcher)), identity: { email: identity.email } });
    }
    if (url.pathname === '/api/publish/perfume' && request.method === 'POST') {
      verifySameOrigin(request);
      return jsonResponse(await publishPerfume(
        environment,
        asRecord(await readRequestJson(request), 'Publish request') as PerfumePublishRequest,
        fetcher,
      ));
    }
    if (url.pathname === '/api/publish/music' && request.method === 'POST') {
      verifySameOrigin(request);
      return jsonResponse(await publishMusic(
        environment,
        asRecord(await readRequestJson(request), 'Publish request') as MusicPublishRequest,
        fetcher,
      ));
    }
    if (url.pathname.startsWith('/api/')) return jsonResponse({ error: 'Not found.' }, 404);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }
    const headOnly = request.method === 'HEAD';
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return uiResponse(adminHtml, 'text/html; charset=utf-8', headOnly);
    }
    if (url.pathname === '/admin.css') {
      return uiResponse(adminCss, 'text/css; charset=utf-8', headOnly);
    }
    if (url.pathname === '/admin.js') {
      return uiResponse(adminJavaScript, 'text/javascript; charset=utf-8', headOnly);
    }
    return jsonResponse({ error: 'Not found.' }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'Unexpected admin service error.';
    console.error('Admin request failed.', {
      route: url.pathname,
      method: request.method,
      status,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse({ error: message }, status);
  }
}

export default {
  fetch(request: Request, environment: AdminEnvironment, context: ExecutionContext): Promise<Response> {
    return handleAdminRequest(request, environment, context);
  },
} satisfies ExportedHandler<AdminEnvironment>;
