import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

let current: Toast | null = null;
let timer: number | undefined;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, action?: Toast['action']) {
  current = { id: nextId++, message, action };
  window.clearTimeout(timer);
  timer = window.setTimeout(dismissToast, action ? 6000 : 2500);
  emit();
}

export function dismissToast() {
  window.clearTimeout(timer);
  current = null;
  emit();
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
