import { withBase } from '../config/site';
import type { PerfumePost } from '../lib/content';

export type PerfumeFilterMode = 'scent' | 'brand';

export type PerfumeFilterState = {
  mode: PerfumeFilterMode;
  activeFilter: string;
  options: string[];
  visibleIds: number[];
  featuredId: number | null;
  gridIds: number[];
  count: number;
  showMore: boolean;
  empty: boolean;
};

type PerfumeFilterView = {
  render: (state: PerfumeFilterState) => void;
};

type PerfumeDialogView = {
  render: (post: PerfumePost) => void;
  showModal: () => void;
  close: () => void;
};

const ALL_FILTER = 'All';

export function getPerfumeFilterOptions(
  posts: PerfumePost[],
  mode: PerfumeFilterMode,
): string[] {
  const values = mode === 'scent'
    ? posts.flatMap((post) => post.scents)
    : posts.map((post) => post.brand);

  return [...new Set([ALL_FILTER, ...values]).values()].sort((left, right) => {
    if (left === ALL_FILTER) return -1;
    if (right === ALL_FILTER) return 1;
    return left.localeCompare(right);
  });
}

export function filterPerfumePosts(
  posts: PerfumePost[],
  mode: PerfumeFilterMode,
  activeFilter: string,
): PerfumePost[] {
  if (activeFilter === ALL_FILTER) return posts;
  if (mode === 'scent') {
    return posts.filter((post) => post.scents.includes(activeFilter));
  }
  return posts.filter((post) => post.brand === activeFilter);
}

export function getPerfumeCoverPresentation(post: Pick<PerfumePost, 'cover'>) {
  const coverUrl = post.cover ? withBase(post.cover) : '';
  return { coverUrl, showPlaceholder: coverUrl.length === 0 };
}

export function createPerfumeFilterController(posts: PerfumePost[], view: PerfumeFilterView) {
  let mode: PerfumeFilterMode = 'scent';
  let activeFilter = ALL_FILTER;

  const update = () => {
    const filteredPosts = filterPerfumePosts(posts, mode, activeFilter);
    const visibleIds = filteredPosts.map(({ id }) => id);
    view.render({
      mode,
      activeFilter,
      options: getPerfumeFilterOptions(posts, mode),
      visibleIds,
      featuredId: visibleIds[0] ?? null,
      gridIds: visibleIds.slice(1),
      count: visibleIds.length,
      showMore: visibleIds.length > 1,
      empty: visibleIds.length === 0,
    });
  };

  update();
  return {
    setMode(nextMode: PerfumeFilterMode) {
      mode = nextMode;
      activeFilter = ALL_FILTER;
      update();
    },
    setFilter(nextFilter: string) {
      activeFilter = nextFilter;
      update();
    },
  };
}

export function createPerfumeDialogController(posts: PerfumePost[], view: PerfumeDialogView) {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  return {
    open(id: number) {
      const post = postsById.get(id);
      if (!post) return false;
      view.render(post);
      view.showModal();
      return true;
    },
    close() {
      view.close();
    },
  };
}

function readStaticPosts(): PerfumePost[] {
  return [...document.querySelectorAll<HTMLElement>('[data-perfume-detail]')].flatMap((detail) => {
    const id = Number(detail.dataset.postId);
    if (!Number.isFinite(id)) return [];
    return [{
      id,
      date: detail.querySelector<HTMLElement>('[data-source-date]')?.textContent ?? '',
      brand: detail.querySelector<HTMLElement>('[data-source-brand]')?.textContent ?? '',
      name: detail.querySelector<HTMLElement>('[data-source-name]')?.textContent ?? '',
      excerpt: detail.querySelector<HTMLElement>('[data-source-excerpt]')?.textContent ?? '',
      scents: [...detail.querySelectorAll<HTMLElement>('[data-source-scent]')]
        .map((scent) => scent.textContent ?? ''),
      cover: detail.dataset.coverPath ?? '',
    }];
  });
}

