import { useRef, useState } from 'react';
import {
  ancestors,
  childIds,
  deleteGoal,
  duplicateGoal,
  livePages,
  moveGoalToPage,
  restoreGoal,
  updateGoal,
  useAppState,
} from '../store';
import { showToast } from '../toast';
import { navigate } from '../route';
import type { Goal } from '../types';
import { checklistProgress, daysUntil, formatDate, formatDateTime, goalProgress, isOverdue } from '../utils';
import { AutoTextarea } from './AutoTextarea';
import { BlockEditor } from './BlockEditor';
import {
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  CopyIcon,
  DotsIcon,
  FlagIcon,
  ImageIcon,
  MoveIcon,
  PlusIcon,
  ProgressIcon,
  SmileIcon,
  StatusIcon,
  TrashIcon,
} from './Icons';
import { Menu, Popover, usePopover } from './Popover';
import {
  CoverPicker,
  EmojiPicker,
  PriorityPicker,
  PriorityPill,
  StatusPicker,
  StatusPill,
  coverStyle,
} from './Pickers';

export function GoalView({ goal }: { goal: Goal }) {
  const state = useAppState();
  const page = state.pages.find((p) => p.id === goal.pageId);
  const coverPop = usePopover();
  const emojiPop = usePopover();
  const menu = usePopover();
  const movePop = usePopover();
  const statusPop = usePopover();
  const priorityPop = usePopover();
  const [repositioning, setRepositioning] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const editorFocusFirst = useRef<() => void>(() => {});
  const editorAddTodo = useRef<() => void>(() => {});

  const set = (patch: Partial<Goal>) => updateGoal(goal.id, patch);
  const progress = goalProgress(goal);
  const checklist = checklistProgress(goal.blocks);
  const overdue = isOverdue(goal);

  const startReposition = (e: React.MouseEvent) => {
    if (!repositioning || goal.cover?.kind !== 'image') return;
    e.preventDefault();
    const startY = e.clientY;
    const startPos = goal.cover.posY;
    const height = coverRef.current?.offsetHeight ?? 200;
    const onMove = (ev: MouseEvent) => {
      const posY = Math.max(0, Math.min(100, startPos - ((ev.clientY - startY) / height) * 100));
      updateGoal(goal.id, (g) => (g.cover?.kind === 'image' ? { cover: { ...g.cover, posY } } : {}));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const parents = ancestors(state, goal);
  const parent = parents[parents.length - 1];

  // Removing a gallery block sends its sub-goals to the bin; Undo puts the block and its cards back.
  const changeBlocks = (blocks: Goal['blocks']) => {
    const before = goal.blocks;
    const kept = new Set(childIds({ ...goal, blocks }));
    const dropped = childIds(goal).filter((id) => !kept.has(id) && !state.goals[id]?.deletedAt);
    updateGoal(goal.id, { blocks });
    if (dropped.length === 0) return;
    dropped.forEach(deleteGoal);
    showToast(`Moved ${dropped.length} card${dropped.length === 1 ? '' : 's'} to the bin`, {
      label: 'Undo',
      run: () => {
        updateGoal(goal.id, { blocks: before });
        dropped.forEach((id) => restoreGoal(id));
      },
    });
  };

  const remove = () => {
    deleteGoal(goal.id);
    navigate(parent ? { view: 'goal', id: parent.id } : page ? { view: 'page', id: page.id } : { view: 'home' }, true);
    showToast(`Moved “${goal.title || 'Untitled'}” to the bin`, {
      label: 'Undo',
      run: () => {
        restoreGoal(goal.id);
        navigate({ view: 'goal', id: goal.id });
      },
    });
  };

  return (
    <div className="goal-view">
      <div className="topbar">
        <nav className="breadcrumb">
          {page && (
            <>
              <button className="crumb" onClick={() => navigate({ view: 'page', id: page.id })}>
                <span>{page.icon || '📄'}</span> {page.title || 'Untitled'}
              </button>
              <span className="crumb-sep">/</span>
            </>
          )}
          {parents.map((p) => (
            <span key={p.id} className="crumb-group">
              <button className="crumb" onClick={() => navigate({ view: 'goal', id: p.id })}>
                {p.icon && <span>{p.icon}</span>} {p.title || 'Untitled'}
              </button>
              <span className="crumb-sep">/</span>
            </span>
          ))}
          <span className="crumb current">
            {goal.icon && <span>{goal.icon}</span>} {goal.title || 'Untitled'}
          </span>
        </nav>
        <span className="spacer" />
        <span className="muted small edited">Edited {formatDateTime(goal.updatedAt)}</span>
        <button className="icon-btn" title="More" onClick={(e) => menu.toggle(e.currentTarget)}>
          <DotsIcon />
        </button>
      </div>

      {goal.cover && (
        <div
          ref={coverRef}
          className={`goal-cover ${repositioning ? 'repositioning' : ''}`}
          style={coverStyle(goal.cover)}
          onMouseDown={startReposition}
        >
          <div className="cover-actions">
            {repositioning ? (
              <button className="btn" onClick={() => setRepositioning(false)}>
                Save position
              </button>
            ) : (
              <>
                <button className="btn" onClick={(e) => coverPop.toggle(e.currentTarget)}>
                  Change cover
                </button>
                {goal.cover.kind === 'image' && (
                  <button className="btn" onClick={() => setRepositioning(true)}>
                    Reposition
                  </button>
                )}
              </>
            )}
          </div>
          {repositioning && <div className="reposition-hint">Drag image to reposition</div>}
        </div>
      )}

      <div className={`goal-content ${goal.cover ? 'has-cover' : ''}`}>
        {goal.icon && (
          <button className="goal-icon" onClick={(e) => emojiPop.toggle(e.currentTarget)}>
            {goal.icon}
          </button>
        )}
        <div className="goal-add-row">
          {!goal.icon && (
            <button className="ghost-btn" onClick={(e) => emojiPop.toggle(e.currentTarget)}>
              <SmileIcon /> Add icon
            </button>
          )}
          {!goal.cover && (
            <button className="ghost-btn" onClick={(e) => coverPop.toggle(e.currentTarget)}>
              <ImageIcon /> Add cover
            </button>
          )}
        </div>

        <AutoTextarea
          ref={titleRef}
          className="goal-title"
          placeholder="Untitled goal"
          value={goal.title}
          autoFocus={!goal.title}
          onChange={(e) => set({ title: e.target.value.replace(/\n/g, '') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && e.currentTarget.selectionEnd === goal.title.length)) {
              e.preventDefault();
              editorFocusFirst.current();
            }
          }}
        />

        <div className="props">
          <div className="prop">
            <span className="prop-name">
              <ClockIcon /> Created
            </span>
            <span className="prop-value static">{formatDateTime(goal.createdAt)}</span>
          </div>

          <div className="prop">
            <span className="prop-name">
              <CalendarIcon /> Target
            </span>
            <span className="prop-value date-prop">
              {/* A visible label with the native date input laid over it, so tapping anywhere
                  opens the system picker (an empty iOS date input has nothing to tap). */}
              <label className={`date-field ${overdue ? 'overdue' : ''} ${goal.targetDate ? '' : 'empty'}`}>
                <CalendarIcon />
                <span>{goal.targetDate ? formatDate(goal.targetDate) : 'Add a date'}</span>
                <input
                  type="date"
                  aria-label="Target date"
                  value={goal.targetDate ?? ''}
                  onChange={(e) => set({ targetDate: e.target.value || null })}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker();
                    } catch {
                      // Older browsers open the picker on their own.
                    }
                  }}
                />
              </label>
              {goal.targetDate && (
                <>
                  {goal.status !== 'Completed' && goal.status !== 'Cancelled' && (
                    <span className={`days-left ${overdue ? 'overdue' : ''}`}>
                      {(() => {
                        const d = daysUntil(goal.targetDate);
                        if (d < 0) return `${-d}d overdue`;
                        if (d === 0) return 'Due today';
                        return `${d}d left`;
                      })()}
                    </span>
                  )}
                  <button className="icon-btn small" title="Clear" onClick={() => set({ targetDate: null })}>
                    <CloseIcon />
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="prop">
            <span className="prop-name">
              <FlagIcon /> Priority
            </span>
            <button className="prop-value clickable" onClick={(e) => priorityPop.toggle(e.currentTarget)}>
              {goal.priority ? <PriorityPill value={goal.priority} /> : <span className="muted">Empty</span>}
            </button>
          </div>

          <div className="prop">
            <span className="prop-name">
              <StatusIcon /> Status
            </span>
            <button className="prop-value clickable" onClick={(e) => statusPop.toggle(e.currentTarget)}>
              <StatusPill value={goal.status} />
            </button>
          </div>

          <div className="prop prop-top">
            <span className="prop-name">
              <ProgressIcon /> Progress
            </span>
            <div className="prop-value progress-prop">
              <div className="progress-line">
                <div className="progress-track">
                  <div
                    className={`progress-fill ${progress === 100 ? 'done' : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-pct">{progress}%</span>
              </div>
              <div className="progress-controls">
                <select
                  className="mode-select"
                  value={goal.progressMode}
                  onChange={(e) =>
                    set({
                      progressMode: e.target.value as Goal['progressMode'],
                      // Carry the computed value over so switching to manual doesn't jump.
                      progress: e.target.value === 'manual' ? progress : goal.progress,
                    })
                  }
                  aria-label="How progress is measured"
                >
                  <option value="manual">Set it myself</option>
                  <option value="auto">Count ticked to-dos</option>
                </select>
                {goal.progressMode === 'manual' ? (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={goal.progress}
                    onChange={(e) => set({ progress: Number(e.target.value) })}
                    aria-label="Progress"
                  />
                ) : (
                  <button className="ghost-btn add-todo" onClick={() => editorAddTodo.current()}>
                    <PlusIcon /> Add a to-do
                  </button>
                )}
              </div>
              {goal.progressMode === 'auto' && (
                <p className="progress-hint">
                  {checklist.total === 0
                    ? 'No to-dos yet. Add to-do items to the notes below; ticking them fills the bar.'
                    : `${checklist.done} of ${checklist.total} to-dos ticked in the notes below.`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        <BlockEditor
          goalId={goal.id}
          blocks={goal.blocks}
          onChange={changeBlocks}
          focusFirstRef={editorFocusFirst}
          addTodoRef={editorAddTodo}
          onExitTop={() => titleRef.current?.focus()}
        />
      </div>

      {coverPop.anchor && (
        <Popover anchor={coverPop.anchor} onClose={coverPop.close}>
          <CoverPicker
            onPick={(cover) => {
              set({ cover });
              coverPop.close();
            }}
            onRemove={
              goal.cover
                ? () => {
                    set({ cover: null });
                    coverPop.close();
                  }
                : undefined
            }
          />
        </Popover>
      )}
      {emojiPop.anchor && (
        <Popover anchor={emojiPop.anchor} onClose={emojiPop.close}>
          <EmojiPicker
            onPick={(icon) => {
              set({ icon });
              emojiPop.close();
            }}
            onRemove={
              goal.icon
                ? () => {
                    set({ icon: null });
                    emojiPop.close();
                  }
                : undefined
            }
          />
        </Popover>
      )}
      {statusPop.anchor && (
        <Popover anchor={statusPop.anchor} onClose={statusPop.close}>
          <StatusPicker
            value={goal.status}
            onPick={(status) => {
              set(status === 'Completed' && goal.progressMode === 'manual' ? { status, progress: 100 } : { status });
              statusPop.close();
            }}
          />
        </Popover>
      )}
      {priorityPop.anchor && (
        <Popover anchor={priorityPop.anchor} onClose={priorityPop.close}>
          <PriorityPicker
            value={goal.priority}
            onPick={(priority) => {
              set({ priority });
              priorityPop.close();
            }}
          />
        </Popover>
      )}
      {menu.anchor && (
        <Popover anchor={menu.anchor} onClose={menu.close} align="end">
          <Menu
            onClose={menu.close}
            items={[
              {
                label: 'Duplicate',
                icon: <CopyIcon />,
                onClick: () => {
                  const id = duplicateGoal(goal.id);
                  if (id) navigate({ view: 'goal', id });
                },
              },
              {
                label: 'Move to…',
                icon: <MoveIcon />,
                onClick: () => movePop.open(menu.anchor!),
              },
              'sep',
              { label: 'Move to bin', icon: <TrashIcon />, danger: true, onClick: remove },
            ]}
          />
        </Popover>
      )}
      {movePop.anchor && (
        <Popover anchor={movePop.anchor} onClose={movePop.close} align="end">
          <div className="option-list">
            <div className="menu-heading">Move to page</div>
            {livePages(state).map((p) => (
              <button
                key={p.id}
                className={`option ${p.id === goal.pageId ? 'selected' : ''}`}
                onClick={() => {
                  moveGoalToPage(goal.id, p.id);
                  movePop.close();
                }}
              >
                <span>{p.icon || '📄'}</span> {p.title || 'Untitled'}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
