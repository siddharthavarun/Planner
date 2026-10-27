import { useSyncExternalStore } from 'react';
import { dbGet, dbSet } from './db';
import type { AppState, Block, BlockType, Goal, Page } from './types';
import { COVER_COLORS, DEFAULT_COVER_COUNT, nowIso, uid } from './utils';

const KEY = 'state';

let state: AppState;
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let saveError: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 300);
}

async function flush() {
  window.clearTimeout(saveTimer);
  try {
    await dbSet(KEY, state);
    if (saveError) {
      saveError = null;
      emit();
    }
  } catch (err) {
    saveError = err instanceof Error ? err.message : String(err);
    emit();
  }
}

window.addEventListener('beforeunload', () => void flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush();
});

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
  scheduleSave();
}

export function getState() {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function useSaveError(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => saveError,
  );
}

export async function loadState(): Promise<void> {
  let saved: AppState | undefined;
  try {
    saved = await dbGet<AppState>(KEY);
  } catch {
    saveError = 'Browser storage is unavailable; changes will not be saved.';
  }
  state = saved && saved.version === 1 ? purgeExpired(withDefaults(saved)) : seedState();
}

export const BIN_DAYS = 30;

/** Permanently removes bin items older than BIN_DAYS. */
function purgeExpired(s: AppState): AppState {
  const cutoff = new Date(Date.now() - BIN_DAYS * 86_400_000).toISOString();
  const old = (d?: string) => !!d && d < cutoff;
  const goneP = new Set(s.pages.filter((p) => old(p.deletedAt)).map((p) => p.id));
  const goals = Object.fromEntries(
    Object.entries(s.goals).filter(([, g]) => !old(g.deletedAt) && !goneP.has(g.pageId)),
  );
  return { ...s, pages: s.pages.filter((p) => !goneP.has(p.id)), goals };
}

function withDefaults(s: AppState): AppState {
  const fresh = seedState();
  return { ...s, prefs: { ...fresh.prefs, ...s.prefs } };
}

// ---------- blocks ----------

export function newBlock(type: BlockType = 'paragraph', text = ''): Block {
  const b: Block = { id: uid(), type, text };
  if (type === 'todo') b.checked = false;
  if (type === 'toggle') {
    b.open = true;
    b.body = '';
  }
  if (type === 'callout') b.emoji = '💡';
  if (type === 'table') b.table = { header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] };
  if (type === 'image') b.image = { src: '', caption: '' };
  if (type === 'gallery') {
    b.gallery = {
      size: 'small',
      items: [0, 1, 2].map((i) => ({
        id: uid(),
        title: '',
        note: '',
        cover: { kind: 'color', value: COVER_COLORS[(i * 3) % DEFAULT_COVER_COUNT] },
      })),
    };
  }
  return b;
}

// ---------- pages ----------

export function addPage(title = ''): string {
  const page: Page = {
    id: uid(),
    title,
    icon: '📁',
    description: '',
    createdAt: nowIso(),
    goalOrder: [],
    expanded: true,
  };
  set((s) => ({ ...s, pages: [...s.pages, page] }));
  return page.id;
}

export function updatePage(id: string, patch: Partial<Page>) {
  set((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function livePages(s: AppState): Page[] {
  return s.pages.filter((p) => !p.deletedAt);
}

/** A goal is visible when neither it nor its page is in the bin. */
export function isLiveGoal(s: AppState, g: Goal | undefined): g is Goal {
  return !!g && !g.deletedAt && !!s.pages.find((p) => p.id === g.pageId && !p.deletedAt);
}

/** Moves a page and its goals to the bin. */
export function deletePage(id: string) {
  updatePage(id, { deletedAt: nowIso() });
}

export function restorePage(id: string) {
  set((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, deletedAt: undefined } : p)) }));
}

/** Deletes a binned page and everything in it for good. */
export function purgePage(id: string) {
  set((s) => {
    const goals = { ...s.goals };
    for (const g of Object.values(goals)) if (g.pageId === id) delete goals[g.id];
    return { ...s, pages: s.pages.filter((p) => p.id !== id), goals };
  });
}

export function movePage(id: string, beforeId: string | null) {
  set((s) => {
    const page = s.pages.find((p) => p.id === id);
    if (!page || id === beforeId) return s;
    const rest = s.pages.filter((p) => p.id !== id);
    const idx = beforeId ? rest.findIndex((p) => p.id === beforeId) : rest.length;
    rest.splice(idx < 0 ? rest.length : idx, 0, page);
    return { ...s, pages: rest };
  });
}

