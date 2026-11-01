export function getAsciiLayout(options: { availableWidth: number; width: number; height: number }) {
  const scale = Math.min(1, options.availableWidth / options.width);
  return { scale, height: options.height * scale };
}

export function initializeAsciiLayout() {
  document.querySelectorAll<HTMLElement>('[data-ascii-artwork]').forEach((stage) => {
    const artwork = stage.querySelector<HTMLElement>('pre');
    if (!artwork) return;

    const fit = () => {
      const artworkStyle = getComputedStyle(artwork);
      const width = Math.max(artwork.scrollWidth, Number.parseFloat(artworkStyle.width));
      const height = Math.max(artwork.scrollHeight, Number.parseFloat(artworkStyle.height));
      if (width <= 0 || height <= 0) return;

      const layout = getAsciiLayout({ availableWidth: Math.max(0, stage.clientWidth - 1), width, height });
      const stageStyle = getComputedStyle(stage);
      const padding = Number.parseFloat(stageStyle.paddingTop) + Number.parseFloat(stageStyle.paddingBottom);
      stage.style.setProperty('--ascii-scale', String(layout.scale));
      stage.style.height = `${Math.ceil(layout.height + padding)}px`;
      stage.dataset.asciiFitted = '';
    };

    fit();
    void document.fonts.ready.then(fit);
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(fit);
      observer.observe(stage);
      observer.observe(artwork);
    } else {
      window.addEventListener('resize', fit);
    }
  });
}
