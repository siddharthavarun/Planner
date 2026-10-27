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
  | 'image';

export interface TableData {
  rows: string[][];
  header: boolean;
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
  };
}
