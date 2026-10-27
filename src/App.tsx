import { useEffect } from 'react';
import { addPage, setPrefs, useAppState } from './store';
import { navigate, useRoute } from './route';
import { Sidebar } from './components/Sidebar';
import { PageView } from './components/PageView';
import { GoalView } from './components/GoalView';
import { SidebarIcon } from './components/Icons';

export function App() {
  const state = useAppState();
  const route = useRoute();
  const { sidebarOpen, theme } = state.prefs;

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Land on the first page, and recover from links to things that were deleted.
  const page = route.view === 'page' ? state.pages.find((p) => p.id === route.id) : undefined;
  const goal = route.view === 'goal' ? state.goals[route.id] : undefined;
  const missing = route.view === 'home' || (route.view === 'page' && !page) || (route.view === 'goal' && !goal);
  useEffect(() => {
    if (missing && state.pages[0]) navigate({ view: 'page', id: state.pages[0].id }, true);
  }, [missing, state.pages]);

  useEffect(() => {
    const title = goal ? goal.title || 'Untitled' : page ? page.title || 'Untitled' : '';
    document.title = title ? `${title} · Goal Planner` : 'Goal Planner';
  }, [goal, page]);

  // Close the sidebar after navigating on small screens, where it overlays the content.
  useEffect(() => {
    if (window.innerWidth < 760 && sidebarOpen) setPrefs({ sidebarOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && <Sidebar />}
      {sidebarOpen && <div className="scrim" onClick={() => setPrefs({ sidebarOpen: false })} />}
      <main className="main" key={route.view === 'home' ? 'home' : route.id}>
        {!sidebarOpen && (
          <button className="icon-btn open-sidebar" title="Open sidebar" onClick={() => setPrefs({ sidebarOpen: true })}>
            <SidebarIcon />
          </button>
        )}
        {goal ? (
          <GoalView goal={goal} />
        ) : page ? (
          <PageView page={page} />
        ) : state.pages.length === 0 ? (
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
    </div>
  );
}
