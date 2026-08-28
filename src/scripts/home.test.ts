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
  test('builds the first ASCII block from the first ten columns', () => {
    const expectedFirstBlock = ascii
      .split('\n')
      .slice(0, 6)
      .map((line) => line.slice(0, 10))
      .join('\n');

    expect(home.buildAsciiFrame(ascii, 0)).toContain(expectedFirstBlock);
  });

  test('composes the complete ASCII artwork after exactly 26 blocks', () => {
    expect(home.buildAsciiFrame(ascii, 25).trimEnd()).toBe(ascii.trimEnd());
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

  test('renders all 26 blocks on a 100ms cadence', () => {
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

    expect(render).toHaveBeenCalledTimes(26);
    expect(render.mock.calls[0]?.[0]).toBe(home.buildAsciiFrame(ascii, 0));
    expect(render.mock.calls.at(-1)?.[0]).toBe(ascii.trimEnd());
    expect(delays).toEqual(Array.from({ length: 25 }, () => 100));
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
