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

class FakeFrameSlot {
  hidden = false;
  children: FakeIframe[] = [];

  appendChild(child: FakeIframe) {
    this.children.push(child);
    return child;
  }
}

class FakeEmbed {
  dataset: { src?: string; loaded?: string };
  children: Array<{
    setAttribute: (name: string, value: string) => void;
    addEventListener: (name: string, listener: Listener, options?: { once: boolean }) => void;
  }> = [];
  status = { hidden: false };
  fallback = { hidden: false };
  frameSlot = new FakeFrameSlot();

  constructor(sourceUrl: string) {
    this.dataset = { src: sourceUrl };
  }

  querySelector(selector: string) {
    if (selector === '[data-spotify-frame]') return this.frameSlot;
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
  test('creates one correctly attributed iframe without timeout-based fallback behavior', () => {
    const embed = new FakeEmbed('https://open.spotify.com/embed/playlist/example');
    const iframe = new FakeIframe();

    expect(loadSpotifyEmbed(embed, { createIframe: () => iframe })).toBe(true);
    expect(loadSpotifyEmbed(embed, {
      createIframe: () => new FakeIframe(),
    })).toBe(false);

    expect(embed.frameSlot.children).toEqual([iframe]);
    expect(embed.children).toEqual([]);
    expect(iframe.attributes.get('src')).toBe(embed.dataset.src);
    expect(iframe.attributes.get('allow')).toBe(
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
    );
    expect(iframe.attributes.get('allowfullscreen')).toBe('');
    expect(iframe.attributes.get('height')).toBe('352');

    iframe.listeners.get('load')?.();
    expect(embed.status.hidden).toBe(true);
    expect(embed.fallback.hidden).toBe(false);
  });

  test('keeps the direct link available when iframe load cannot prove HTTP success', () => {
    const embed = new FakeEmbed('https://open.spotify.com/embed/playlist/example');
    const iframe = new FakeIframe();

    loadSpotifyEmbed(embed, {
      createIframe: () => iframe,
    });

    expect(embed.fallback.hidden).toBe(false);
    iframe.listeners.get('load')?.();
    expect(embed.fallback.hidden).toBe(false);
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
    });

    expect(observe.mock.calls.map(([target]) => target)).toEqual([first, second]);
    intersectionCallback?.([
      { isIntersecting: false, target: first },
      { isIntersecting: true, target: second },
    ]);
    expect(first.frameSlot.children).toHaveLength(0);
    expect(second.frameSlot.children).toHaveLength(1);
    expect(first.children).toHaveLength(0);
    expect(second.children).toHaveLength(0);
    expect(unobserve).toHaveBeenCalledWith(second);
    expect(createIframe).toHaveBeenCalledOnce();
  });
});
