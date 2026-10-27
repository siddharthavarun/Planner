import { useSyncExternalStore } from 'react';

export type Route =
  | { view: 'page'; id: string }
  | { view: 'goal'; id: string }
  | { view: 'bin' }
  | { view: 'home' };

function parse(): Route {
  const [, view, id] = window.location.hash.replace(/^#/, '').split('/');
  if ((view === 'page' || view === 'goal') && id) return { view, id };
  if (view === 'bin') return { view: 'bin' };
  return { view: 'home' };
}

let current = parse();
window.addEventListener('hashchange', () => {
  current = parse();
  listeners.forEach((l) => l());
});
const listeners = new Set<() => void>();

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function navigate(route: Route, replace = false) {
  const hash =
    route.view === 'home' ? '#/' : route.view === 'bin' ? '#/bin' : `#/${route.view}/${route.id}`;
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}
