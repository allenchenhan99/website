const ASCII_BLOCK_WIDTHS = [
  10, 8, 8, 8, 9, 11, 8, 4, 9, 9,
  11, 9, 4, 8, 8, 8, 8, 9, 10, 8, 8, 4, 8, 8, 9, 9,
] as const;

const ASCII_ROWS_PER_LINE = 6;
const ASCII_SECOND_LINE_START = 9;
const ASCII_INTERVAL_MS = 100;
const CHIPI_ROWS_PER_FRAME = 42;
const CHIPI_FRAME_INTERVAL_MS = 20;
const CHIPI_IDLE_TIMEOUT_MS = 1_500;

export function buildAsciiFrame(source: string, blockIndex: number): string {
  if (blockIndex < 0) return '';

  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const completedBlocks = Math.min(Math.floor(blockIndex) + 1, ASCII_BLOCK_WIDTHS.length);
  const topBlockCount = Math.min(completedBlocks, 10);
  const topWidth = ASCII_BLOCK_WIDTHS
    .slice(0, topBlockCount)
    .reduce((total, width) => total + width, 0);
  const top = lines
    .slice(0, ASCII_ROWS_PER_LINE)
    .map((line) => line.slice(0, topWidth));

  if (completedBlocks <= 10) return top.join('\n');

  const bottomWidth = ASCII_BLOCK_WIDTHS
    .slice(10, completedBlocks)
    .reduce((total, width) => total + width, 0);
  const bottom = lines
    .slice(ASCII_SECOND_LINE_START, ASCII_SECOND_LINE_START + ASCII_ROWS_PER_LINE)
    .map((line) => line.slice(0, bottomWidth));
  const frame = [...top, '', '', '', ...bottom].join('\n');

  return completedBlocks === ASCII_BLOCK_WIDTHS.length ? frame.trimEnd() : frame;
}

export function splitChipiFrames(lines: readonly string[], rowsPerFrame: number): string[] {
  if (!Number.isInteger(rowsPerFrame) || rowsPerFrame <= 0) return [];

  const frames: string[] = [];
  for (let start = 0; start < lines.length; start += rowsPerFrame) {
    frames.push(lines.slice(start, start + rowsPerFrame).join('\n'));
  }
  return frames;
}

type TimeoutCallback = () => void;
type FrameCallback = (timestamp: number) => void;

export function startAsciiAnimation(options: {
  source: string;
  reducedMotion: boolean;
  render: (frame: string) => void;
  scheduleTimeout: (callback: TimeoutCallback, delay: number) => unknown;
}) {
  const { source, reducedMotion, render, scheduleTimeout } = options;
  if (reducedMotion) {
    render(source.trimEnd());
    return;
  }

  let blockIndex = 0;
  const displayNextBlock = () => {
    render(buildAsciiFrame(source, blockIndex));
    blockIndex += 1;
    if (blockIndex < ASCII_BLOCK_WIDTHS.length) {
      scheduleTimeout(displayNextBlock, ASCII_INTERVAL_MS);
    }
  };

  displayNextBlock();
}

function initializeAsciiAnimation() {
  const target = document.querySelector<HTMLElement>('[data-ascii-animation]');
  const sourceTemplate = document.querySelector<HTMLTemplateElement>('[data-ascii-source]');
  const source = sourceTemplate?.content.textContent ?? '';
  if (!target || !source) return;

  startAsciiAnimation({
    source,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    render: (frame) => {
      target.textContent = frame;
    },
    scheduleTimeout: (callback, delay) => window.setTimeout(callback, delay),
  });
}

export function startChipiFrameAnimation(options: {
  frames: readonly string[];
  render: (frame: string) => void;
  requestFrame: (callback: FrameCallback) => unknown;
  isHidden: () => boolean;
}) {
  const { frames, render, requestFrame, isHidden } = options;
  if (frames.length < 2) return;

  let frameIndex = 1;
  let previousFrameTime = 0;

  const displayNextFrame: FrameCallback = (timestamp) => {
    if (isHidden()) {
      previousFrameTime = timestamp;
    } else if (timestamp - previousFrameTime >= CHIPI_FRAME_INTERVAL_MS) {
      render(frames[frameIndex] ?? frames[0] ?? '');
      frameIndex = (frameIndex + 1) % frames.length;
      previousFrameTime +=
        Math.floor((timestamp - previousFrameTime) / CHIPI_FRAME_INTERVAL_MS) *
        CHIPI_FRAME_INTERVAL_MS;
    }

    requestFrame(displayNextFrame);
  };

  requestFrame(displayNextFrame);
}

