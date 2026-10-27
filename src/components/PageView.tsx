import { useState } from 'react';
import {
  addGoal,
  deleteGoal,
  duplicateGoal,
  pageGoals,
  reorderGoal,
  restoreGoal,
  setPrefs,
  updateGoal,
  updatePage,
  useAppState,
} from '../store';
import { navigate } from '../route';
import { showToast } from '../toast';
import type { Goal, Page, Priority, SortKey, Status } from '../types';
import { PRIORITIES, STATUSES } from '../types';
import { PRIORITY_RANK, daysUntil, formatDate, goalProgress, isOverdue } from '../utils';
import { AutoTextarea } from './AutoTextarea';
import { CopyIcon, DotsIcon, MoveIcon, PlusIcon, TrashIcon } from './Icons';
import { Menu, Popover, usePopover } from './Popover';
import { EmojiPicker, PriorityPill, StatusPill, coverStyle } from './Pickers';

const SORT_LABELS: Record<SortKey, string> = {
  manual: 'Manual',
  created: 'Created date',
  target: 'Target date',
  priority: 'Priority',
  progress: 'Progress',
  title: 'Title',
};

function sortGoals(goals: Goal[], key: SortKey): Goal[] {
  const list = [...goals];
  switch (key) {
    case 'created':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'target':
      return list.sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'));
    case 'priority':
      return list.sort(
        (a, b) =>
          (b.priority ? PRIORITY_RANK[b.priority] : 0) - (a.priority ? PRIORITY_RANK[a.priority] : 0),
      );
    case 'progress':
      return list.sort((a, b) => goalProgress(b) - goalProgress(a));
    case 'title':
      return list.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
    default:
      return list;
  }
}

