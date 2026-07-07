import { useState, useEffect } from 'react';
import { apiRequest } from './utils/api';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import TemplateManager from './components/TemplateManager';
import MistakeList from './components/MistakeList';
import ExportPDF from './components/ExportPDF';
import { LogOut, Sun, Moon, Loader2 } from 'lucide-react';
import logoUrl from './assets/logo.png';

interface User {
  id: string;
  username: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Navigation states
  const [activeView, setActiveView] = useState<'all' | 'chapter' | 'templates' | 'export'>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Check login status on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiRequest('/api/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch (e) {
        // Not logged in or expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Sync theme to document body attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveView('all');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('登出異常：', e);
    } finally {
      setUser(null);
      setSelectedChapterId(null);
      setActiveView('all');
    }
  };

  const handleSelectChapter = (chapterId: string | null, _subjectId: string | null) => {
    if (chapterId) {
      setSelectedChapterId(chapterId);
      setActiveView('chapter');
    } else {
      setSelectedChapterId(null);
      setActiveView('all');
    }
  };

  const handleNavigateToExport = (mistakeIds: string[]) => {
    setSelectedExportIds(mistakeIds);
    setActiveView('export');
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0e1a',
        color: '#fff'
      }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
        <span style={{ fontSize: '0.95rem', letterSpacing: '0.05em' }}>載入錯題本中...</span>
      </div>
    );
  }

  // Auth flow
  if (!user) {
    return (
      <>
        <div className="bg-ambient-lights" />
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="bg-ambient-lights" />

      {/* Top Navbar */}
      <header className="glass no-print" style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => handleSelectChapter(null, null)}>
          <img 
            src={logoUrl} 
            alt="PobiNotes Logo" 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              objectFit: 'cover'
            }}
          />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }} className="title-gradient">PobiNotes-線上錯題本</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', border: 'none' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User info */}
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            哈囉, <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>
          </span>

          {/* Logout */}
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            <LogOut size={16} /> 登出
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1 }}>
        {activeView !== 'export' && (
          <Dashboard
            onSelectChapter={handleSelectChapter}
            selectedChapterId={selectedChapterId}
            onNavigateToTemplates={() => setActiveView('templates')}
            activeView={activeView}
          />
        )}

        {/* View Routing */}
        {activeView === 'all' && (
          <MistakeList
            chapterId={null}
            onNavigateToExport={handleNavigateToExport}
            onImageClick={(src) => setZoomedImage(src)}
          />
        )}

        {activeView === 'chapter' && selectedChapterId && (
          <MistakeList
            chapterId={selectedChapterId}
            onNavigateToExport={handleNavigateToExport}
            onImageClick={(src) => setZoomedImage(src)}
          />
        )}

        {activeView === 'templates' && (
          <TemplateManager />
        )}

        {activeView === 'export' && (
          <ExportPDF
            mistakeIds={selectedExportIds}
            onBack={() => setActiveView(selectedChapterId ? 'chapter' : 'all')}
            onImageClick={(src) => setZoomedImage(src)}
          />
        )}
      </div>

      {/* Global Image Lightbox Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            padding: '20px'
          }}
        >
          <img
            src={zoomedImage}
            alt="放大顯示"
            style={{
              maxWidth: '95%',
              maxHeight: '95%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,255,255,0.1)'
            }}
          />
        </div>
      )}
    </div>
  );
}
