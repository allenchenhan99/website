/// <reference types="astro/client" />

declare module "*.JPG" {
  const metadata: ImageMetadata;
  export default metadata;
}

interface ImportMetaEnv {
  readonly PUBLIC_UMAMI_SCRIPT_URL?: string;
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
  readonly PUBLIC_REACH_STATS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