export function PageView({ page }: { page: Page }) {
  const state = useAppState();
  const { sort, statusFilter, cardSize, groupBy } = state.prefs;
  const emoji = usePopover();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined);

  const all = pageGoals(state, page.id);
  const goals = sortGoals(statusFilter === 'All' ? all : all.filter((g) => g.status === statusFilter), sort);
  const canDrag = sort === 'manual' && statusFilter === 'All' && groupBy === 'none';

  const completed = all.filter((g) => g.status === 'Completed').length;
  const inProgress = all.filter((g) => g.status === 'In progress').length;
  const avg = all.length ? Math.round(all.reduce((n, g) => n + goalProgress(g), 0) / all.length) : 0;

  const create = () => navigate({ view: 'goal', id: addGoal(page.id) });

  return (
    <div className="page-view">
      <header className="page-header">
        <button className="page-icon" onClick={(e) => emoji.toggle(e.currentTarget)} title="Change icon">
          {page.icon || '📄'}
        </button>
        <AutoTextarea
          className="page-title"
          placeholder="Untitled"
          value={page.title}
          onChange={(e) => updatePage(page.id, { title: e.target.value.replace(/\n/g, '') })}
        />
        <AutoTextarea
          className="page-desc"
          placeholder="Add a description…"
          value={page.description}
          onChange={(e) => updatePage(page.id, { description: e.target.value })}
        />
        {all.length > 0 && (
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{all.length}</span>
              <span className="stat-label">Goals</span>
            </div>
            <div className="stat">
              <span className="stat-num">{inProgress}</span>
              <span className="stat-label">In progress</span>
            </div>
            <div className="stat">
              <span className="stat-num">{completed}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat wide">
              <span className="stat-num">{avg}%</span>
              <span className="stat-label">Average progress</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${avg}%` }} />
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="toolbar">
        <span className="toolbar-title">Gallery</span>
        <span className="spacer" />
        <label className="select-wrap">
          <span>Group</span>
          <select
            value={groupBy}
            onChange={(e) => setPrefs({ groupBy: e.target.value as typeof groupBy })}
          >
            <option value="none">None</option>
            <option value="status">By status</option>
            <option value="priority">By priority</option>
          </select>
        </label>
        <label className="select-wrap">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setPrefs({ statusFilter: e.target.value as Status | 'All' })}
          >
            <option value="All">All</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="select-wrap">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setPrefs({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="select-wrap">
          <span>Cards</span>
          <select
            value={cardSize}
            onChange={(e) => setPrefs({ cardSize: e.target.value as typeof cardSize })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <button className="btn primary" onClick={create}>
          <PlusIcon /> New goal
        </button>
      </div>

      {groupBy !== 'none' ? (
        <Board goals={goals} groupBy={groupBy} pageId={page.id} />
      ) : (
      <div
        className={`gallery size-${cardSize}`}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          if (e.target === e.currentTarget) setDropBefore(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && dropBefore !== undefined) reorderGoal(dragId, dropBefore);
          setDragId(null);
          setDropBefore(undefined);
        }}
      >
        {goals.map((g, i) => (
          <GoalCard
            key={g.id}
            goal={g}
            draggable={canDrag}
            dragging={dragId === g.id}
            dropSide={
              dropBefore === g.id ? 'before' : dropBefore === null && i === goals.length - 1 ? 'after' : null
            }
            onDragStart={() => setDragId(g.id)}
            onDragEnd={() => {
              setDragId(null);
              setDropBefore(undefined);
            }}
            onDragOverCard={(before) => {
              if (!dragId) return;
              setDropBefore(before ? g.id : (goals[i + 1]?.id ?? null));
            }}
          />
        ))}
        <button className="card new-card" onClick={create}>
          <PlusIcon width={20} height={20} />
          <span>New goal</span>
        </button>
      </div>
      )}
      {statusFilter !== 'All' && goals.length === 0 && all.length > 0 && (
        <p className="muted center">No goals with status “{statusFilter}”.</p>
      )}

      {emoji.anchor && (
        <Popover anchor={emoji.anchor} onClose={emoji.close}>
          <EmojiPicker
            onPick={(icon) => {
              updatePage(page.id, { icon });
              emoji.close();
            }}
            onRemove={() => {
              updatePage(page.id, { icon: null });
              emoji.close();
            }}
          />
        </Popover>
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  /** Extra menu entries, e.g. "Move to In progress" on the board (phones can't drag). */
  moveOptions?: { label: string; onClick: () => void }[];
  draggable: boolean;
  dragging: boolean;
  dropSide: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: (before: boolean) => void;
}

function GoalCard({ goal, draggable, dragging, dropSide, moveOptions = [], ...drag }: GoalCardProps) {
  const menu = usePopover();
  const progress = goalProgress(goal);
  const overdue = isOverdue(goal);
  const days = goal.targetDate ? daysUntil(goal.targetDate) : null;

  return (
    <div
      className={`card goal-card ${dragging ? 'dragging' : ''} ${dropSide ? `drop-${dropSide}` : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', goal.id);
        drag.onDragStart();
      }}
      onDragEnd={drag.onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        drag.onDragOverCard(e.clientX < r.left + r.width / 2);
      }}
      onClick={() => navigate({ view: 'goal', id: goal.id })}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate({ view: 'goal', id: goal.id });
      }}
    >
      <div className={`card-cover ${goal.cover ? '' : 'empty'}`} style={coverStyle(goal.cover)}>
        <button
          className="icon-btn card-menu-btn"
          title="More"
          onClick={(e) => {
            e.stopPropagation();
            menu.toggle(e.currentTarget);
          }}
        >
          <DotsIcon />
        </button>
      </div>
      <div className="card-body">
        <div className="card-title">
          {goal.icon && <span className="card-icon">{goal.icon}</span>}
          <span className={goal.title ? '' : 'muted'}>{goal.title || 'Untitled'}</span>
        </div>
        <div className="card-pills">
          <StatusPill value={goal.status} />
          <PriorityPill value={goal.priority} />
        </div>
        <dl className="card-props">
          <div>
            <dt>Created</dt>
            <dd>{formatDate(goal.createdAt)}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd className={overdue ? 'overdue' : ''}>
              {goal.targetDate ? formatDate(goal.targetDate) : <span className="muted">—</span>}
              {days !== null && goal.status !== 'Completed' && goal.status !== 'Cancelled' && (
                <span className="days">
                  {overdue ? `${-days}d overdue` : days === 0 ? 'today' : `${days}d left`}
                </span>
              )}
            </dd>
          </div>
        </dl>
        <div className="card-progress">
          <div className="progress-track">
            <div
              className={`progress-fill ${progress === 100 ? 'done' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-num">{progress}%</span>
        </div>
      </div>

      {menu.anchor && (
        <Popover anchor={menu.anchor} onClose={menu.close} align="end">
          <div onClick={(e) => e.stopPropagation()}>
            <Menu
              onClose={menu.close}
              items={[
                { label: 'Open', onClick: () => navigate({ view: 'goal', id: goal.id }) },
                { label: 'Duplicate', icon: <CopyIcon />, onClick: () => duplicateGoal(goal.id) },
                ...(moveOptions.length ? (['sep'] as const) : []),
                ...moveOptions.map((m) => ({ ...m, icon: <MoveIcon /> })),
                'sep',
                {
                  label: 'Move to bin',
                  icon: <TrashIcon />,
                  danger: true,
                  onClick: () => {
                    deleteGoal(goal.id);
                    showToast(`Moved “${goal.title || 'Untitled'}” to the bin`, {
                      label: 'Undo',
                      run: () => restoreGoal(goal.id),
                    });
                  },
                },
              ]}
            />
          </div>
        </Popover>
      )}
    </div>
  );
}

interface Column {
  key: string;
  title: string;
  label: React.ReactNode;
  value: Status | Priority | null;
}

/** Goals laid out side by side in one column per status or priority. Drag a card to another column to change it. */
function Board({ goals, groupBy, pageId }: { goals: Goal[]; groupBy: 'status' | 'priority'; pageId: string }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columns: Column[] =
    groupBy === 'status'
      ? STATUSES.map((s) => ({ key: s, title: s, label: <StatusPill value={s} />, value: s }))
      : [
          ...[...PRIORITIES].reverse().map((p) => ({ key: p, title: p, label: <PriorityPill value={p} />, value: p })),
          { key: 'none', title: 'No priority', label: <span className="pill pill-gray">No priority</span>, value: null },
        ];

  const valueOf = (g: Goal) => (groupBy === 'status' ? g.status : g.priority);
  const moveTo = (g: Goal, col: Column) => {
    if (valueOf(g) === col.value) return;
    if (groupBy === 'status') {
      const status = col.value as Status;
      updateGoal(g.id, status === 'Completed' && g.progressMode === 'manual' ? { status, progress: 100 } : { status });
    } else {
      updateGoal(g.id, { priority: col.value as Priority | null });
    }
  };
  const endDrag = () => {
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="board">
      {columns.map((col) => {
        const list = goals.filter((g) => valueOf(g) === col.value);
        return (
          <section
            key={col.key}
            className={`board-col ${overCol === col.key ? 'over' : ''}`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const g = goals.find((x) => x.id === dragId);
              if (g) moveTo(g, col);
              endDrag();
            }}
          >
            <header className="board-col-head">
              {col.label}
              <span className="board-count">{list.length}</span>
            </header>
            <div className="board-cards size-small">
              {list.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  draggable
                  dragging={dragId === g.id}
                  dropSide={null}
                  onDragStart={() => setDragId(g.id)}
                  onDragEnd={endDrag}
                  onDragOverCard={() => setOverCol(col.key)}
                  moveOptions={columns
                    .filter((c) => c.key !== col.key)
                    .map((c) => ({ label: `Move to ${c.title}`, onClick: () => moveTo(g, c) }))}
                />
              ))}
              {list.length === 0 && <div className="board-empty">{dragId ? 'Drop here' : 'No goals'}</div>}
            </div>
            <button
              className="board-add"
              onClick={() =>
                navigate({
                  view: 'goal',
                  id: addGoal(
                    pageId,
                    groupBy === 'status' ? { status: col.value as Status } : { priority: col.value as Priority | null },
                  ),
                })
              }
            >
              <PlusIcon /> New
            </button>
          </section>
        );
      })}
    </div>
  );
}
