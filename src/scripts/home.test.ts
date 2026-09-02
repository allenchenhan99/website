import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import * as home from './home';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const ascii = readFileSync(`${rootPath}asciiArt.txt`, 'utf8');
const chipi = readFileSync(`${rootPath}chipi.txt`, 'utf8');

type TimeoutCallback = () => void;
type FrameCallback = (timestamp: number) => void;

describe('home animation helpers', () => {
  test('uses one six-row ASCII line that spells ALLEN LIN', () => {
    const lines = ascii.trimEnd().split('\n');

    expect(lines).toHaveLength(6);
    expect(lines).toEqual([
      ' █████╗ ██╗     ██╗     ███████╗███╗   ██╗    ██╗     ██╗ ███╗   ██╗',
      '██╔══██╗██║     ██║     ██╔════╝████╗  ██║    ██║     ██║ ████╗  ██║',
      '███████║██║     ██║     █████╗  ██╔██╗ ██║    ██║     ██║ ██╔██╗ ██║',
      '██╔══██║██║     ██║     ██╔══╝  ██║╚██╗██║    ██║     ██║ ██║╚██╗██║',
      '██║  ██║███████╗███████╗███████╗██║ ╚████║    ███████╗██║ ██║ ╚████║',
      '╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝    ╚══════╝╚═╝ ╚═╝  ╚═══╝',
    ]);
  });

  test('builds the first ASCII block from the first eight columns', () => {
    const expectedFirstBlock = ascii
      .split('\n')
      .slice(0, 6)
      .map((line) => line.slice(0, 8))
      .join('\n');

    expect(home.buildAsciiFrame(ascii, 0)).toContain(expectedFirstBlock);
  });

  test('composes the complete ASCII artwork after exactly nine blocks', () => {
    expect(home.buildAsciiFrame(ascii, 8).trimEnd()).toBe(ascii.trimEnd());
  });

  test('splits the Chipi source into 23 complete 42-line frames', () => {
    const lines = chipi.trimEnd().split('\n');
    const frames = home.splitChipiFrames(lines, 42);

    expect(frames).toHaveLength(23);
    expect(frames[0]?.split('\n')).toHaveLength(42);
    expect(frames.at(-1)?.split('\n')).toHaveLength(42);
  });
});

describe('ASCII animation controller', () => {
  test('renders the complete artwork immediately for reduced motion', () => {
    const render = vi.fn();
    const scheduleTimeout = vi.fn();
    home.startAsciiAnimation({ source: ascii, reducedMotion: true, render, scheduleTimeout });

    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(ascii.trimEnd());
    expect(scheduleTimeout).not.toHaveBeenCalled();
  });

  test('renders all nine blocks on a 100ms cadence', () => {
    const pending: TimeoutCallback[] = [];
    const delays: number[] = [];
    const render = vi.fn();
    home.startAsciiAnimation({
      source: ascii,
      reducedMotion: false,
      render,
      scheduleTimeout(callback, delay) {
        pending.push(callback);
        delays.push(delay);
      },
    });

    while (pending.length > 0) pending.shift()?.();

    expect(render).toHaveBeenCalledTimes(9);
    expect(render.mock.calls[0]?.[0]).toBe(home.buildAsciiFrame(ascii, 0));
    expect(render.mock.calls.at(-1)?.[0]).toBe(ascii.trimEnd());
    expect(delays).toEqual(Array.from({ length: 8 }, () => 100));
  });
});

describe('Chipi animation controller', () => {
  test('cycles frames near 20ms without advancing while hidden', () => {
    let frameCallback: FrameCallback | undefined;
    let hidden = false;
    const render = vi.fn();
    home.startChipiFrameAnimation({
      frames: ['frame 0', 'frame 1', 'frame 2'],
      render,
      requestFrame(callback) {
        frameCallback = callback;
      },
      isHidden: () => hidden,
    });

    expect(frameCallback).toBeTypeOf('function');
    frameCallback?.(19);
    expect(render).not.toHaveBeenCalled();
    frameCallback?.(20);
    expect(render).toHaveBeenLastCalledWith('frame 1');

    hidden = true;
    frameCallback?.(40);
    expect(render).toHaveBeenCalledTimes(1);

    hidden = false;
    frameCallback?.(59);
    expect(render).toHaveBeenCalledTimes(1);
    frameCallback?.(60);
    frameCallback?.(80);
    expect(render.mock.calls.map(([frame]) => frame)).toEqual(['frame 1', 'frame 2', 'frame 0']);
  });

  test('uses requestIdleCallback with a timeout when available', () => {
    const load = vi.fn();
    const scheduleTimeout = vi.fn();
    let idleCallback: TimeoutCallback | undefined;
    const requestIdleCallback = vi.fn((callback: TimeoutCallback) => {
      idleCallback = callback;
    });

    home.scheduleIdleLoad(load, { requestIdleCallback, scheduleTimeout });

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1_500 });
    expect(scheduleTimeout).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    idleCallback?.();
    expect(load).toHaveBeenCalledOnce();
  });

  test('falls back to a delayed timeout when idle callbacks are unavailable', () => {
    const load = vi.fn();
    let timeoutCallback: TimeoutCallback | undefined;
    const scheduleTimeout = vi.fn((callback: TimeoutCallback) => {
      timeoutCallback = callback;
    });

    home.scheduleIdleLoad(load, { scheduleTimeout });

    expect(scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), 1_500);
    expect(load).not.toHaveBeenCalled();
    timeoutCallback?.();
    expect(load).toHaveBeenCalledOnce();
  });

  test('retains the static frame when the Chipi fetch fails', async () => {
    let visibleFrame = 'static frame';
    const requestFrame = vi.fn();
    const reportError = vi.fn();
    const result = await home.loadChipiAnimation({
      sourceUrl: '/website/_astro/chipi.txt',
      fetchText: vi.fn().mockRejectedValue(new Error('offline')),
      render(frame) {
        visibleFrame = frame;
      },
      requestFrame,
      isHidden: () => false,
      reportError,
    });

    expect(result).toBe(false);
    expect(visibleFrame).toBe('static frame');
    expect(requestFrame).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledOnce();
  });
});

