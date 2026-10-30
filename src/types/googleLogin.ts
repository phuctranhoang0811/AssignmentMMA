export type GoogleBrowserSession = { pairingCode: string; browserUrl: string; expiresAt: number };
export type GoogleLoginOptions = {
  signal?: AbortSignal;
  onBrowserSession?: (session: GoogleBrowserSession | null) => void;
};
