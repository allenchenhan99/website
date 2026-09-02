const ASCII_BLOCK_WIDTHS = [
  8, 8, 8, 8, 10, 4, 8, 4, 10,
] as const;

const ASCII_ROWS_PER_LINE = 6;
const ASCII_INTERVAL_MS = 100;
const CHIPI_ROWS_PER_FRAME = 42;
const CHIPI_FRAME_INTERVAL_MS = 20;
const CHIPI_IDLE_TIMEOUT_MS = 1_500;
const REACH_FLOW_INTERVAL_MS = 105;

export type ReachSignalData = {
  totalReach: number;
  todayReach: number;
  dailyReach: readonly number[];
};

export type ReachSignalSnapshot = ReachSignalData & {
  periodDays: 30;
  updatedAt: string;
};

export const REACH_SIGNAL_DATA: ReachSignalData = {
  totalReach: 0,
  todayReach: 0,
  dailyReach: Array.from({ length: 30 }, () => 0),
};

export function buildAsciiFrame(source: string, blockIndex: number): string {
  if (blockIndex < 0) return '';

  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const completedBlocks = Math.min(Math.floor(blockIndex) + 1, ASCII_BLOCK_WIDTHS.length);
  const visibleWidth = ASCII_BLOCK_WIDTHS
    .slice(0, completedBlocks)
    .reduce((total, width) => total + width, 0);
  const frame = lines
    .slice(0, ASCII_ROWS_PER_LINE)
    .map((line) => line.slice(0, visibleWidth))
    .join('\n');

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

export function parseReachSignalSnapshot(value: unknown): ReachSignalSnapshot | null {
  if (!isRecord(value)) return null;

  const dailyReach = value.dailyReach;
  if (
    value.periodDays !== 30
    || !isCount(value.totalReach)
    || !isCount(value.todayReach)
    || !Array.isArray(dailyReach)
    || dailyReach.length !== 30
    || !dailyReach.every(isCount)
    || typeof value.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(value.updatedAt))
  ) return null;

  return {
    periodDays: 30,
    totalReach: value.totalReach,
    todayReach: value.todayReach,
    dailyReach,
    updatedAt: value.updatedAt,
  };
}

export async function loadReachSignalSnapshot(options: {
  statsUrl: string;
  registerVisit: boolean;
  hasCountedVisit: () => boolean;
  markVisitCounted: () => void;
  fetchJson: (statsUrl: string, method: 'GET' | 'POST') => Promise<unknown>;
  reportError: (error: unknown) => void;
}): Promise<ReachSignalSnapshot | null> {
  const {
    statsUrl,
    registerVisit,
    hasCountedVisit,
    markVisitCounted,
    fetchJson,
    reportError,
  } = options;
  try {
    const shouldIncrement = registerVisit && !hasCountedVisit();
    const snapshot = parseReachSignalSnapshot(await fetchJson(
      statsUrl,
      shouldIncrement ? 'POST' : 'GET',
    ));
    if (!snapshot) throw new Error('Reach endpoint returned an invalid payload');
    if (shouldIncrement) markVisitCounted();
    return snapshot;
  } catch (error) {
    reportError(error);
    return null;
  }
}

function stableNoise(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function sampleSeries(series: readonly number[], position: number): number {
  const scaled = clamp(position, 0, 1) * (series.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(series.length - 1, left + 1);
  const mix = scaled - left;
  return (series[left] ?? 0) * (1 - mix) + (series[right] ?? 0) * mix;
}

function stampText(rows: string[][], row: number, column: number, text: string) {
  if (!rows[row]) return;
  [...text].forEach((character, offset) => {
    const target = column + offset;
    if (target >= 0 && target < rows[row]!.length) rows[row]![target] = character;
  });
}

export function buildReachFlowFrame(options: {
  data: ReachSignalData;
  columns: number;
  phase: number;
}): string {
  const { data, phase } = options;
  const columns = clamp(Math.trunc(options.columns), 48, 200);
  const rowCount = columns < 90 ? 18 : 21;
  const palette = ' .,:;-~=+*#%@';
  const maximum = Math.max(1, ...data.dailyReach);
  const rows = Array.from({ length: rowCount }, () => Array<string>(columns).fill(' '));

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const progress = column / Math.max(1, columns - 1);
      const reach = sampleSeries(data.dailyReach, progress) / maximum;
      const center = rowCount * .5
        + Math.sin(column * .105 + phase) * (1.6 + reach * 1.9)
        + Math.sin(column * .031 - phase * .7) * 1.8;
      const width = 1.2 + reach * 3.1;
      const distance = Math.abs(row - center);
      const ribbon = Math.exp(-(distance * distance) / (2 * width * width));
      const interference = .68 + Math.sin(column * .37 + row * .81 - phase * 1.4) * .21;
      const noise = stableNoise(column, row);
      let intensity = ribbon * interference * (.42 + reach * .72);

      if (distance > width * 2.2) intensity = noise > .985 ? .18 : 0;
      const paletteIndex = clamp(Math.floor(intensity * palette.length), 0, palette.length - 1);
      rows[row]![column] = palette[paletteIndex] ?? ' ';
    }
  }

  const high = Math.max(...data.dailyReach);
  const low = Math.min(...data.dailyReach);
  const status = `30D H ${high} / L ${low} // DENSITY = DAILY REACH`;
  stampText(rows, 1, 2, 'ALLEN.LIN // PUBLIC REACH SIGNAL');
  stampText(rows, rowCount - 2, Math.max(2, columns - status.length - 2), status);
  return rows.map((row) => row.join('')).join('\n');
}

