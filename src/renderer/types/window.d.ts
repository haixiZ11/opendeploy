import type { IpcApi } from '@shared/types';

declare global {
  interface Window {
    opendeploy: IpcApi;
  }

  /** Injected by Vite `define` from package.json at build time. */
  const __APP_VERSION__: string;
}

export {};
