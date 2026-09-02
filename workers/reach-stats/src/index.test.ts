import { describe, expect, test } from 'vitest';

import { buildReachPayload } from './index';

describe('reach stats worker payload', () => {
  test('maps Umami totals and the latest 30 daily sessions to the public contract', () => {
    const sessions = Array.from({ length: 32 }, (_, index) => ({
      x: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
      y: index + 1,
    }));

    const payload = buildReachPayload({
      current: { visitors: 1284, pageviews: 3912 },
      previous: { visitors: 1088, pageviews: 3400 },
      series: { sessions, pageviews: [] },
      updatedAt: '2026-09-02T04:30:00.000Z',
    });

    expect(payload).toEqual({
      periodDays: 30,
      totalReach: 1284,
      pageViews: 3912,
      periodChange: 18,
      dailyReach: Array.from({ length: 30 }, (_, index) => index + 3),
      updatedAt: '2026-09-02T04:30:00.000Z',
    });
  });

  test('left-pads a new site with zero days and handles an empty comparison period', () => {
    const payload = buildReachPayload({
      current: { visitors: 2, pageviews: 4 },
      previous: { visitors: 0, pageviews: 0 },
      series: {
        sessions: [
          { x: '2026-09-01T16:00:00.000Z', y: 1 },
          { x: '2026-09-02T16:00:00.000Z', y: 2 },
        ],
      },
      updatedAt: '2026-09-02T04:30:00.000Z',
    });

    expect(payload.periodChange).toBe(100);
    expect(payload.dailyReach).toHaveLength(30);
    expect(payload.dailyReach.slice(0, 28)).toEqual(Array.from({ length: 28 }, () => 0));
    expect(payload.dailyReach.slice(-2)).toEqual([1, 2]);
  });

  test('rejects malformed upstream analytics instead of publishing false data', () => {
    expect(() => buildReachPayload({
      current: { visitors: 'many', pageviews: 10 },
      previous: { visitors: 1, pageviews: 5 },
      series: { sessions: [] },
      updatedAt: '2026-09-02T04:30:00.000Z',
    })).toThrow('Invalid Umami statistics response');
  });
});
