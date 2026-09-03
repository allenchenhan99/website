import { withBase } from '../config/site';
import type { PerfumePost, PerfumeRatingKey, PerfumeRatings } from '../lib/content';

export type PerfumeFilterMode = 'scent' | 'brand';
export type PerfumeCoverLoading = 'eager' | 'lazy';

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
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const RADAR_CENTER = 150;
const RADAR_RADIUS = 100;

const perfumeRatingAxes = [
  { key: 'longevity', label: '持香' },
  { key: 'presence', label: '存在感' },
  { key: 'sweetness', label: '甜度' },
  { key: 'warmth', label: '溫暖度' },
  { key: 'complexity', label: '層次感' },
  { key: 'dailyWearability', label: '日常適用度' },
] as const satisfies ReadonlyArray<{ key: PerfumeRatingKey; label: string }>;

type RadarPointOptions = {
  index: number;
  radius: number;
};

function getRadarPoint({ index, radius }: RadarPointOptions) {
  const angle = (-Math.PI / 2) + (index * Math.PI * 2) / perfumeRatingAxes.length;
  return {
    x: RADAR_CENTER + Math.cos(angle) * radius,
    y: RADAR_CENTER + Math.sin(angle) * radius,
  };
}

function getRadarPolygon(radii: number[]) {
  return radii.map((radius, index) => {
    const point = getRadarPoint({ index, radius });
    return `${point.x},${point.y}`;
  }).join(' ');
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tag: K) {
  return document.createElementNS(SVG_NAMESPACE, tag);
}

function renderPerfumeRadar({
  mount,
  name,
  ratings,
}: {
  mount: HTMLElement;
  name: string;
  ratings: PerfumeRatings;
}) {
  const svg = createSvgElement('svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${name} 六軸主觀評分雷達圖`);

  for (let level = 1; level <= 5; level += 1) {
    const polygon = createSvgElement('polygon');
    polygon.classList.add('detail-radar-grid');
    polygon.setAttribute('points', getRadarPolygon(
      perfumeRatingAxes.map(() => level * (RADAR_RADIUS / 5)),
    ));
    svg.append(polygon);
  }

  perfumeRatingAxes.forEach((axis, index) => {
    const end = getRadarPoint({ index, radius: RADAR_RADIUS });
    const line = createSvgElement('line');
    line.classList.add('detail-radar-axis');
    line.setAttribute('x1', String(RADAR_CENTER));
    line.setAttribute('y1', String(RADAR_CENTER));
    line.setAttribute('x2', String(end.x));
    line.setAttribute('y2', String(end.y));
    svg.append(line);

    const labelPoint = getRadarPoint({ index, radius: 122 });
    const label = createSvgElement('text');
    label.classList.add('detail-radar-label');
    label.setAttribute('x', String(labelPoint.x));
    label.setAttribute('y', String(labelPoint.y));
    label.setAttribute(
      'text-anchor',
      Math.abs(labelPoint.x - RADAR_CENTER) < 10 ? 'middle' : labelPoint.x < RADAR_CENTER ? 'end' : 'start',
    );
    label.setAttribute(
      'dominant-baseline',
      labelPoint.y < 70 ? 'auto' : labelPoint.y > 230 ? 'hanging' : 'middle',
    );
    label.textContent = axis.label;
    svg.append(label);
  });

  const values = perfumeRatingAxes.map(({ key }) => ratings[key]);
  const shape = createSvgElement('polygon');
  shape.classList.add('detail-radar-shape');
  shape.setAttribute('points', getRadarPolygon(
    values.map((value) => value * (RADAR_RADIUS / 5)),
  ));
  svg.append(shape);

  values.forEach((value, index) => {
    const point = getRadarPoint({ index, radius: value * (RADAR_RADIUS / 5) });
    const circle = createSvgElement('circle');
    circle.classList.add('detail-radar-point');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.setAttribute('r', '3');
    svg.append(circle);
  });

  mount.replaceChildren(svg);
}

function renderPerfumeScores({ list, ratings }: { list: HTMLElement; ratings: PerfumeRatings }) {
  list.replaceChildren(...perfumeRatingAxes.map(({ key, label }) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const score = document.createElement('strong');
    name.textContent = label;
    score.textContent = ratings[key].toFixed(1);
    item.append(name, score);
    return item;
  }));
}

