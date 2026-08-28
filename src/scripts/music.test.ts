import { describe, expect, test, vi } from 'vitest';

import {
  initializeMusicControllers,
  initializeSpotifyEmbeds,
  loadSpotifyEmbed,
  readMusicView,
  resolveCoverUrl,
  writeMusicView,
} from './music';

type Listener = () => void;

class FakeIframe {
  attributes = new Map<string, string>();
  listeners = new Map<string, Listener>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, listener);
  }
}

class FakeEmbed {
  dataset: { src?: string; loaded?: string };
  children: Array<{
    setAttribute: (name: string, value: string) => void;
    addEventListener: (name: string, listener: Listener, options?: { once: boolean }) => void;
  }> = [];
  status = { hidden: false };
  fallback = { hidden: true };

  constructor(sourceUrl: string) {
    this.dataset = { src: sourceUrl };
  }

  querySelector(selector: string) {
    if (selector === '[data-spotify-status]') return this.status;
    if (selector === '[data-spotify-fallback]') return this.fallback;
    return null;
  }

  appendChild(child: {
    setAttribute: (name: string, value: string) => void;
    addEventListener: (name: string, listener: Listener, options?: { once: boolean }) => void;
  }) {
    this.children.push(child);
    return child;
  }
}

describe('music view preference', () => {
  test('accepts only grid or list and defaults safely to grid', () => {
    expect(readMusicView({ getItem: () => 'list' })).toBe('list');
    expect(readMusicView({ getItem: () => 'unexpected' })).toBe('grid');
    expect(readMusicView({ getItem: () => { throw new Error('blocked'); } })).toBe('grid');
  });

  test('persists a valid view without surfacing storage failures', () => {
    const setItem = vi.fn();
    expect(writeMusicView('list', { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith('music-view', 'list');
    expect(writeMusicView('grid', { setItem: () => { throw new Error('blocked'); } })).toBe(false);
  });

  test('continues every controller when accessing the storage property throws', () => {
    const initializeView = vi.fn();
    const initializeDetails = vi.fn();
    const initializeSpotify = vi.fn();

    initializeMusicControllers({
      getStorage() {
        throw new DOMException('Access denied', 'SecurityError');
      },
      initializeView,
      initializeDetails,
      initializeSpotify,
    });

    expect(initializeView).toHaveBeenCalledWith('grid', null);
    expect(initializeDetails).toHaveBeenCalledOnce();
    expect(initializeSpotify).toHaveBeenCalledOnce();
  });
});

describe('music cover paths', () => {
  test('resolves repository-relative covers while preserving empty covers', () => {
    expect(resolveCoverUrl('assets/images/pxfuel.jpg')).toBe('/website/assets/images/pxfuel.jpg');
    expect(resolveCoverUrl('')).toBe('');
  });
});

describe('deferred Spotify embeds', () => {
  test('creates one correctly attributed iframe and never creates a duplicate', () => {
    const embed = new FakeEmbed('https://open.spotify.com/embed/playlist/example');
    const iframe = new FakeIframe();
    const scheduleTimeout = vi.fn(() => 7);
    const clearTimeout = vi.fn();

    expect(loadSpotifyEmbed(embed, {
      createIframe: () => iframe,
      scheduleTimeout,
      clearTimeout,
    })).toBe(true);
    expect(loadSpotifyEmbed(embed, {
      createIframe: () => new FakeIframe(),
      scheduleTimeout,
      clearTimeout,
    })).toBe(false);

    expect(embed.children).toEqual([iframe]);
    expect(iframe.attributes.get('src')).toBe(embed.dataset.src);
    expect(iframe.attributes.get('allow')).toBe(
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
    );
    expect(iframe.attributes.get('allowfullscreen')).toBe('');
    expect(iframe.attributes.get('height')).toBe('352');
    expect(scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), 12_000);

    iframe.listeners.get('load')?.();
    expect(clearTimeout).toHaveBeenCalledWith(7);
    expect(embed.status.hidden).toBe(true);
    expect(embed.fallback.hidden).toBe(true);
  });

  test('reveals the direct fallback after the 12-second timeout', () => {
    const embed = new FakeEmbed('https://open.spotify.com/embed/playlist/example');
    let timeoutCallback: Listener | undefined;

    loadSpotifyEmbed(embed, {
      createIframe: () => new FakeIframe(),
      scheduleTimeout(callback) {
        timeoutCallback = callback;
        return 9;
      },
      clearTimeout: vi.fn(),
    });

    expect(embed.fallback.hidden).toBe(true);
    timeoutCallback?.();
    expect(embed.fallback.hidden).toBe(false);
  });

  test('hides a timed-out fallback if the iframe finishes loading later', () => {
    const embed = new FakeEmbed('https://open.spotify.com/embed/playlist/example');
    const iframe = new FakeIframe();
    let timeoutCallback: Listener | undefined;

    loadSpotifyEmbed(embed, {
      createIframe: () => iframe,
      scheduleTimeout(callback) {
        timeoutCallback = callback;
        return 10;
      },
      clearTimeout: vi.fn(),
    });

    timeoutCallback?.();
    expect(embed.fallback.hidden).toBe(false);
    iframe.listeners.get('load')?.();
    expect(embed.fallback.hidden).toBe(true);
    expect(embed.status.hidden).toBe(true);
  });

  test('observes at 300px and loads only intersecting cards', () => {
    const first = new FakeEmbed('https://open.spotify.com/embed/playlist/first');
    const second = new FakeEmbed('https://open.spotify.com/embed/playlist/second');
    let intersectionCallback: ((entries: Array<{ isIntersecting: boolean; target: FakeEmbed }>) => void) | undefined;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const createObserver = vi.fn((callback: typeof intersectionCallback, options: { rootMargin: string }) => {
      intersectionCallback = callback;
      expect(options).toEqual({ rootMargin: '300px' });
      return { observe, unobserve };
    });
    const createIframe = vi.fn(() => new FakeIframe());

    initializeSpotifyEmbeds([first, second], {
      createObserver,
      createIframe,
      scheduleTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });

    expect(observe.mock.calls.map(([target]) => target)).toEqual([first, second]);
    intersectionCallback?.([
      { isIntersecting: false, target: first },
      { isIntersecting: true, target: second },
    ]);
    expect(first.children).toHaveLength(0);
    expect(second.children).toHaveLength(1);
    expect(unobserve).toHaveBeenCalledWith(second);
    expect(createIframe).toHaveBeenCalledOnce();
  });
});
