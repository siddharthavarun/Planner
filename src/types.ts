export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type Status = 'Not started' | 'In progress' | 'On hold' | 'Completed' | 'Cancelled';

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES: Status[] = ['Not started', 'In progress', 'On hold', 'Completed', 'Cancelled'];

export type Cover =
  | { kind: 'image'; src: string; posY: number }
  | { kind: 'color'; value: string };

export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'table'
  | 'image'
  | 'gallery';

export type ColumnType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'checkbox';
export type CalcKind = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface ColumnSpec {
  type: ColumnType;
  /** ISO currency code for currency columns, e.g. "EUR". */
  currency?: string;
  /** Summary shown under the column. */
  calc?: CalcKind;
}

export interface TableData {
  rows: string[][];
  header: boolean;
  /** Per-column settings; missing entries are plain text. */
  columns?: ColumnSpec[];
}

/** Cards in the first version of the gallery block; converted to sub-goals on load. */
export interface LegacyGalleryItem {
  id: string;
  title: string;
  note: string;
  cover: Cover | null;
}

export interface GalleryData {
  size: 'small' | 'medium';
  /** Sub-goals shown as cards, in order. */
  goalIds: string[];
  items?: LegacyGalleryItem[];
}

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  indent?: number;
  checked?: boolean;
  /** toggle: whether the body is expanded; body holds the hidden content */
  open?: boolean;
  body?: string;
  /** callout emoji */
  emoji?: string;
  table?: TableData;
  image?: { src: string; caption: string };
  gallery?: GalleryData;
}

export interface Goal {
  id: string;
  pageId: string;
  title: string;
  icon: string | null;
  cover: Cover | null;
  createdAt: string;
  updatedAt: string;
  targetDate: string | null;
  priority: Priority | null;
  status: Status;
  progress: number;
  /** 'auto' derives progress from the checklist (to-do blocks) in the body */
  progressMode: 'manual' | 'auto';
  blocks: Block[];
  /** Set for a sub-goal: the goal whose gallery shows it. */
  parentId?: string;
  /** Set when the goal is in the bin. */
  deletedAt?: string;
}

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  description: string;
  createdAt: string;
  /** manual ordering of goals in the gallery */
  goalOrder: string[];
  expanded: boolean;
  /** Set when the page (with its goals) is in the bin. */
  deletedAt?: string;
}

export type SortKey = 'manual' | 'created' | 'target' | 'priority' | 'progress' | 'title';

export interface AppState {
  version: 1;
  pages: Page[];
  goals: Record<string, Goal>;
  prefs: {
    sidebarOpen: boolean;
    theme: 'system' | 'light' | 'dark';
    sort: SortKey;
    statusFilter: Status | 'All';
    cardSize: 'small' | 'medium' | 'large';
    groupBy: 'none' | 'status' | 'priority';
  };
}
