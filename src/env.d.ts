/// <reference types="astro/client" />

declare module "*.JPG" {
  const metadata: ImageMetadata;
  export default metadata;
}
