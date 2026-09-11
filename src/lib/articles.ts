export type Article = {
  id: string;
  type: 'journal' | 'research';
  title: string;
  slug: string;
  summary: string;
  date: string;
  topic: string;
  status: 'draft' | 'published';
  stage: '進行中' | '已完成';
  featured: boolean;
  body: string;
  link: string;
  event: string;
  role: string;
};

export const isLocalPreview = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export function isArticle(value: unknown): value is Article {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['id','title','slug','summary','date','topic','body','link','event','role'].every(key => typeof row[key] === 'string')
    && (row.type === 'journal' || row.type === 'research')
    && (row.status === 'draft' || row.status === 'published')
    && (row.stage === '進行中' || row.stage === '已完成') && typeof row.featured === 'boolean';
}
export function visibleArticles(rows: Article[], type: Article['type']) {
  return rows.filter(row => row.type === type && row.status === 'published').sort((a,b) => b.date.localeCompare(a.date));
}
export function validateArticles(value: unknown): asserts value is Article[] {
  if (!Array.isArray(value) || !value.every(isArticle)) throw new Error('文章資料格式有誤。');
  const ids = new Set<string>(); const slugs = new Set<string>();
  for (const row of value) {
    if (!row.id || ids.has(row.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) || slugs.has(row.slug)) throw new Error('文章 ID 或網址代稱重複／無效。');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0,10) !== row.date) throw new Error('文章日期無效。');
    if (!row.title.trim() || !row.summary.trim() || !row.body.trim()) throw new Error('請填寫標題、摘要與內文。');
    const topics = row.type === 'journal' ? ['Competitions','Weekly Notes'] : ['Agent Systems','Deep Learning','Quantitative Finance'];
    if (!topics.includes(row.topic)) throw new Error('文章分類無效。');
    if (row.link && !/^https?:\/\//i.test(row.link)) throw new Error('連結必須使用 http 或 https。');
    ids.add(row.id); slugs.add(row.slug);
  }
}