export async function loadChipiAnimation(options: {
  sourceUrl: string;
  fetchText: (sourceUrl: string) => Promise<string>;
  render: (frame: string) => void;
  requestFrame: (callback: FrameCallback) => unknown;
  isHidden: () => boolean;
  reportError: (error: unknown) => void;
}): Promise<boolean> {
  const { sourceUrl, fetchText, reportError, ...animation } = options;
  try {
    const source = (await fetchText(sourceUrl)).trimEnd();
    startChipiFrameAnimation({
      ...animation,
      frames: splitChipiFrames(source.split(/\r?\n/), CHIPI_ROWS_PER_FRAME),
    });
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

export function scheduleIdleLoad(
  load: TimeoutCallback,
  options: {
    requestIdleCallback?: (
      callback: TimeoutCallback,
      options: { timeout: number },
    ) => unknown;
    scheduleTimeout: (callback: TimeoutCallback, delay: number) => unknown;
  },
) {
  if (options.requestIdleCallback) {
    options.requestIdleCallback(load, { timeout: CHIPI_IDLE_TIMEOUT_MS });
  } else {
    options.scheduleTimeout(load, CHIPI_IDLE_TIMEOUT_MS);
  }
}

async function fetchChipiText(sourceUrl: string): Promise<string> {
  const response = await fetch(sourceUrl, { priority: 'low' } as RequestInit);
  if (!response.ok) throw new Error(`Chipi asset returned ${response.status}`);
  return response.text();
}

function initializeChipiAnimation() {
  const target = document.querySelector<HTMLElement>('[data-chipi-src]');
  const sourceUrl = target?.dataset.chipiSrc;
  if (!target || !sourceUrl) return;

  const load = () => void loadChipiAnimation({
    sourceUrl,
    fetchText: fetchChipiText,
    render: (frame) => {
      target.textContent = frame;
    },
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    isHidden: () => document.hidden,
    reportError: (error) => console.error('Unable to load the Chipi animation:', error),
  });
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: TimeoutCallback,
      options?: { timeout: number },
    ) => number;
  };

  scheduleIdleLoad(load, {
    requestIdleCallback: idleWindow.requestIdleCallback?.bind(idleWindow),
    scheduleTimeout: (callback, delay) => window.setTimeout(callback, delay),
  });
}

function initializeDetailDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-detail-dialog]');
  const category = dialog?.querySelector<HTMLElement>('[data-detail-category]');
  const date = dialog?.querySelector<HTMLElement>('[data-detail-date]');
  const title = dialog?.querySelector<HTMLElement>('[data-detail-title]');
  const excerpt = dialog?.querySelector<HTMLElement>('[data-detail-excerpt]');
  const link = dialog?.querySelector<HTMLAnchorElement>('[data-detail-link]');
  if (!dialog || !category || !date || !title || !excerpt || !link) return;

  document.querySelectorAll<HTMLButtonElement>('[data-recent-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const sourceCategory = trigger.querySelector<HTMLElement>('.recent-tag')?.textContent ?? '';
      category.className = `recent-tag ${sourceCategory}`;
      category.textContent = sourceCategory;
      date.textContent = trigger.querySelector<HTMLElement>('.recent-date')?.textContent ?? '';
      title.textContent = trigger.querySelector<HTMLElement>('.recent-title')?.textContent ?? '';
      excerpt.textContent = trigger.querySelector<HTMLElement>('.recent-excerpt')?.textContent ?? '';
      link.href = trigger.dataset.detailHref ?? '#';
      link.textContent = `Go to ${sourceCategory} page`;
      dialog.showModal();
    });
  });

  dialog.querySelector<HTMLButtonElement>('[data-detail-close]')?.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function initializeHome() {
  initializeAsciiAnimation();
  initializeChipiAnimation();
  initializeDetailDialog();
}
