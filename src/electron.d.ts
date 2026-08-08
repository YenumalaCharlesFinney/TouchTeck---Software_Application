/* What preload.ts exposes on the renderer. Absent when the app is opened in a
   plain browser during development, so every call site must guard. */
export {};

declare global {
  interface Window {
    touchteckApp?: {
      versions: Record<string, string>;
      /** Tab this window was opened on, when opened as a secondary window. */
      initialTab: string | null;
      openTabWindow: (tabId: string) => Promise<boolean>;
      sendSync: (message: unknown) => void;
      onSync: (callback: (message: any) => void) => () => void;
    };
  }
}
