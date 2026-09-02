import { describe, expect, test, vi } from 'vitest';

import {
  initializeMusicControllers,
  readMusicView,
  resolveCoverUrl,
  writeMusicView,
} from './music';

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

  test('continues the view and detail controllers when accessing storage throws', () => {
    const initializeView = vi.fn();
    const initializeDetails = vi.fn();

    initializeMusicControllers({
      getStorage() {
        throw new DOMException('Access denied', 'SecurityError');
      },
      initializeView,
      initializeDetails,
    });

    expect(initializeView).toHaveBeenCalledWith('grid', null);
    expect(initializeDetails).toHaveBeenCalledOnce();
  });
});

describe('music cover paths', () => {
  test('resolves repository-relative covers while preserving empty covers', () => {
    expect(resolveCoverUrl('assets/images/pxfuel.jpg')).toBe('/website/assets/images/pxfuel.jpg');
    expect(resolveCoverUrl('')).toBe('');
  });
});