// ---------- goals ----------

export function pageGoals(s: AppState, pageId: string): Goal[] {
  const page = s.pages.find((p) => p.id === pageId);
  if (!page) return [];
  const inPage = Object.values(s.goals).filter((g) => g.pageId === pageId && !g.deletedAt);
  const order = new Map(page.goalOrder.map((id, i) => [id, i]));
  return inPage.sort(
    (a, b) =>
      (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function addGoal(pageId: string, partial: Partial<Goal> = {}): string {
  const now = nowIso();
  const goal: Goal = {
    id: uid(),
    pageId,
    title: '',
    icon: null,
    cover: { kind: 'color', value: COVER_COLORS[Math.floor(Math.random() * DEFAULT_COVER_COUNT)] },
    createdAt: now,
    updatedAt: now,
    targetDate: null,
    priority: null,
    status: 'Not started',
    progress: 0,
    progressMode: 'manual',
    blocks: [newBlock()],
    ...partial,
  };
  set((s) => ({
    ...s,
    goals: { ...s.goals, [goal.id]: goal },
    pages: s.pages.map((p) =>
      p.id === pageId ? { ...p, goalOrder: [...p.goalOrder, goal.id], expanded: true } : p,
    ),
  }));
  return goal.id;
}

export function updateGoal(id: string, patch: Partial<Goal> | ((g: Goal) => Partial<Goal>)) {
  set((s) => {
    const g = s.goals[id];
    if (!g) return s;
    const p = typeof patch === 'function' ? patch(g) : patch;
    return { ...s, goals: { ...s.goals, [id]: { ...g, ...p, updatedAt: nowIso() } } };
  });
}

/** Moves a goal to the bin. It keeps its place in the page order for when it's restored. */
export function deleteGoal(id: string) {
  set((s) => {
    const g = s.goals[id];
    if (!g) return s;
    return { ...s, goals: { ...s.goals, [id]: { ...g, deletedAt: nowIso() } } };
  });
}

/**
 * Brings a goal back. If its page is also in the bin, the goal goes to the first page
 * that isn't, or its page is restored when there is no other page.
 */
export function restoreGoal(id: string): string | null {
  const g = state.goals[id];
  if (!g) return null;
  const page = state.pages.find((p) => p.id === g.pageId);
  if (!page || page.deletedAt) {
    const target = livePages(state)[0];
    if (target) moveGoalToPage(id, target.id);
    else if (page) restorePage(page.id);
  }
  set((s) => ({ ...s, goals: { ...s.goals, [id]: { ...s.goals[id], deletedAt: undefined } } }));
  return state.goals[id]?.pageId ?? null;
}

/** Deletes a binned goal for good. */
export function purgeGoal(id: string) {
  set((s) => {
    const goals = { ...s.goals };
    delete goals[id];
    return {
      ...s,
      goals,
      pages: s.pages.map((p) => ({ ...p, goalOrder: p.goalOrder.filter((g) => g !== id) })),
    };
  });
}

export function emptyBin() {
  set((s) => {
    const goneP = new Set(s.pages.filter((p) => p.deletedAt).map((p) => p.id));
    const goals = Object.fromEntries(
      Object.entries(s.goals).filter(([, g]) => !g.deletedAt && !goneP.has(g.pageId)),
    );
    return {
      ...s,
      pages: s.pages
        .filter((p) => !goneP.has(p.id))
        .map((p) => ({ ...p, goalOrder: p.goalOrder.filter((id) => id in goals) })),
      goals,
    };
  });
}

export function duplicateGoal(id: string): string | null {
  const g = state.goals[id];
  if (!g) return null;
  const now = nowIso();
  const copy: Goal = {
    ...structuredClone(g),
    id: uid(),
    title: g.title ? `${g.title} (copy)` : '',
    createdAt: now,
    updatedAt: now,
  };
  copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid() }));
  set((s) => ({
    ...s,
    goals: { ...s.goals, [copy.id]: copy },
    pages: s.pages.map((p) => {
      if (p.id !== g.pageId) return p;
      const order = pageGoals(s, p.id).map((x) => x.id);
      order.splice(order.indexOf(id) + 1, 0, copy.id);
      return { ...p, goalOrder: order };
    }),
  }));
  return copy.id;
}

export function moveGoalToPage(id: string, pageId: string) {
  set((s) => {
    const g = s.goals[id];
    if (!g || g.pageId === pageId) return s;
    return {
      ...s,
      goals: { ...s.goals, [id]: { ...g, pageId } },
      pages: s.pages.map((p) => {
        if (p.id === pageId) return { ...p, goalOrder: [...p.goalOrder, id] };
        if (p.id === g.pageId) return { ...p, goalOrder: p.goalOrder.filter((x) => x !== id) };
        return p;
      }),
    };
  });
}

