import { useEffect } from 'react';
import { addPage, isLiveGoal, livePages, setPrefs, useAppState } from './store';
import { dismissToast, useToast } from './toast';
import { navigate, useRoute } from './route';
import { Sidebar } from './components/Sidebar';
import { PageView } from './components/PageView';
import { GoalView } from './components/GoalView';
import { BinView } from './components/BinView';
import { CloseIcon, SidebarIcon } from './components/Icons';

export function App() {
  const state = useAppState();
  const route = useRoute();
  const { sidebarOpen, theme } = state.prefs;

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toast = useToast();

  // Land on the first page, and recover from links to things that were deleted.
  const pages = livePages(state);
  const page = route.view === 'page' ? pages.find((p) => p.id === route.id) : undefined;
  const goal = route.view === 'goal' && isLiveGoal(state, state.goals[route.id]) ? state.goals[route.id] : undefined;
  const missing = route.view === 'home' || (route.view === 'page' && !page) || (route.view === 'goal' && !goal);
  const firstPageId = pages[0]?.id;
  useEffect(() => {
    if (missing && firstPageId) navigate({ view: 'page', id: firstPageId }, true);
  }, [missing, firstPageId]);

  useEffect(() => {
    const title = goal ? goal.title || 'Untitled' : page ? page.title || 'Untitled' : '';
    document.title = route.view === 'bin' ? 'Bin · Goal Planner' : title ? `${title} · Goal Planner` : 'Goal Planner';
  }, [goal, page, route.view]);

  // Close the sidebar after navigating on small screens, where it overlays the content.
  useEffect(() => {
    if (window.innerWidth < 760 && sidebarOpen) setPrefs({ sidebarOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && <Sidebar />}
      {sidebarOpen && <div className="scrim" onClick={() => setPrefs({ sidebarOpen: false })} />}
      <main className="main" key={'id' in route ? route.id : route.view}>
        {!sidebarOpen && (
          <button className="icon-btn open-sidebar" title="Open sidebar" onClick={() => setPrefs({ sidebarOpen: true })}>
            <SidebarIcon />
          </button>
        )}
        {route.view === 'bin' ? (
          <BinView />
        ) : goal ? (
          <GoalView goal={goal} />
        ) : page ? (
          <PageView page={page} />
        ) : pages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🗓️</div>
            <h2>Plan your goals</h2>
            <p className="muted">Create a page for a year, a theme, or anything you like, then add goals to it.</p>
            <button
              className="btn primary"
              onClick={() => navigate({ view: 'page', id: addPage(String(new Date().getFullYear())) })}
            >
              Create {new Date().getFullYear()}
            </button>
          </div>
        ) : null}
      </main>
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="btn small"
              onClick={() => {
                toast.action!.run();
                dismissToast();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="icon-btn small" onClick={dismissToast} aria-label="Dismiss">
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
