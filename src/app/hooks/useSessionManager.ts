import { useState, useCallback, useEffect } from 'react';
import type { SessionConfig } from '../types/session';

const STORAGE_KEY = 'compeek-sessions';
const ACTIVE_KEY = 'compeek-active-session';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultSessions(): SessionConfig[] {
  return [];
}

function loadSessions(): SessionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return defaultSessions();
}

function loadActiveId(sessions: SessionConfig[]): string {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && sessions.find(s => s.id === id)) return id;
  } catch {}
  return sessions[0]?.id ?? '';
}

export interface SessionManager {
  sessions: SessionConfig[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  addSession: (config: Omit<SessionConfig, 'id'>) => void;
  removeSession: (id: string) => void;
}

export function useSessionManager(): SessionManager {
  const [sessions, setSessions] = useState<SessionConfig[]>(loadSessions);
  const [activeSessionId, setActiveSessionIdRaw] = useState<string>(() => loadActiveId(sessions));

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Persist active session
  const setActiveSessionId = useCallback((id: string) => {
    setActiveSessionIdRaw(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const addSession = useCallback((config: Omit<SessionConfig, 'id'>) => {
    const newSession: SessionConfig = { ...config, id: generateId() };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  }, [setActiveSessionId]);

  const removeSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionIdRaw(prev => {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.find(s => s.id === prev)) return prev;
      const newId = remaining[0]?.id ?? '';
      localStorage.setItem(ACTIVE_KEY, newId);
      return newId;
    });
  }, [sessions]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    addSession,
    removeSession,
  };
}
