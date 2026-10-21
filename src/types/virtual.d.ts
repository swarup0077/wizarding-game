// Modules provided at build time by Vite plugins.

/** The hand worker's URL (vite/handWorkerPlugin.ts): content-hashed in production builds. */
declare module 'virtual:hand-worker' {
  export const HAND_WORKER_URL: string;
}
