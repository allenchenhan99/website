const JOURNAL_TOPICS = ['Competitions', 'Weekly Notes'];
const RESEARCH_TOPICS = ['Agent Systems', 'Deep Learning', 'Quantitative Finance'];

export function articleTopics(type) {
  return type === 'research' ? RESEARCH_TOPICS : JOURNAL_TOPICS;
}

export function filterArticles(rows, type) {
  return rows.filter((row) => row.type === type);
}

export function articlePayload(fields) {
  return {
    id: String(fields.id || '').trim(),
    type: fields.type === 'research' ? 'research' : 'journal',
    topic: String(fields.topic || '').trim(),
    title: String(fields.title || '').trim(),
    slug: String(fields.slug || '').trim(),
    summary: String(fields.summary || '').trim(),
    date: String(fields.date || '').trim(),
    status: fields.status === 'published' ? 'published' : 'draft',
    stage: fields.stage === '已完成' ? '已完成' : '進行中',
    featured: Boolean(fields.featured),
    body: String(fields.body || ''),
    link: String(fields.link || '').trim(),
    event: String(fields.event || '').trim(),
    role: String(fields.role || '').trim(),
  };
}
