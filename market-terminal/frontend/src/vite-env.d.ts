/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base URL */
  readonly VITE_API_URL: string;
  /** WebSocket connection URL */
  readonly VITE_WS_URL: string;
  /** Application environment (development, production) */
  readonly VITE_APP_ENV: 'development' | 'production' | 'test';
  /** Enable debug logging */
  readonly VITE_DEBUG: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
