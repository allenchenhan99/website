import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

async function loadCropModule() {
  const source = await readFile(new URL('../../public/admin/image-crop.js', import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

describe('admin image crop geometry', () => {
  test('uses a portrait perfume output and a square music output', async () => {
    const { getCropPreset } = await loadCropModule();

    expect(getCropPreset('perfume')).toEqual({ width: 1200, height: 1500, label: '4 : 5 PORTRAIT' });
    expect(getCropPreset('music')).toEqual({ width: 1400, height: 1400, label: '1 : 1 SQUARE' });
  });

  test('cover-fits a wide image without exposing empty space', async () => {
    const { getCoverPlacement } = await loadCropModule();

    expect(getCoverPlacement({
      imageWidth: 2000,
      imageHeight: 1000,
      frameWidth: 400,
      frameHeight: 500,
      zoom: 1,
      offsetX: 500,
      offsetY: 20,
    })).toEqual({
      scale: 0.5,
      x: 0,
      y: 0,
      drawWidth: 1000,
      drawHeight: 500,
      offsetX: 300,
      offsetY: 0,
    });
  });

  test('zoom adds draggable room and clamps both axes', async () => {
    const { getCoverPlacement } = await loadCropModule();

    expect(getCoverPlacement({
      imageWidth: 1000,
      imageHeight: 1000,
      frameWidth: 400,
      frameHeight: 500,
      zoom: 2,
      offsetX: -999,
      offsetY: 999,
    })).toEqual({
      scale: 1,
      x: -600,
      y: 0,
      drawWidth: 1000,
      drawHeight: 1000,
      offsetX: -300,
      offsetY: 250,
    });
  });
});