describe('Home reach signal', () => {
  const liveSnapshot = {
    periodDays: 30,
    totalReach: 2468,
    pageViews: 7135,
    periodChange: -6.4,
    dailyReach: Array.from({ length: 30 }, (_, index) => index + 1),
    updatedAt: '2026-09-02T04:30:00.000Z',
  };

  test('accepts a complete live reach snapshot from the public stats endpoint', () => {
    expect(home.parseReachSignalSnapshot(liveSnapshot)).toEqual(liveSnapshot);
  });

  test.each([
    { ...liveSnapshot, periodDays: 7 },
    { ...liveSnapshot, totalReach: -1 },
    { ...liveSnapshot, pageViews: Number.NaN },
    { ...liveSnapshot, dailyReach: [1, 2, 3] },
    { ...liveSnapshot, updatedAt: 'not-a-date' },
  ])('rejects malformed live reach data', (snapshot) => {
    expect(home.parseReachSignalSnapshot(snapshot)).toBeNull();
  });

  test('loads and validates live reach data without exposing endpoint details to the UI', async () => {
    const reportError = vi.fn();
    const result = await home.loadReachSignalSnapshot({
      statsUrl: 'https://reach.example.workers.dev',
      fetchJson: vi.fn().mockResolvedValue(liveSnapshot),
      reportError,
    });

    expect(result).toEqual(liveSnapshot);
    expect(reportError).not.toHaveBeenCalled();
  });

  test('keeps sample data when the live endpoint returns an invalid payload', async () => {
    const reportError = vi.fn();
    const result = await home.loadReachSignalSnapshot({
      statsUrl: 'https://reach.example.workers.dev',
      fetchJson: vi.fn().mockResolvedValue({ pageViews: 99 }),
      reportError,
    });

    expect(result).toBeNull();
    expect(reportError).toHaveBeenCalledOnce();
  });

  test('builds the approved A plus C flow as a fixed-width text field', () => {
    const frame = home.buildReachFlowFrame({
      data: home.REACH_SIGNAL_DATA,
      columns: 120,
      phase: 0,
    });
    const lines = frame.split('\n');

    expect(lines).toHaveLength(21);
    expect(lines.every((line) => line.length === 120)).toBe(true);
    expect(frame).toContain('ALLEN.LIN // PUBLIC REACH SIGNAL');
    expect(frame).toContain('30D H 97 / L 18 // DENSITY = DAILY REACH');
  });

  test('formats the quiet market line from the shared reach data', () => {
    expect(home.buildReachTickerText(home.REACH_SIGNAL_DATA)).toBe(
      'RCH 1,284  ▲18.0%   │   PVW 3,912   │   30D H 97 / L 18',
    );
  });

  test('uses a downward market marker when reach declines', () => {
    expect(home.buildReachTickerText({
      ...home.REACH_SIGNAL_DATA,
      periodChange: -6.4,
    })).toContain('▼6.4%');
  });

  test('renders a valid flow when the site has not collected its first visit yet', () => {
    const frame = home.buildReachFlowFrame({
      data: {
        totalReach: 0,
        pageViews: 0,
        periodChange: 0,
        dailyReach: Array.from({ length: 30 }, () => 0),
      },
      columns: 80,
      phase: 0,
    });

    expect(frame).not.toContain('undefined');
    expect(frame.split('\n')).toHaveLength(18);
  });

  test('renders one static reach frame when reduced motion is requested', () => {
    const render = vi.fn();
    const requestFrame = vi.fn();

    home.startReachFlowAnimation({
      reducedMotion: true,
      render,
      requestFrame,
      isHidden: () => false,
    });

    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(0);
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
