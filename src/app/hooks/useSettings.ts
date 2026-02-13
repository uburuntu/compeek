import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'compeek-settings';

export interface Settings {
  apiKey: string;
  lastModel: string;
}

const defaults: Settings = {
  apiKey: '',
  lastModel: 'claude-sonnet-4-5',
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  return { settings, update };
}
