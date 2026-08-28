import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://allenchenhan99.github.io',
  base: '/website',
  output: 'static',
  build: { format: 'file' },
});
