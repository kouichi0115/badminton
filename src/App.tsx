import { useEffect, useState } from 'react';
import { useAppState, undo, redo, canUndo, canRedo } from './store';
import SetupPage from './pages/Setup';
import EntriesPage from './pages/Entries';
import DrawPage from './pages/Draw';
import ProgressPage from './pages/Progress';
import ResultsPage from './pages/Results';
import PrintPage from './pages/Print';
import BroadcastPage from './pages/Broadcast';

const TABS = [
  { id: 'setup', label: '大会設定', icon: '⚙️' },
  { id: 'entries', label: '参加者', icon: '👥' },
  { id: 'draw', label: '組み合わせ', icon: '🗂️' },
  { id: 'progress', label: '進行', icon: '🏸' },
  { id: 'results', label: '結果', icon: '🏆' },
  { id: 'broadcast', label: '放送', icon: '📢' },
  { id: 'print', label: '印刷', icon: '🖨️' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const h = location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === h) ? h : 'setup';
}

export default function App() {
  const state = useAppState();
  const [tab, setTab] = useState<TabId>(tabFromHash);
  useEffect(() => {
    const h = () => setTab(tabFromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') (e.preventDefault(), e.shiftKey ? redo() : undo());
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') (e.preventDefault(), redo());
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <span className="logo">🏸</span>
          <div>
            <div className="title">{state.tournament.name || 'バドミントン大会運営'}</div>
            <div className="sub">
              {state.tournament.date} {state.tournament.venue}
            </div>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'active' : ''}>
              <span className="ti">{t.icon}</span>
              <span className="tl">{t.label}</span>
            </a>
          ))}
        </nav>
        <div className="undo">
          <button className="ghost" disabled={!canUndo()} onClick={undo} title="元に戻す (Ctrl+Z)">
            ↶
          </button>
          <button className="ghost" disabled={!canRedo()} onClick={redo} title="やり直し (Ctrl+Y)">
            ↷
          </button>
        </div>
      </header>
      <main className={tab === 'print' ? 'main print-main' : 'main'}>
        {tab === 'setup' && <SetupPage />}
        {tab === 'entries' && <EntriesPage />}
        {tab === 'draw' && <DrawPage />}
        {tab === 'progress' && <ProgressPage />}
        {tab === 'results' && <ResultsPage />}
        {tab === 'broadcast' && <BroadcastPage />}
        {tab === 'print' && <PrintPage />}
      </main>
    </div>
  );
}
