import { withBase } from '../config/site';

export type MusicView = 'grid' | 'list';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;
type TimeoutCallback = () => void;

type HideableElement = { hidden: boolean };
type SpotifyFrame = {
  setAttribute: (name: string, value: string) => void;
  addEventListener: (name: string, listener: TimeoutCallback, options?: { once: boolean }) => void;
};

export type SpotifyContainer = {
  dataset: { src?: string; loaded?: string };
  querySelector: (selector: string) => HideableElement | null;
  appendChild: (frame: SpotifyFrame) => unknown;
};

type SpotifyDependencies = {
  createIframe: () => SpotifyFrame;
  scheduleTimeout: (callback: TimeoutCallback, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

type ObserverEntry = { isIntersecting: boolean; target: SpotifyContainer };
type Observer = {
  observe: (target: SpotifyContainer) => void;
  unobserve: (target: SpotifyContainer) => void;
};
type ObserverFactory = (
  callback: (entries: ObserverEntry[]) => void,
  options: { rootMargin: string },
) => Observer;

const spotifyDefaults: SpotifyDependencies = {
  createIframe: () => document.createElement('iframe'),
  scheduleTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
};

export function readMusicView(storage: StorageReader): MusicView {
  try {
    return storage.getItem('music-view') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function writeMusicView(view: MusicView, storage: StorageWriter): boolean {
  try {
    storage.setItem('music-view', view);
    return true;
  } catch {
    return false;
  }
}

export function resolveCoverUrl(cover: string): string {
  return cover ? withBase(cover) : '';
}

export function loadSpotifyEmbed(
  embed: SpotifyContainer,
  dependencies: SpotifyDependencies = spotifyDefaults,
): boolean {
  const sourceUrl = embed.dataset.src;
  if (!sourceUrl || embed.dataset.loaded === 'true') return false;

  embed.dataset.loaded = 'true';
  const status = embed.querySelector('[data-spotify-status]');
  const fallback = embed.querySelector('[data-spotify-fallback]');
  const iframe = dependencies.createIframe();
  iframe.setAttribute('src', sourceUrl);
  iframe.setAttribute('title', 'Spotify playlist');
  iframe.setAttribute('width', '100%');
  iframe.setAttribute('height', '352');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute(
    'allow',
    'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  );
  iframe.setAttribute('loading', 'lazy');

  const fallbackTimer = dependencies.scheduleTimeout(() => {
    if (fallback) fallback.hidden = false;
  }, 12_000);

  iframe.addEventListener('load', () => {
    dependencies.clearTimeout(fallbackTimer);
    if (status) status.hidden = true;
  }, { once: true });
  embed.appendChild(iframe);
  return true;
}

export function initializeSpotifyEmbeds(
  embeds: Iterable<SpotifyContainer>,
  dependencies: SpotifyDependencies & { createObserver?: ObserverFactory },
) {
  const targets = [...embeds];
  if (targets.length === 0) return;

  if (!dependencies.createObserver) {
    targets.forEach((target) => loadSpotifyEmbed(target, dependencies));
    return;
  }

  const observer = dependencies.createObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadSpotifyEmbed(entry.target, dependencies);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '300px' });
  targets.forEach((target) => observer.observe(target));
}

function initializeViewController() {
  const root = document.querySelector<HTMLElement>('[data-music-view]');
  if (!root) return;
  const controls = [...root.querySelectorAll<HTMLButtonElement>('[data-view-mode]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-view-panel]')];

  const setView = (view: MusicView, persist = true) => {
    root.dataset.view = view;
    controls.forEach((control) => {
      const active = control.dataset.viewMode === view;
      control.classList.toggle('active', active);
      control.setAttribute('aria-pressed', String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
    if (persist) writeMusicView(view, localStorage);
  };

  setView(readMusicView(localStorage), false);
  controls.forEach((control) => {
    control.addEventListener('click', () => {
      setView(control.dataset.viewMode === 'list' ? 'list' : 'grid');
    });
  });
}

function initializeDetailDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-music-dialog]');
  const title = dialog?.querySelector<HTMLElement>('[data-dialog-title]');
  const tag = dialog?.querySelector<HTMLElement>('[data-dialog-tag]');
  const date = dialog?.querySelector<HTMLElement>('[data-dialog-date]');
  const excerpt = dialog?.querySelector<HTMLElement>('[data-dialog-excerpt]');
  const cover = dialog?.querySelector<HTMLImageElement>('[data-dialog-cover]');
  const emptyCover = dialog?.querySelector<HTMLElement>('[data-dialog-cover-empty]');
  if (!dialog || !title || !tag || !date || !excerpt || !cover || !emptyCover) return;

  const details = new Map(
    [...document.querySelectorAll<HTMLElement>('[data-post-detail]')]
      .map((detail) => [detail.dataset.postId ?? '', detail] as const),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-post-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const detail = details.get(trigger.dataset.postId ?? '');
      if (!detail) return;
      title.textContent = detail.querySelector('[data-source-title]')?.textContent ?? '';
      tag.textContent = detail.querySelector('[data-source-tag]')?.textContent ?? '';
      date.textContent = detail.querySelector('[data-source-date]')?.textContent ?? '';
      excerpt.textContent = detail.querySelector('[data-source-excerpt]')?.textContent ?? '';
      const coverUrl = detail.dataset.coverUrl ?? '';
      cover.hidden = coverUrl.length === 0;
      emptyCover.hidden = coverUrl.length > 0;
      if (coverUrl) {
        cover.src = coverUrl;
        cover.alt = `${title.textContent} cover`;
      } else {
        cover.removeAttribute('src');
        cover.alt = '';
      }
      dialog.showModal();
    });
  });
  dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function initializeMusic() {
  initializeViewController();
  initializeDetailDialog();
  const embeds = document.querySelectorAll<HTMLElement>('[data-spotify-embed]');
  const createObserver: ObserverFactory | undefined = 'IntersectionObserver' in window
    ? (callback, options) => {
        const observer = new IntersectionObserver(
          (entries) => callback(entries.map((entry) => ({
            isIntersecting: entry.isIntersecting,
            target: entry.target as unknown as SpotifyContainer,
          }))),
          options,
        );
        return {
          observe: (target) => observer.observe(target as unknown as Element),
          unobserve: (target) => observer.unobserve(target as unknown as Element),
        };
      }
    : undefined;

  initializeSpotifyEmbeds(embeds as unknown as Iterable<SpotifyContainer>, {
    ...spotifyDefaults,
    createObserver,
  });
}
