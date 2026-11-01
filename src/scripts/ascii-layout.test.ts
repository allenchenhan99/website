import { describe, expect, test } from 'vitest';

import { getAsciiLayout } from './ascii-layout';

describe('ASCII artwork fitting', () => {
  test('retains the original size when the complete artwork fits', () => {
    expect(getAsciiLayout({ availableWidth: 358, width: 320, height: 180 })).toEqual({ scale: 1, height: 180 });
  });

  test('shrinks both dimensions uniformly when enlarged text exceeds the container', () => {
    expect(getAsciiLayout({ availableWidth: 300, width: 600, height: 252 })).toEqual({ scale: 0.5, height: 126 });
  });

  test('keeps a collapsed container from reserving unscaled artwork height', () => {
    expect(getAsciiLayout({ availableWidth: 0, width: 750, height: 252 })).toEqual({ scale: 0, height: 0 });
  });
});
