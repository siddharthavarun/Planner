import type { Block, Goal, Priority, Status } from './types';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const nowIso = () => new Date().toISOString();

export function formatDate(value: string | null | undefined, withYear = true): string {
  if (!value) return '';
  // Plain YYYY-MM-DD dates are calendar days; parse them as local time so they don't shift.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00').getTime();
  const today = new Date(todayStr() + 'T00:00:00').getTime();
  return Math.round((target - today) / 86_400_000);
}

export function isOverdue(goal: Goal): boolean {
  return (
    !!goal.targetDate &&
    goal.status !== 'Completed' &&
    goal.status !== 'Cancelled' &&
    daysUntil(goal.targetDate) < 0
  );
}

export function checklistProgress(blocks: Block[]): { done: number; total: number } {
  const todos = blocks.filter((b) => b.type === 'todo');
  return { done: todos.filter((b) => b.checked).length, total: todos.length };
}

export function goalProgress(goal: Goal): number {
  if (goal.progressMode === 'auto') {
    const { done, total } = checklistProgress(goal.blocks);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }
  return goal.progress;
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: 'gray',
  Medium: 'yellow',
  High: 'orange',
  Critical: 'red',
};

export const PRIORITY_RANK: Record<Priority, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export const STATUS_COLORS: Record<Status, string> = {
  'Not started': 'gray',
  'In progress': 'blue',
  'On hold': 'yellow',
  Completed: 'green',
  Cancelled: 'red',
};

export const COVER_COLORS = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  '#e03e3e',
  '#d9730d',
  '#dfab01',
  '#0f7b6c',
  '#0b6e99',
  '#6940a5',
  '#ad1a72',
  '#37352f',
];

/**
 * Reads an image file and downsizes it so covers and inline images stay small
 * enough to keep in the browser database.
 */
export async function imageFileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  // Animated GIFs and SVGs would lose their nature on a canvas; keep them as-is.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return raw;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not read image'));
    el.src = raw;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && raw.length < 600_000) return raw;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export const EMOJIS = [
  '🎯', '🚀', '⭐', '🔥', '💡', '📈', '🏆', '✅', '📚', '✍️', '🎓', '🧠',
  '💪', '🏃', '🧘', '🥗', '🚴', '🏊', '⚽', '🎾', '😴', '💧', '❤️', '🌱',
  '💰', '💼', '🏦', '📊', '🏠', '🚗', '✈️', '🌍', '🗺️', '🏖️', '⛰️', '🏕️',
  '🎨', '🎸', '🎹', '📷', '🎬', '🎮', '🧩', '🪴', '🐶', '👨‍👩‍👧', '🤝', '🎁',
  '💻', '⚙️', '🔧', '🧪', '🔬', '📝', '📅', '⏰', '🗂️', '📌', '🧭', '🌟',
  '🌞', '🌙', '❄️', '🍀', '🍎', '☕', '🎉', '🙏', '😊', '💎', '🛠️', '📖',
];
