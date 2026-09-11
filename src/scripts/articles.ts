import { isLocalPreview, validateArticles, type Article } from '../lib/articles';
import { renderMarkdown } from '../lib/article-markdown';
import { withBase } from '../config/site';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text: string) {
  const element = document.createElement(tag); element.textContent = text; return element;
}
export function initializeWritingIndex() {
  const root = document.querySelector<HTMLElement>('[data-writing-type]'); if (!root) return;
  const list = root.querySelector<HTMLElement>('[data-article-list]')!;
  root.querySelector<HTMLElement>('[data-local-note]')!.hidden = !isLocalPreview();
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.addEventListener('click', () => {
    let count = 0;
    list.querySelectorAll<HTMLElement>('.writing-card').forEach(card => {
      card.hidden = button.dataset.filter !== '全部' && card.dataset.topic !== button.dataset.filter;
      if (!card.hidden) count++;
    });
    root.querySelector<HTMLElement>('[data-article-count]')!.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;
    root.querySelector<HTMLElement>('[data-empty]')!.hidden = count > 0;
    root.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-writing-view]').forEach(button => button.addEventListener('click', () => {
    list.dataset.view = button.dataset.writingView;
    root.querySelectorAll('[data-writing-view]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  }));
}

export async function initializeReader() {
  const root = document.querySelector<HTMLElement>('[data-reader]'); if(!root) return;
  const title = root.querySelector<HTMLElement>('[data-reader-title]')!;
  try {
    const params = new URLSearchParams(location.search);
    if (!isLocalPreview()) { title.textContent = '本機預覽僅在 localhost 開放'; return; }
    const response = await fetch(withBase('__articles'));
    if (!response.ok) throw new Error('無法讀取專案文章');
    const data = await response.json(); validateArticles(data.rows);
    const article = data.rows.find((row: Article) => row.id === params.get('id'));
    if (!article || (article.status === 'draft' && params.get('preview') !== '1')) { title.textContent = '找不到文章'; return; }
    root.querySelector<HTMLElement>('[data-local-note]')!.hidden = !isLocalPreview();
    title.textContent = article.title;
    document.title = `${article.title} | AllenLin`;
    root.querySelector<HTMLElement>('[data-reader-meta]')!.textContent = `${article.date} / ${article.topic} / ${article.status === 'draft' ? '草稿預覽' : article.type === 'research' ? article.stage : 'Journal'}`;
    root.querySelector<HTMLElement>('[data-reader-summary]')!.textContent = article.summary;
    const back = root.querySelector<HTMLAnchorElement>('.reader-back')!;
    back.href = withBase(`${article.type}.html`); back.textContent = `← 返回 ${article.type === 'research' ? 'Research' : 'Journal'}`;
    const context = root.querySelector<HTMLElement>('[data-reader-context]')!;
    if(article.type === 'journal' && article.topic === 'Competitions') {
      for(const [label,value] of [['比賽／活動',article.event],['我的角色',article.role]]) {
        if(value) { context.append(node('dt',label!),node('dd',value)); context.hidden=false; }
      }
    }
    document.querySelectorAll<HTMLAnchorElement>('.navbar a').forEach(item => {
      const active = item.href.endsWith(`/${article.type}.html`);
      item.classList.toggle('active',active);
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    });
    renderMarkdown(root.querySelector<HTMLElement>('[data-reader-body]')!,article.body);
    const link = root.querySelector<HTMLAnchorElement>('[data-reader-link]')!;
    if (/^https?:\/\//i.test(article.link)) { link.href=article.link; link.hidden=false; }
  } catch(error) { title.textContent = error instanceof Error ? error.message : '無法載入文章'; }
}
