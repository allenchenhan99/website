/// <reference types="astro/client" />

declare module "*.JPG" {
  const metadata: ImageMetadata;
  export default metadata;
}

interface ImportMetaEnv {
  readonly PUBLIC_REACH_STATS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
