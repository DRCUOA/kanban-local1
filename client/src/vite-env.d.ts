/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_NAME_SUBTITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