/** Moves goal `id` before `beforeId` (or to the end) within its page's manual order. */
export function reorderGoal(id: string, beforeId: string | null) {
  set((s) => {
    const g = s.goals[id];
    if (!g || id === beforeId) return s;
    const order = pageGoals(s, g.pageId)
      .map((x) => x.id)
      .filter((x) => x !== id);
    const idx = beforeId ? order.indexOf(beforeId) : order.length;
    order.splice(idx < 0 ? order.length : idx, 0, id);
    return {
      ...s,
      pages: s.pages.map((p) => (p.id === g.pageId ? { ...p, goalOrder: order } : p)),
    };
  });
}

export function setPrefs(patch: Partial<AppState['prefs']>) {
  set((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
}

// ---------- import / export ----------

export function exportJson(): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string) {
  const data = JSON.parse(text) as AppState;
  if (data?.version !== 1 || !Array.isArray(data.pages) || typeof data.goals !== 'object') {
    throw new Error('This file is not a Goal Planner export.');
  }
  set(() => withDefaults(data));
}

// ---------- first-run sample content ----------

function seedState(): AppState {
  const year = new Date().getFullYear();
  const inMonths = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  const pageId = uid();
  const now = nowIso();
  const b = (type: BlockType, text = '', extra: Partial<Block> = {}): Block => ({
    ...newBlock(type, text),
    ...extra,
  });

  const goals: Goal[] = [
    {
      id: uid(),
      pageId,
      title: 'Run a half marathon',
      icon: '🏃',
      cover: { kind: 'color', value: COVER_COLORS[2] },
      createdAt: now,
      updatedAt: now,
      targetDate: inMonths(4),
      priority: 'High',
      status: 'In progress',
      progress: 0,
      progressMode: 'auto',
      blocks: [
        b('h2', 'Why'),
        b('paragraph', 'Build endurance and a consistent running habit.'),
        b('h2', 'Milestones'),
        b('todo', 'Run 5K without stopping', { checked: true }),
        b('todo', 'Run 10K', { checked: true }),
        b('todo', 'Run 15K'),
        b('todo', 'Sign up for a race'),
        b('h2', 'Weekly plan'),
        b('table', '', {
          table: {
            header: true,
            rows: [
              ['Day', 'Workout', 'Distance'],
              ['Tuesday', 'Intervals', '6 km'],
              ['Thursday', 'Tempo run', '8 km'],
              ['Sunday', 'Long run', '12–18 km'],
            ],
          },
        }),
      ],
    },
    {
      id: uid(),
      pageId,
      title: 'Read 24 books',
      icon: '📚',
      cover: { kind: 'color', value: COVER_COLORS[6] },
      createdAt: now,
      updatedAt: now,
      targetDate: `${year}-12-31`,
      priority: 'Medium',
      status: 'In progress',
      progress: 40,
      progressMode: 'manual',
      blocks: [
        b('callout', 'Two books a month. Mix fiction and non-fiction.', { emoji: '📖' }),
        b('h3', 'Finished'),
        b('numbered', 'Atomic Habits'),
        b('numbered', 'Project Hail Mary'),
        b('toggle', 'Reading notes', { open: false, body: 'Write a short note after every book.' }),
      ],
    },
    {
      id: uid(),
      pageId,
      title: 'Save an emergency fund',
      icon: '💰',
      cover: { kind: 'color', value: COVER_COLORS[1] },
      createdAt: now,
      updatedAt: now,
      targetDate: inMonths(8),
      priority: 'Critical',
      status: 'Not started',
      progress: 0,
      progressMode: 'manual',
      blocks: [
        b('quote', 'Pay yourself first.'),
        b('bulleted', 'Target: 6 months of expenses'),
        b('bulleted', 'Automatic transfer on payday'),
      ],
    },
  ];

  return {
    version: 1,
    pages: [
      {
        id: pageId,
        title: String(year),
        icon: '🗓️',
        description: `My goals for ${year}.`,
        createdAt: now,
        goalOrder: goals.map((g) => g.id),
        expanded: true,
      },
    ],
    goals: Object.fromEntries(goals.map((g) => [g.id, g])),
    prefs: {
      sidebarOpen: true,
      theme: 'system',
      sort: 'manual',
      statusFilter: 'All',
      cardSize: 'medium',
      groupBy: 'none',
    },
  };
}
