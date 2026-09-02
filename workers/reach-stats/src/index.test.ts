import { describe, expect, test, vi } from 'vitest';

import {
  VisitorCounter,
  buildReachSnapshot,
  handleReachRequest,
  recordVisit,
  type CounterState,
} from './index';

const NOW = Date.parse('2026-09-03T04:30:00.000Z');

class MemoryStorage {
  values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

class MemoryDurableObjectState {
  constructor(readonly storage = new MemoryStorage()) {}

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}

describe('visitor counter state', () => {
  test('builds an empty cumulative snapshot without period data', () => {
    expect(buildReachSnapshot(undefined, NOW)).toEqual({
      totalReach: 0,
      updatedAt: '2026-09-03T04:30:00.000Z',
    });
  });

  test('records only the aggregate lifetime total', () => {
    const first = recordVisit(undefined, NOW);
    const second = recordVisit(first, NOW + 60_000);

    expect(second).toEqual({
      totalReach: 2,
      updatedAt: '2026-09-03T04:31:00.000Z',
    });
    expect(buildReachSnapshot(second, NOW + 60_000)).toEqual({
      totalReach: 2,
      updatedAt: '2026-09-03T04:31:00.000Z',
    });
  });

  test('drops legacy daily buckets the next time the counter is written', () => {
    const oldState = {
      totalReach: 10,
      daily: {
        '2026-07-01': 8,
        '2026-09-02': 2,
      },
      updatedAt: '2026-09-02T04:30:00.000Z',
    } as CounterState & { daily: Record<string, number> };

    expect(recordVisit(oldState, NOW)).toEqual({
      totalReach: 11,
      updatedAt: '2026-09-03T04:30:00.000Z',
    });
  });
});

describe('SQLite Durable Object visitor counter', () => {
  test('persists sequential increments and returns them from a new instance', async () => {
    const state = new MemoryDurableObjectState();
    const counter = new VisitorCounter(state, { now: () => NOW });

    expect(await (await counter.fetch(new Request('https://counter.internal/'))).json()).toMatchObject({
      totalReach: 0,
    });
    expect(await (await counter.fetch(new Request('https://counter.internal/', { method: 'POST' }))).json()).toMatchObject({
      totalReach: 1,
    });
    expect(await (await counter.fetch(new Request('https://counter.internal/', { method: 'POST' }))).json()).toMatchObject({
      totalReach: 2,
    });

    const restarted = new VisitorCounter(state, { now: () => NOW });
    expect(await (await restarted.fetch(new Request('https://counter.internal/'))).json()).toMatchObject({
      totalReach: 2,
    });
  });
});

describe('public visitor counter endpoint', () => {
  test.each(['GET', 'POST'])('forwards %s to the single global counter with public CORS', async (method) => {
    const fetch = vi.fn(async (_request: Request) => Response.json({ totalReach: method === 'POST' ? 1 : 0 }));
    const idFromName = vi.fn(() => 'global-id');
    const get = vi.fn(() => ({ fetch }));

    const response = await handleReachRequest(
      new Request('https://reach.example/', { method }),
      { VISITOR_COUNTER: { idFromName, get } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(idFromName).toHaveBeenCalledWith('global');
    expect(get).toHaveBeenCalledWith('global-id');
    expect(fetch.mock.calls[0]?.[0]).toMatchObject({ method });
  });

  test('answers preflight and rejects unrelated methods without touching storage', async () => {
    const get = vi.fn();
    const environment = { VISITOR_COUNTER: { idFromName: () => 'global-id', get } };

    const preflight = await handleReachRequest(
      new Request('https://reach.example/', { method: 'OPTIONS' }),
      environment,
    );
    const rejected = await handleReachRequest(
      new Request('https://reach.example/', { method: 'DELETE' }),
      environment,
    );

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(rejected.status).toBe(405);
    expect(get).not.toHaveBeenCalled();
  });
});
