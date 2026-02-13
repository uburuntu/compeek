export interface SessionConfig {
  id: string;
  name: string;
  type: 'compeek' | 'vnc-only';
  apiHost: string;
  apiPort: number;
  vncHost: string;
  vncPort: number;
}

export type SessionStatus = 'connected' | 'disconnected' | 'reconnecting';
