/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPLOY_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