function initializeFilterController(posts: PerfumePost[]) {
  const count = document.querySelector<HTMLElement>('[data-perfume-count]');
  const tags = document.querySelector<HTMLElement>('[data-filter-tags]');
  const moreLabel = document.querySelector<HTMLElement>('[data-more-label]');
  const grid = document.querySelector<HTMLElement>('[data-perfume-grid]');
  const empty = document.querySelector<HTMLElement>('[data-perfume-empty]');
  const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-filter-mode]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-perfume-card]')];
  if (!count || !tags || !moreLabel || !grid || !empty) return;

  let controller: ReturnType<typeof createPerfumeFilterController> | undefined;
  controller = createPerfumeFilterController(posts, {
    render(state) {
      count.textContent = `${state.count} fragrances`;
      moreLabel.hidden = !state.showMore;
      grid.hidden = !state.showMore;
      empty.hidden = !state.empty;

      modeButtons.forEach((button) => {
        const active = button.dataset.filterMode === state.mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      tags.replaceChildren(...state.options.map((option) => {
        const button = document.createElement('button');
        const active = option === state.activeFilter;
        button.type = 'button';
        button.className = `filter-tag${active ? ' active' : ''}`;
        button.dataset.filterValue = option;
        button.setAttribute('aria-pressed', String(active));
        button.textContent = option;
        button.addEventListener('click', () => controller?.setFilter(option));
        return button;
      }));

      const visibleIds = new Set(state.visibleIds);
      const gridIds = new Set(state.gridIds);
      cards.forEach((card) => {
        const id = Number(card.dataset.postId);
        const role = card.dataset.cardRole;
        card.hidden = role === 'featured'
          ? id !== state.featuredId
          : !visibleIds.has(id) || !gridIds.has(id);
      });
    },
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      controller?.setMode(button.dataset.filterMode === 'brand' ? 'brand' : 'scent');
    });
  });
}

function initializeDetailDialog(posts: PerfumePost[]) {
  const dialog = document.querySelector<HTMLDialogElement>('[data-perfume-dialog]');
  const cover = dialog?.querySelector<HTMLImageElement>('[data-dialog-cover]');
  const emptyCover = dialog?.querySelector<HTMLElement>('[data-dialog-cover-empty]');
  const brand = dialog?.querySelector<HTMLElement>('[data-dialog-brand]');
  const date = dialog?.querySelector<HTMLElement>('[data-dialog-date]');
  const name = dialog?.querySelector<HTMLElement>('[data-dialog-name]');
  const scents = dialog?.querySelector<HTMLElement>('[data-dialog-scents]');
  const excerpt = dialog?.querySelector<HTMLElement>('[data-dialog-excerpt]');
  if (!dialog || !cover || !emptyCover || !brand || !date || !name || !scents || !excerpt) return;

  const controller = createPerfumeDialogController(posts, {
    render(post) {
      const presentation = getPerfumeCoverPresentation(post);
      brand.textContent = post.brand;
      date.textContent = post.date;
      name.textContent = post.name;
      excerpt.textContent = post.excerpt;
      scents.replaceChildren(...post.scents.map((scent) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = scent;
        return tag;
      }));
      cover.hidden = presentation.showPlaceholder;
      emptyCover.hidden = !presentation.showPlaceholder;
      if (presentation.coverUrl) {
        cover.src = presentation.coverUrl;
        cover.alt = `${post.name} cover`;
      } else {
        cover.removeAttribute('src');
        cover.alt = '';
      }
    },
    showModal() {
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  });

  document.querySelectorAll<HTMLButtonElement>('[data-perfume-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => controller.open(Number(trigger.dataset.postId)));
  });
  dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', controller.close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) controller.close();
  });
}

export function initializePerfume() {
  const posts = readStaticPosts();
  initializeFilterController(posts);
  initializeDetailDialog(posts);
}
