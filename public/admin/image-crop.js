const CROP_PRESETS = {
  perfume: { width: 1200, height: 1500, label: '4 : 5 PORTRAIT' },
  music: { width: 1400, height: 1400, label: '1 : 1 SQUARE' },
};

export function getCropPreset(type) {
  return { ...CROP_PRESETS[type] };
}

export function getCoverPlacement({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * Math.max(1, zoom);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const maxOffsetX = Math.max(0, (drawWidth - frameWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - frameHeight) / 2);
  const constrainedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
  const constrainedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));

  return {
    scale,
    x: (frameWidth - drawWidth) / 2 + constrainedX,
    y: (frameHeight - drawHeight) / 2 + constrainedY,
    drawWidth,
    drawHeight,
    offsetX: constrainedX,
    offsetY: constrainedY,
  };
}
