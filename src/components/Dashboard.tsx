import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Folder, Plus, Edit2, Trash2, ChevronDown, ChevronRight, FileText, Settings, BookOpen, PanelLeftClose, PanelLeftOpen, HelpCircle } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  created_at: number;
}

interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  created_at: number;
}

interface DashboardProps {
  onSelectChapter: (chapterId: string | null, subjectId: string | null) => void;
  selectedChapterId: string | null;
  onNavigateToTemplates: () => void;
  onNavigateToGuide: () => void;
  activeView: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Dashboard({
  onSelectChapter,
  selectedChapterId,
  onNavigateToTemplates,
  onNavigateToGuide,
  activeView,
  collapsed,
  onToggleCollapse
}: DashboardProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<{ [subjectId: string]: Chapter[] }>({});
  const [expandedSubjects, setExpandedSubjects] = useState<{ [subjectId: string]: boolean }>({});

  // Add state
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newChapterName, setNewChapterName] = useState<{ [subjectId: string]: string }>({});
  const [showAddChapter, setShowAddChapter] = useState<{ [subjectId: string]: boolean }>({});

  const fetchSubjects = async () => {
    try {
      const res = await apiRequest('/api/subjects');
      setSubjects(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChapters = async (subjectId: string) => {
    try {
      const res = await apiRequest(`/api/chapters?subjectId=${subjectId}`);
      setChaptersBySubject(prev => ({ ...prev, [subjectId]: res }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => {
      const next = { ...prev, [subjectId]: !prev[subjectId] };
      if (next[subjectId] && !chaptersBySubject[subjectId]) {
        fetchChapters(subjectId);
      }
      return next;
    });
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      const res = await apiRequest('/api/subjects', {
        method: 'POST',
        body: { name: newSubjectName }
      });
      setSubjects(prev => [res.subject, ...prev]);
      setNewSubjectName('');
      setShowAddSubject(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增科目失敗');
    }
  };

  const handleRenameSubject = async (subjectId: string, currentName: string) => {
    const name = prompt('重命名科目：', currentName);
    if (!name || name.trim() === currentName) return;
    try {
      await apiRequest('/api/subjects', {
        method: 'PUT',
        body: { id: subjectId, name: name.trim() }
      });
      setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, name: name.trim() } : s));
    } catch (e) {
      alert(e instanceof Error ? e.message : '修改失敗');
    }
  };

  const handleDeleteSubject = async (subjectId: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」科目嗎？此操作將刪除此科目下的所有章節與錯題！`)) return;
    try {
      await apiRequest(`/api/subjects?id=${subjectId}`, {
        method: 'DELETE'
      });
      setSubjects(prev => prev.filter(s => s.id !== subjectId));
      onSelectChapter(null, null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const handleAddChapter = async (subjectId: string) => {
    const name = newChapterName[subjectId] || '';
    if (!name.trim()) return;
    try {
      const res = await apiRequest('/api/chapters', {
        method: 'POST',
        body: { name: name.trim(), subjectId }
      });
      setChaptersBySubject(prev => ({
        ...prev,
        [subjectId]: [...(prev[subjectId] || []), res.chapter]
      }));
      setNewChapterName(prev => ({ ...prev, [subjectId]: '' }));
      setShowAddChapter(prev => ({ ...prev, [subjectId]: false }));
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增章節失敗');
    }
  };

  const handleRenameChapter = async (chapterId: string, subjectId: string, currentName: string) => {
    const name = prompt('重命名章節：', currentName);
    if (!name || name.trim() === currentName) return;
    try {
      await apiRequest('/api/chapters', {
        method: 'PUT',
        body: { id: chapterId, name: name.trim() }
      });
      setChaptersBySubject(prev => ({
        ...prev,
        [subjectId]: prev[subjectId].map(c => c.id === chapterId ? { ...c, name: name.trim() } : c)
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : '修改失敗');
    }
  };

  const handleDeleteChapter = async (chapterId: string, subjectId: string, name: string) => {
    if (!confirm(`確定要刪除章節「${name}」嗎？此操作將刪除此章節下的所有錯題！`)) return;
    try {
      await apiRequest(`/api/chapters?id=${chapterId}`, {
        method: 'DELETE'
      });
      setChaptersBySubject(prev => ({
        ...prev,
        [subjectId]: prev[subjectId].filter(c => c.id !== chapterId)
      }));
      if (selectedChapterId === chapterId) {
        onSelectChapter(null, null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  return (
    <div
      className={`sidebar no-print ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
      style={{
        borderRight: '1px solid var(--glass-border)',
        background: 'rgba(0, 0, 0, 0.15)',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: collapsed ? '48px' : '300px',
      }}
    >
      {/* Collapse Toggle Button */}
      <div style={{
        padding: '8px',
        borderBottom: collapsed ? 'none' : '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-end',
      }}>
        <button
          onClick={onToggleCollapse}
          className="btn btn-secondary"
          style={{ padding: '6px 8px', border: 'none' }}
          title={collapsed ? '展開側邊欄' : '收合側邊欄'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Sidebar Content - hidden when collapsed */}
      {!collapsed && (
        <>
          {/* Navigation shortcuts */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => onSelectChapter(null, null)}
              className={`btn ${activeView === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '8px' }}
            >
              <BookOpen size={16} />
              <span>所有錯題</span>
            </button>
            <button
              onClick={onNavigateToTemplates}
              className={`btn ${activeView === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '8px' }}
            >
              <Settings size={16} />
              <span>自訂模板管理</span>
            </button>
            <button
              onClick={onNavigateToGuide}
              className={`btn ${activeView === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <HelpCircle size={16} />
              <span>使用說明與教學</span>
            </button>
          </div>

          {/* Header for subjects */}
          <div style={{
            padding: '16px 20px 8px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '0.05em'
          }}>
            <span>學科分類</span>
            <button
              onClick={() => setShowAddSubject(!showAddSubject)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Inline add subject form */}
          {showAddSubject && (
            <form onSubmit={handleAddSubject} style={{ padding: '0 16px 12px 16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input"
                  style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                  placeholder="科目名稱 (例如：數學)"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px' }}>
                  新增
                </button>
              </div>
            </form>
          )}

          {/* Subjects & Chapters List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 20px 8px' }}>
            {subjects.map(subject => {
              const isExpanded = !!expandedSubjects[subject.id];
              const chapters = chaptersBySubject[subject.id] || [];

              return (
                <div key={subject.id} style={{ marginBottom: '4px' }}>
                  {/* Subject Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="btn-secondary-hover-bg"
                    onClick={() => toggleSubject(subject.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {isExpanded ? <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />}
                      <Folder size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {subject.name}
                      </span>
                    </div>
                    
                    {/* Subject Actions */}
                    <div style={{ display: 'flex', gap: '4px' }} className="actions-wrapper" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRenameSubject(subject.id, subject.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject.id, subject.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (!isExpanded) toggleSubject(subject.id);
                          setShowAddChapter(prev => ({ ...prev, [subject.id]: !prev[subject.id] }));
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Chapters list under Subject */}
                  {isExpanded && (
                    <div style={{ paddingLeft: '24px', marginTop: '2px' }}>
                      {/* Inline Add Chapter Form */}
                      {showAddChapter[subject.id] && (
                        <div style={{ display: 'flex', gap: '4px', padding: '4px 8px' }}>
                          <input
                            type="text"
                            className="input"
                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                            placeholder="新增章節..."
                            value={newChapterName[subject.id] || ''}
                            onChange={(e) => setNewChapterName(prev => ({ ...prev, [subject.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddChapter(subject.id);
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddChapter(subject.id)}
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          >
                            新增
                          </button>
                        </div>
                      )}

                      {/* Chapters List */}
                      {chapters.length === 0 && !showAddChapter[subject.id] && (
                        <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          尚無章節
                        </div>
                      )}
                      
                      {chapters.map(chapter => {
                        const isSelected = selectedChapterId === chapter.id;
                        return (
                          <div
                            key={chapter.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              marginBottom: '2px',
                              background: isSelected ? 'var(--accent-gradient)' : 'transparent',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                              transition: 'background 0.2s'
                            }}
                            onClick={() => onSelectChapter(chapter.id, subject.id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <FileText size={14} style={{ flexShrink: 0 }} />
                              <span style={{
                                fontSize: '0.9rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {chapter.name}
                              </span>
                            </div>

                            {/* Chapter Actions */}
                            <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleRenameChapter(chapter.id, subject.id, chapter.name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                                  cursor: 'pointer'
                                }}
                              >
                                <Edit2 size={10} />
                              </button>
                              <button
                                onClick={() => handleDeleteChapter(chapter.id, subject.id, chapter.name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {subjects.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
                尚未建立科目，請點擊上方 + 按鈕。
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
