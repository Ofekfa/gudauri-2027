/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the assistant Worker (see worker/README.md). Not a secret. */
  readonly VITE_ASSISTANT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
