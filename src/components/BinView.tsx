import { BIN_DAYS, emptyBin, purgeGoal, purgePage, restoreGoal, restorePage, useAppState } from '../store';
import { navigate } from '../route';
import { showToast } from '../toast';
import type { AppState } from '../types';
import { coverStyle } from './Pickers';
import { TrashIcon } from './Icons';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function daysLeft(iso: string): number {
  return Math.max(0, BIN_DAYS - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

type Item =
  | { kind: 'page'; id: string; deletedAt: string }
  | { kind: 'goal'; id: string; deletedAt: string };

export function binItems(s: AppState): Item[] {
  const items: Item[] = [
    ...s.pages.filter((p) => p.deletedAt).map((p) => ({ kind: 'page' as const, id: p.id, deletedAt: p.deletedAt! })),
    ...Object.values(s.goals)
      .filter((g) => g.deletedAt)
      .map((g) => ({ kind: 'goal' as const, id: g.id, deletedAt: g.deletedAt! })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export function BinView() {
  const state = useAppState();
  const items = binItems(state);

  return (
    <div className="page-view bin-view">
      <header className="page-header">
        <div className="page-icon static">
          <TrashIcon width={56} height={56} strokeWidth={1.2} />
        </div>
        <h1 className="page-title">Bin</h1>
        <p className="page-desc">
          Deleted goals and pages wait here for {BIN_DAYS} days. Restore them, or delete them for good.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="bin-empty">The bin is empty.</p>
      ) : (
        <>
          <div className="toolbar">
            <span className="toolbar-title">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
            <span className="spacer" />
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Delete everything in the bin for good? This cannot be undone.')) {
                  emptyBin();
                  showToast('Bin emptied');
                }
              }}
            >
              Empty bin
            </button>
          </div>
          <ul className="bin-list">
            {items.map((item) => {
              if (item.kind === 'page') {
                const page = state.pages.find((p) => p.id === item.id)!;
                const n = Object.values(state.goals).filter((g) => g.pageId === page.id && !g.deletedAt).length;
                return (
                  <li key={item.id} className="bin-item">
                    <span className="bin-thumb emoji">{page.icon || '📄'}</span>
                    <span className="bin-main">
                      <b>{page.title || 'Untitled'}</b>
                      <span>
                        Page with {n} goal{n === 1 ? '' : 's'} · deleted {timeAgo(item.deletedAt)} ·{' '}
                        {daysLeft(item.deletedAt)} days left
                      </span>
                    </span>
                    <span className="bin-actions">
                      <button
                        className="btn small primary"
                        onClick={() => {
                          restorePage(page.id);
                          showToast(`Restored “${page.title || 'Untitled'}”`, {
                            label: 'Open',
                            run: () => navigate({ view: 'page', id: page.id }),
                          });
                        }}
                      >
                        Restore
                      </button>
                      <button
                        className="btn small danger"
                        onClick={() => {
                          if (confirm(`Delete “${page.title || 'Untitled'}” and its goals for good?`)) purgePage(page.id);
                        }}
                      >
                        Delete forever
                      </button>
                    </span>
                  </li>
                );
              }
              const goal = state.goals[item.id];
              const from = state.pages.find((p) => p.id === goal.pageId);
              const parent = goal.parentId ? state.goals[goal.parentId] : undefined;
              return (
                <li key={item.id} className="bin-item">
                  <span className="bin-thumb" style={coverStyle(goal.cover)}>
                    {goal.icon}
                  </span>
                  <span className="bin-main">
                    <b>{goal.title || 'Untitled'}</b>
                    <span>
                      {parent
                        ? `Card in ${parent.title || 'Untitled'}`
                        : `Goal${from ? ` in ${from.title || 'Untitled'}` : ''}`}{' '}
                      · deleted {timeAgo(item.deletedAt)} ·{' '}
                      {daysLeft(item.deletedAt)} days left
                    </span>
                  </span>
                  <span className="bin-actions">
                    <button
                      className="btn small primary"
                      onClick={() => {
                        restoreGoal(goal.id);
                        showToast(`Restored “${goal.title || 'Untitled'}”`, {
                          label: 'Open',
                          run: () => navigate({ view: 'goal', id: goal.id }),
                        });
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        if (confirm(`Delete “${goal.title || 'Untitled'}” for good?`)) purgeGoal(goal.id);
                      }}
                    >
                      Delete forever
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
