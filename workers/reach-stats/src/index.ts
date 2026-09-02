const PERIOD_DAYS = 30;

type UmamiStats = {
  visitors: number;
  pageviews: number;
};

type UmamiSeries = {
  sessions: Array<{ x: string; y: number }>;
};

export type ReachPayload = {
  periodDays: 30;
  totalReach: number;
  pageViews: number;
  periodChange: number;
  dailyReach: number[];
  updatedAt: string;
};

type WorkerEnvironment = {
  UMAMI_API_URL?: string;
  UMAMI_API_KEY?: string;
  UMAMI_WEBSITE_ID?: string;
  UMAMI_TIMEZONE?: string;
};

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerDependencies = {
  fetch: typeof fetch;
  now: () => number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

function parseStats(value: unknown): UmamiStats | null {
  if (!isRecord(value) || !isCount(value.visitors) || !isCount(value.pageviews)) return null;
  return { visitors: value.visitors, pageviews: value.pageviews };
}

function parseSeries(value: unknown): UmamiSeries | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) return null;

  const sessions: UmamiSeries['sessions'] = [];
  for (const point of value.sessions) {
    if (
      !isRecord(point)
      || typeof point.x !== 'string'
      || !Number.isFinite(Date.parse(point.x))
      || !isCount(point.y)
    ) return null;
    sessions.push({ x: point.x, y: point.y });
  }
  return { sessions };
}

function normalizeDailyReach(sessions: UmamiSeries['sessions']): number[] {
  const latest = [...sessions]
    .sort((left, right) => Date.parse(left.x) - Date.parse(right.x))
    .slice(-PERIOD_DAYS)
    .map(({ y }) => y);
  return [
    ...Array.from({ length: PERIOD_DAYS - latest.length }, () => 0),
    ...latest,
  ];
}

function calculatePeriodChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1_000) / 10;
}

export function buildReachPayload(options: {
  current: unknown;
  previous: unknown;
  series: unknown;
  updatedAt: string;
}): ReachPayload {
  const current = parseStats(options.current);
  const previous = parseStats(options.previous);
  const series = parseSeries(options.series);
  if (!current || !previous || !series) {
    throw new Error('Invalid Umami statistics response');
  }

  return {
    periodDays: PERIOD_DAYS,
    totalReach: current.visitors,
    pageViews: current.pageviews,
    periodChange: calculatePeriodChange(current.visitors, previous.visitors),
    dailyReach: normalizeDailyReach(series.sessions),
    updatedAt: options.updatedAt,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}

function createUmamiUrl(options: {
  apiUrl: string;
  websiteId: string;
  resource: 'stats' | 'pageviews';
  startAt: number;
  endAt: number;
  timezone: string;
}): URL {
  const base = options.apiUrl.replace(/\/$/, '');
  const url = new URL(`${base}/websites/${encodeURIComponent(options.websiteId)}/${options.resource}`);
  url.searchParams.set('startAt', String(options.startAt));
  url.searchParams.set('endAt', String(options.endAt));
  if (options.resource === 'pageviews') {
    url.searchParams.set('unit', 'day');
    url.searchParams.set('timezone', options.timezone);
  }
  return url;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Umami request returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function handleReachRequest(
  request: Request,
  environment: WorkerEnvironment,
  dependencies: WorkerDependencies = { fetch, now: Date.now },
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept',
      },
    });
  }
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiUrl = environment.UMAMI_API_URL?.trim();
  const apiKey = environment.UMAMI_API_KEY?.trim();
  const websiteId = environment.UMAMI_WEBSITE_ID?.trim();
  if (!apiUrl || !apiKey || !websiteId) {
    return jsonResponse({ error: 'Analytics service is not configured' }, 503);
  }

  const endAt = dependencies.now();
  const periodMilliseconds = PERIOD_DAYS * 24 * 60 * 60 * 1_000;
  const currentStartAt = endAt - periodMilliseconds;
  const previousStartAt = currentStartAt - periodMilliseconds;
  const timezone = environment.UMAMI_TIMEZONE?.trim() || 'Asia/Taipei';
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  try {
    const [currentResponse, previousResponse, seriesResponse] = await Promise.all([
      dependencies.fetch(createUmamiUrl({
        apiUrl,
        websiteId,
        resource: 'stats',
        startAt: currentStartAt,
        endAt,
        timezone,
      }), { headers }),
      dependencies.fetch(createUmamiUrl({
        apiUrl,
        websiteId,
        resource: 'stats',
        startAt: previousStartAt,
        endAt: currentStartAt,
        timezone,
      }), { headers }),
      dependencies.fetch(createUmamiUrl({
        apiUrl,
        websiteId,
        resource: 'pageviews',
        startAt: currentStartAt,
        endAt,
        timezone,
      }), { headers }),
    ]);
    const payload = buildReachPayload({
      current: await readJson(currentResponse),
      previous: await readJson(previousResponse),
      series: await readJson(seriesResponse),
      updatedAt: new Date(endAt).toISOString(),
    });
    return jsonResponse(payload);
  } catch (error) {
    console.error('Unable to read Umami reach statistics:', error);
    return jsonResponse({ error: 'Analytics service is unavailable' }, 502);
  }
}

function defaultCache(): Cache | undefined {
  const cacheStorage = globalThis.caches as CacheStorage & { default?: Cache };
  return cacheStorage?.default;
}

export default {
  async fetch(request: Request, environment: WorkerEnvironment, context: WorkerContext): Promise<Response> {
    const cache = request.method === 'GET' ? defaultCache() : undefined;
    const cached = await cache?.match(request);
    if (cached) return cached;

    const response = await handleReachRequest(request, environment);
    if (cache && response.ok) context.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
