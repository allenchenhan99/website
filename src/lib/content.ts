import { existsSync } from 'node:fs';
import { join } from 'node:path';

import musicContent from '../../posts/music.json';
import perfumeContent from '../../posts/perfume.json';

export type MusicPost = {
  id: number;
  date: string;
  title: string;
  tag: string;
  excerpt: string;
  cover: string;
};

export const perfumeRatingKeys = [
  'longevity',
  'presence',
  'sweetness',
  'warmth',
  'complexity',
  'dailyWearability',
] as const;

export type PerfumeRatingKey = typeof perfumeRatingKeys[number];

export type PerfumeNotes = {
  top: string[];
  middle: string[];
  base: string[];
};

export type PerfumeRatings = Record<PerfumeRatingKey, number>;

export type PerfumePost = {
  id: number;
  date: string;
  brand: string;
  name: string;
  title: string;
  excerpt: string;
  content: string[];
  scents: string[];
  notes: PerfumeNotes;
  ratings: PerfumeRatings;
  cover: string;
  source: string;
};

export type RecentPost =
  | (Omit<MusicPost, 'id'> & {
      id: `m${number}`;
      sourceId: number;
      category: 'music';
    })
  | (Omit<PerfumePost, 'id'> & {
      id: `p${number}`;
      sourceId: number;
      category: 'perfume';
    });

type ContentRecord = Record<string, unknown>;
type AssetExists = (path: string) => boolean;

const datePattern = /^(\d{4})\/(\d{2})\/(\d{2})$/;

const publicAssetExists: AssetExists = (path) =>
  existsSync(join(process.cwd(), 'public', path));

const asRecord = (value: unknown, label: string): ContentRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  return value as ContentRecord;
};

const requirePositiveId = (record: ContentRecord, label: string): number => {
  const { id } = record;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new TypeError(`${label} id must be a positive number`);
  }

  return id;
};

const requireDate = (record: ContentRecord, label: string): string => {
  const { date } = record;
  if (typeof date !== 'string') {
    throw new TypeError(`${label} date must use YYYY/MM/DD`);
  }

  const match = datePattern.exec(date);
  if (!match) throw new TypeError(`${label} date must use YYYY/MM/DD`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]!) {
    throw new TypeError(`${label} date "${date}" is not a valid calendar date`);
  }

  return date;
};

const requireString = (record: ContentRecord, field: string, label: string): string => {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new TypeError(`${label} ${field} must be a string`);
  }

  return value;
};

const getCover = (record: ContentRecord, label: string, assetExists: AssetExists): string => {
  const cover = record.cover;
  if (cover === undefined || cover === '') return '';
  if (typeof cover !== 'string') {
    throw new TypeError(`${label} cover must be a string`);
  }
  if (URL.canParse(cover) && new URL(cover).protocol === 'https:') return cover;
  if (assetExists(cover)) return cover;

  console.warn(`[content] ${label} cover is missing from public/${cover}; using no cover.`);
  return '';
};

const validateArray = (input: unknown, label: string): unknown[] => {
  if (!Array.isArray(input)) throw new TypeError(`${label} must be an array`);
  return input;
};

const requireStringArray = (input: unknown, label: string): string[] => {
  const values = validateArray(input, label);
  if (values.length === 0 || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
  return values as string[];
};

const requirePerfumeNotes = (record: ContentRecord, label: string): PerfumeNotes => {
  const notes = asRecord(record.notes, `${label} notes`);
  return {
    top: requireStringArray(notes.top, `${label} notes.top`),
    middle: requireStringArray(notes.middle, `${label} notes.middle`),
    base: requireStringArray(notes.base, `${label} notes.base`),
  };
};

const requirePerfumeRatings = (record: ContentRecord, label: string): PerfumeRatings => {
  const ratings = asRecord(record.ratings, `${label} ratings`);
  const unsupportedKeys = Object.keys(ratings).filter(
    (key) => !perfumeRatingKeys.includes(key as PerfumeRatingKey),
  );
  if (unsupportedKeys.length > 0) {
    throw new TypeError(`${label} has unsupported rating: ${unsupportedKeys.join(', ')}`);
  }

  return Object.fromEntries(perfumeRatingKeys.map((key) => {
    const value = ratings[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${label} ratings.${key} must be a number`);
    }
    if (value < 1 || value > 5) {
      throw new TypeError(`${label} ratings.${key} must be between 1 and 5`);
    }
    if (!Number.isInteger(value * 2)) {
      throw new TypeError(`${label} ratings.${key} must use increments of 0.5`);
    }
    return [key, value];
  })) as PerfumeRatings;
};

export function parseMusicPosts(
  input: unknown,
  assetExists: AssetExists = publicAssetExists,
): MusicPost[] {
  const ids = new Set<number>();

  return validateArray(input, 'Music posts').map((value, index) => {
    const label = `Music post at index ${index}`;
    const record = asRecord(value, label);
    const id = requirePositiveId(record, label);
    if (ids.has(id)) throw new TypeError(`Music posts contain duplicate id: ${id}`);
    ids.add(id);

    return {
      id,
      date: requireDate(record, label),
      title: requireString(record, 'title', label),
      tag: requireString(record, 'tag', label),
      excerpt: requireString(record, 'excerpt', label),
      cover: getCover(record, label, assetExists),
    };
  });
}

export function parsePerfumePosts(
  input: unknown,
  assetExists: AssetExists = publicAssetExists,
): PerfumePost[] {
  const ids = new Set<number>();

  return validateArray(input, 'Perfume posts').map((value, index) => {
    const label = `Perfume post at index ${index}`;
    const record = asRecord(value, label);
    const id = requirePositiveId(record, label);
    if (ids.has(id)) throw new TypeError(`Perfume posts contain duplicate id: ${id}`);
    ids.add(id);
    const scents = requireStringArray(record.scents, `${label} scents`);
    const content = requireStringArray(record.content, `${label} content`);

    return {
      id,
      date: requireDate(record, label),
      brand: requireString(record, 'brand', label),
      name: requireString(record, 'name', label),
      title: requireString(record, 'title', label),
      excerpt: requireString(record, 'excerpt', label),
      content,
      scents,
      notes: requirePerfumeNotes(record, label),
      ratings: requirePerfumeRatings(record, label),
      cover: getCover(record, label, assetExists),
      source: requireString(record, 'source', label),
    };
  });
}

export function getRecentPosts(
  music: MusicPost[],
  perfume: PerfumePost[],
  limit = 3,
): RecentPost[] {
  return [
    ...music.map((post) => ({
      ...post,
      id: `m${post.id}` as const,
      sourceId: post.id,
      category: 'music' as const,
    })),
    ...perfume.map((post) => ({
      ...post,
      id: `p${post.id}` as const,
      sourceId: post.id,
      category: 'perfume' as const,
    })),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);
}

export const musicPosts = parseMusicPosts(musicContent);
export const perfumePosts = parsePerfumePosts(perfumeContent);
export const recentPosts = getRecentPosts(musicPosts, perfumePosts);
