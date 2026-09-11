import MarkdownIt from 'markdown-it';
const markdown = new MarkdownIt({ html: false, linkify: true });
export const articleHtml = (body: string) => markdown.render(body);
export function renderMarkdown(target: HTMLElement, body: string) {
  target.innerHTML = articleHtml(body);
}
