import { defineConfig } from 'astro/config';
import { articleDevApi } from './scripts/article-dev-api.ts';

export default defineConfig({
  site: 'https://allenchenhan99.github.io',
  base: '/website',
  output: 'static',
  vite: { plugins: [articleDevApi()] },
  build: { format: 'file' },
});
