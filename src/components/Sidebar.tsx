import { useRef, useState } from 'react';
import {
  addGoal,
  addPage,
  deletePage,
  livePages,
  mergeJson,
  restorePage,
  exportJson,
  importJson,
  movePage,
  pageGoals,
  setPrefs,
  updatePage,
  useAppState,
  useSaveError,
} from '../store';
import { navigate, useRoute } from '../route';
import type { Page } from '../types';
import { goalProgress } from '../utils';
import {
  ChevronIcon,
  DotsIcon,
  DownloadIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';
import { Menu, Popover, usePopover } from './Popover';
import { EmojiPicker } from './Pickers';
import { binItems } from './BinView';
import { showToast } from '../toast';

export function Sidebar() {
  const state = useAppState();
  const saveError = useSaveError();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);

  const route = useRoute();
  const pages = livePages(state);
  const binCount = binItems(state).length;
  const q = query.trim().toLowerCase();
  const resolvedTheme =
    state.prefs.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : state.prefs.theme;

  const createPage = () => {
    const id = addPage('');
    setRenaming(id);
    navigate({ view: 'page', id });
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `goal-planner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File | undefined, mode: 'merge' | 'replace') => {
    if (!file) return;
    if (mode === 'replace' && !confirm('Restoring a backup replaces everything currently in the planner. Continue?')) return;
    try {
      const text = await file.text();
      if (mode === 'replace') {
        importJson(text);
        navigate({ view: 'home' });
        return;
      }
      const { goals, firstGoalId } = mergeJson(text);
      showToast(`Added ${goals} goal${goals === 1 ? '' : 's'} from ${file.name}`);
      if (firstGoalId) navigate({ view: 'goal', id: firstGoalId });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="workspace">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="46" cy="54" r="32" fill="var(--accent)" />
            <circle cx="46" cy="54" r="22" fill="var(--sidebar)" />
            <circle cx="46" cy="54" r="12" fill="var(--accent)" />
            <line x1="46" y1="54" x2="80" y2="20" stroke="var(--fg)" strokeWidth="6" strokeLinecap="round" />
            <path
              d="M80 20 L78 8 M80 20 L92 22 M73 27 L71 15 M73 27 L85 29"
              stroke="var(--c2)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
          Goal Planner
        </span>
        <button
          className="icon-btn"
          title="Close sidebar"
          onClick={() => setPrefs({ sidebarOpen: false })}
        >
          <SidebarIcon />
        </button>
      </div>

      <label className="sidebar-search">
        <SearchIcon />
        <input
          placeholder="Search goals"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="sidebar-section">
        <span>Pages</span>
        <button className="icon-btn small" title="Add a page" onClick={createPage}>
          <PlusIcon />
        </button>
      </div>

      <nav
        className="sidebar-tree"
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          if (e.target === e.currentTarget) setDropBefore(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && dropBefore !== undefined) movePage(dragId, dropBefore);
          setDragId(null);
          setDropBefore(undefined);
        }}
      >
        {pages.map((page) => {
          const goals = pageGoals(state, page.id).filter(
            (g) => !q || (g.title || 'Untitled').toLowerCase().includes(q),
          );
          if (q && goals.length === 0 && !page.title.toLowerCase().includes(q)) return null;
          return (
            <PageItem
              key={page.id}
              page={page}
              goals={goals}
              forceOpen={!!q}
              renaming={renaming === page.id}
              onRenamed={() => setRenaming(null)}
              onStartRename={() => setRenaming(page.id)}
              dragging={dragId === page.id}
              dropIndicator={dropBefore === page.id}
              onDragStart={() => setDragId(page.id)}
              onDragEnd={() => {
                setDragId(null);
                setDropBefore(undefined);
              }}
              onDragOverItem={(before) => {
                if (!dragId) return;
                const idx = pages.findIndex((p) => p.id === page.id);
                setDropBefore(before ? page.id : (pages[idx + 1]?.id ?? null));
              }}
            />
          );
        })}
        {dropBefore === null && <div className="drop-line" />}
        {pages.length === 0 && <p className="sidebar-empty">No pages yet.</p>}
        <button className="sidebar-row add-row" onClick={createPage}>
          <PlusIcon /> Add a page
        </button>
      </nav>

      <div className="sidebar-foot">
        {saveError && <p className="error small">Not saved: {saveError}</p>}
        <button
          className={`sidebar-row ${route.view === 'bin' ? 'active' : ''}`}
          onClick={() => navigate({ view: 'bin' })}
        >
          <TrashIcon /> Bin
          {binCount > 0 && <span className="bin-count">{binCount}</span>}
        </button>
        <button
          className="sidebar-row"
          onClick={() => setPrefs({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
        >
          {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button className="sidebar-row" onClick={download}>
          <DownloadIcon /> Export backup
        </button>
        <button className="sidebar-row" onClick={() => mergeInput.current?.click()}>
          <PlusIcon /> Add from file
        </button>
        <button className="sidebar-row" onClick={() => fileInput.current?.click()}>
          <UploadIcon /> Restore backup
        </button>
        <input
          ref={mergeInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], 'merge');
            e.target.value = '';
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], 'replace');
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}

interface PageItemProps {
  page: Page;
  goals: ReturnType<typeof pageGoals>;
  forceOpen: boolean;
  renaming: boolean;
  onRenamed: () => void;
  onStartRename: () => void;
  dragging: boolean;
  dropIndicator: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverItem: (before: boolean) => void;
}

function PageItem(props: PageItemProps) {
  const { page, goals, forceOpen, renaming } = props;
  const route = useRoute();
  const menu = usePopover();
  const emoji = usePopover();
  const open = forceOpen || page.expanded;
  const active = route.view === 'page' && route.id === page.id;

  const remove = () => {
    deletePage(page.id);
    if (active || (route.view === 'goal' && goals.some((g) => g.id === route.id))) {
      navigate({ view: 'home' });
    }
    showToast(`Moved “${page.title || 'Untitled'}” to the bin`, {
      label: 'Undo',
      run: () => restorePage(page.id),
    });
  };

  return (
    <div className={`tree-item ${props.dragging ? 'dragging' : ''}`}>
      {props.dropIndicator && <div className="drop-line" />}
      <div
        className={`sidebar-row page-row ${active ? 'active' : ''}`}
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', page.id);
          props.onDragStart();
        }}
        onDragEnd={props.onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          props.onDragOverItem(e.clientY < r.top + r.height / 2);
        }}
        onClick={() => navigate({ view: 'page', id: page.id })}
      >
        <button
          className={`twisty ${open ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            updatePage(page.id, { expanded: !page.expanded });
          }}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <ChevronIcon width={12} height={12} />
        </button>
        <button
          className="row-emoji"
          onClick={(e) => {
            e.stopPropagation();
            emoji.toggle(e.currentTarget);
          }}
        >
          {page.icon || '📄'}
        </button>
        {renaming ? (
          <input
            className="rename-input"
            autoFocus
            defaultValue={page.title}
            placeholder="Untitled"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              updatePage(page.id, { title: e.target.value.trim() });
              props.onRenamed();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                e.currentTarget.value = page.title;
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span className="row-label" onDoubleClick={props.onStartRename}>
            {page.title || 'Untitled'}
          </span>
        )}
        <span className="row-actions">
          <button
            className="icon-btn small"
            title="More"
            onClick={(e) => {
              e.stopPropagation();
              menu.toggle(e.currentTarget);
            }}
          >
            <DotsIcon />
          </button>
          <button
            className="icon-btn small"
            title="Add a goal"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ view: 'goal', id: addGoal(page.id) });
            }}
          >
            <PlusIcon />
          </button>
        </span>
      </div>

      {open && (
        <div className="tree-children">
          {goals.length === 0 && <div className="sidebar-empty">No goals inside</div>}
          {goals.map((g) => (
            <button
              key={g.id}
              className={`sidebar-row goal-row ${route.view === 'goal' && route.id === g.id ? 'active' : ''}`}
              onClick={() => navigate({ view: 'goal', id: g.id })}
            >
              <span className="row-emoji static">{g.icon || '🎯'}</span>
              <span className="row-label">{g.title || 'Untitled'}</span>
              <span className="row-progress">{goalProgress(g)}%</span>
            </button>
          ))}
        </div>
      )}

      {menu.anchor && (
        <Popover anchor={menu.anchor} onClose={menu.close}>
          <Menu
            onClose={menu.close}
            items={[
              { label: 'Rename', onClick: props.onStartRename },
              { label: 'Change icon', onClick: () => emoji.open(menu.anchor!) },
              {
                label: 'Add a goal',
                icon: <PlusIcon />,
                onClick: () => navigate({ view: 'goal', id: addGoal(page.id) }),
              },
              'sep',
              { label: 'Move to bin', icon: <TrashIcon />, danger: true, onClick: remove },
            ]}
          />
        </Popover>
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
