import { withBase } from '../config/site';

export type MusicView = 'grid' | 'list';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;
type MusicStorage = StorageReader & StorageWriter;

export function readMusicView(storage: StorageReader | null): MusicView {
  try {
    if (!storage) return 'grid';
    return storage.getItem('music-view') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function writeMusicView(view: MusicView, storage: StorageWriter | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem('music-view', view);
    return true;
  } catch {
    return false;
  }
}

export function resolveCoverUrl(cover: string): string {
  return cover ? withBase(cover) : '';
}

function initializeViewController(initialView: MusicView, storage: MusicStorage | null) {
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
    if (persist) writeMusicView(view, storage);
  };

  setView(initialView, false);
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

export function initializeMusicControllers(dependencies: {
  getStorage: () => MusicStorage;
  initializeView: (initialView: MusicView, storage: MusicStorage | null) => void;
  initializeDetails: () => void;
}) {
  let storage: MusicStorage | null = null;
  try {
    storage = dependencies.getStorage();
  } catch {
    storage = null;
  }

  dependencies.initializeView(readMusicView(storage), storage);
  dependencies.initializeDetails();
}

export function initializeMusic() {
  initializeMusicControllers({
    getStorage: () => window.localStorage,
    initializeView: initializeViewController,
    initializeDetails: initializeDetailDialog,
  });
}