export function getPerfumeCoverLoading(
  index: number,
): PerfumeCoverLoading {
  return index === 0 ? 'eager' : 'lazy';
}

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
  const coverUrl = post.cover
    ? URL.canParse(post.cover) ? post.cover : withBase(post.cover)
    : '';
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
    const readRating = (key: PerfumeRatingKey) => Number(
      detail.querySelector<HTMLElement>(`[data-source-rating="${key}"]`)?.textContent,
    );
    return [{
      id,
      date: detail.querySelector<HTMLElement>('[data-source-date]')?.textContent ?? '',
      brand: detail.querySelector<HTMLElement>('[data-source-brand]')?.textContent ?? '',
      name: detail.querySelector<HTMLElement>('[data-source-name]')?.textContent ?? '',
      title: detail.querySelector<HTMLElement>('[data-source-title]')?.textContent ?? '',
      excerpt: detail.querySelector<HTMLElement>('[data-source-excerpt]')?.textContent ?? '',
      content: [...detail.querySelectorAll<HTMLElement>('[data-source-paragraph]')]
        .map((paragraph) => paragraph.textContent ?? ''),
      scents: [...detail.querySelectorAll<HTMLElement>('[data-source-scent]')]
        .map((scent) => scent.textContent ?? ''),
      notes: {
        top: [...detail.querySelectorAll<HTMLElement>('[data-source-note="top"]')]
          .map((note) => note.textContent ?? ''),
        middle: [...detail.querySelectorAll<HTMLElement>('[data-source-note="middle"]')]
          .map((note) => note.textContent ?? ''),
        base: [...detail.querySelectorAll<HTMLElement>('[data-source-note="base"]')]
          .map((note) => note.textContent ?? ''),
      },
      ratings: {
        longevity: readRating('longevity'),
        presence: readRating('presence'),
        sweetness: readRating('sweetness'),
        warmth: readRating('warmth'),
        complexity: readRating('complexity'),
        dailyWearability: readRating('dailyWearability'),
      },
      cover: detail.dataset.coverPath ?? '',
      source: detail.dataset.sourceUrl ?? '',
    }];
  });
}

function initializeFilterController(posts: PerfumePost[]) {
  const count = document.querySelector<HTMLElement>('[data-perfume-count]');
  const tags = document.querySelector<HTMLElement>('[data-filter-tags]');
  const grid = document.querySelector<HTMLElement>('[data-perfume-grid]');
  const empty = document.querySelector<HTMLElement>('[data-perfume-empty]');
  const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-filter-mode]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-perfume-card]')];
  if (!count || !tags || !grid || !empty) return;

  let controller: ReturnType<typeof createPerfumeFilterController> | undefined;
  controller = createPerfumeFilterController(posts, {
    render(state) {
      count.textContent = `${state.count} ${state.count === 1 ? 'fragrance' : 'fragrances'}`;
      grid.hidden = state.empty;
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
      cards.forEach((card) => {
        const id = Number(card.dataset.postId);
        card.hidden = !visibleIds.has(id);
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
  const title = dialog?.querySelector<HTMLElement>('[data-dialog-title]');
  const content = dialog?.querySelector<HTMLElement>('[data-dialog-content]');
  const topNotes = dialog?.querySelector<HTMLElement>('[data-dialog-notes="top"]');
  const middleNotes = dialog?.querySelector<HTMLElement>('[data-dialog-notes="middle"]');
  const baseNotes = dialog?.querySelector<HTMLElement>('[data-dialog-notes="base"]');
  const radar = dialog?.querySelector<HTMLElement>('[data-dialog-radar]');
  const scores = dialog?.querySelector<HTMLElement>('[data-dialog-scores]');
  const source = dialog?.querySelector<HTMLAnchorElement>('[data-dialog-source]');
  if (
    !dialog || !cover || !emptyCover || !brand || !date || !name || !title || !content
    || !topNotes || !middleNotes || !baseNotes || !radar || !scores || !source
  ) return;

  const controller = createPerfumeDialogController(posts, {
    render(post) {
      const presentation = getPerfumeCoverPresentation(post);
      brand.textContent = post.brand;
      date.textContent = post.date;
      name.textContent = post.name;
      title.textContent = post.title;
      content.replaceChildren(...post.content.map((paragraph) => {
        const element = document.createElement('p');
        element.textContent = paragraph;
        return element;
      }));
      topNotes.textContent = post.notes.top.join(' · ');
      middleNotes.textContent = post.notes.middle.join(' · ');
      baseNotes.textContent = post.notes.base.join(' · ');
      renderPerfumeRadar({ mount: radar, name: post.name, ratings: post.ratings });
      renderPerfumeScores({ list: scores, ratings: post.ratings });
      cover.hidden = presentation.showPlaceholder;
      emptyCover.hidden = !presentation.showPlaceholder;
      if (presentation.coverUrl) {
        cover.src = presentation.coverUrl;
        cover.alt = `${post.name} cover`;
      } else {
        cover.removeAttribute('src');
        cover.alt = '';
      }
      source.href = post.source;
      source.hidden = post.source.length === 0;
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