export function buildReachTickerText(data: ReachSignalData): string {
  const high = Math.max(...data.dailyReach);
  const low = Math.min(...data.dailyReach);
  return `RCH ${data.totalReach.toLocaleString('en-US')}   │   TODAY ${data.todayReach.toLocaleString('en-US')}   │   30D H ${high} / L ${low}`;
}

export function startReachFlowAnimation(options: {
  reducedMotion: boolean;
  render: (phase: number) => void;
  requestFrame: (callback: FrameCallback) => unknown;
  isHidden: () => boolean;
}) {
  const { reducedMotion, render, requestFrame, isHidden } = options;
  render(0);
  if (reducedMotion) return;

  let previousPaint = 0;
  const paint: FrameCallback = (timestamp) => {
    if (!isHidden() && timestamp - previousPaint >= REACH_FLOW_INTERVAL_MS) {
      render(timestamp / 1800);
      previousPaint = timestamp;
    }
    requestFrame(paint);
  };
  requestFrame(paint);
}

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

async function fetchReachJson(statsUrl: string, method: 'GET' | 'POST'): Promise<unknown> {
  const response = await fetch(statsUrl, {
    method,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Reach endpoint returned ${response.status}`);
  return response.json() as Promise<unknown>;
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

function initializeReachSignal() {
  const target = document.querySelector<HTMLElement>('[data-reach-flow]');
  const ticker = document.querySelector<HTMLElement>('[data-reach-ticker]');
  const surface = target?.closest<HTMLElement>('[data-reach-surface]');
  const section = surface?.closest<HTMLElement>('.reach-signal');
  const source = section?.querySelector<HTMLElement>('[data-reach-source]');
  if (!target || !ticker || !surface) return;

  let currentData: ReachSignalData = REACH_SIGNAL_DATA;
  let currentPhase = 0;
  const render = (phase: number) => {
    currentPhase = phase;
    const fontSize = Number.parseFloat(getComputedStyle(target).fontSize) || 9;
    const columns = clamp(Math.floor(surface.clientWidth / (fontSize * .61)), 48, 200);
    target.textContent = buildReachFlowFrame({
      data: currentData,
      columns,
      phase,
    });
  };

  startReachFlowAnimation({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    render,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    isHidden: () => document.hidden,
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => render(currentPhase));
    observer.observe(surface);
  }

  const statsUrl = section?.dataset.reachStatsUrl;
  if (statsUrl) {
    void loadReachSignalSnapshot({
      statsUrl,
      registerVisit: window.location.hostname === 'allenchenhan99.github.io',
      hasCountedVisit: () => {
        try {
          return window.localStorage.getItem('allenlin-reach-counted-v1') === '1';
        } catch {
          return true;
        }
      },
      markVisitCounted: () => {
        try {
          window.localStorage.setItem('allenlin-reach-counted-v1', '1');
        } catch {
          // Storage can be unavailable in strict privacy modes; avoid blocking the live count.
        }
      },
      fetchJson: fetchReachJson,
      reportError: (error) => console.error('Unable to load the public reach signal:', error),
    }).then((snapshot) => {
      if (!snapshot) return;
      currentData = snapshot;
      ticker.textContent = buildReachTickerText(snapshot);
      if (source) {
        source.textContent = `live counter · ${snapshot.periodDays} days`;
        source.dataset.reachState = 'live';
      }
      render(currentPhase);
    });
  }
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
  initializeReachSignal();
  initializeDetailDialog();
}
