export const SITE = {
  name: 'AllenLin',
  siteUrl: 'https://allenchenhan99.github.io',
  base: '/website/',
  faviconSvg: 'assets/brand/allenlin-icon.svg',
  faviconPng: 'assets/brand/favicon-32.png',
  appleTouchIcon: 'assets/brand/apple-touch-icon.png',
} as const;

export const withBase = (path: string) => `${SITE.base}${path.replace(/^\//, '')}`;
