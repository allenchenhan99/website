import type { Plugin } from 'vite';
import { loadArticleStore, writeArticleStore } from '../src/lib/article-store';
import { validateArticles } from '../src/lib/articles';
export function articleDevApi(): Plugin {
  return {
    name: 'local-article-editor',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!['/website/__articles','/__articles'].includes(req.url?.split('?')[0] ?? '')) return next();
        const reply = (status: number, data: unknown) => {
          res.statusCode = status; res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(data));
        };
        const host = req.headers.host ?? '';
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403,{error:'Local editor only.'});
        try {
          if (req.method === 'GET') return reply(200,await loadArticleStore());
          if (req.method !== 'PUT') return reply(405,{error:'Method not allowed.'});
          if (req.headers['content-type'] !== 'application/json') return reply(415,{error:'JSON required.'});
          const chunks: Buffer[] = []; let length = 0;
          for await (const chunk of req) { const bytes = Buffer.from(chunk); length += bytes.length; if (length > 5_000_000) return reply(413,{error:'文章資料超過 5 MB。'}); chunks.push(bytes); }
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          validateArticles(data.rows);
          return reply(200,await writeArticleStore(data.rows,data.revision));
        } catch (error) {
          const message = error instanceof Error ? error.message : '無法儲存文章';
          return reply(message === 'CONFLICT' ? 409 : 400,{error:message === 'CONFLICT' ? '文章已被另一個視窗或檔案修改，請先保留內文並重新載入。' : message});
        }
      });
    },
  };
}
