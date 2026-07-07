import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Plus, Edit2, Trash2, Search, FileDown, Eye, EyeOff, CheckSquare, Square, RefreshCw } from 'lucide-react';
import MistakeEditor from './MistakeEditor';

interface FieldOption {
  value: string;
  color?: 'default' | 'danger' | 'warning' | 'success';
}

interface Field {
  id: string;
  type: 'text' | 'textarea' | 'image' | 'options';
  label: string;
  options?: FieldOption[];
  styleType?: 'bordered' | 'underline';
  inline?: boolean;
  hideLabel?: boolean;
}

interface Mistake {
  id: string;
  title: string;
  chapter_id: string;
  template_id: string;
  chapter_name?: string;
  subject_name?: string;
  template_name?: string;
  template_fields: {
    questionFields: Field[];
    answerFields: Field[];
  };
  data: {
    questionData: { [fieldId: string]: any };
    answerData: { [fieldId: string]: any };
  };
  created_at: number;
}

interface MistakeListProps {
  chapterId: string | null;
  onNavigateToExport: (mistakeIds: string[]) => void;
  onImageClick?: (src: string) => void;
}

export default function MistakeList({
  chapterId,
  onNavigateToExport,
  onImageClick
}: MistakeListProps) {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Selection states for exporting
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Collapse/Expand answers states
  const [expandedIds, setExpandedIds] = useState<{ [mistakeId: string]: boolean }>({});

  // Editor states
  const [showEditor, setShowEditor] = useState(false);
  const [editingMistake, setEditingMistake] = useState<Mistake | null>(null);

  const normalizeOptions = (options: any[] | undefined): FieldOption[] => {
    if (!options) return [];
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, color: 'default' };
      }
      return {
        value: opt.value || '',
        color: opt.color || 'default'
      };
    });
  };

  const normalizeField = (f: any): Field => ({
    id: f.id,
    type: f.type,
    label: f.label || '',
    options: normalizeOptions(f.options),
    styleType: f.styleType || 'bordered',
    inline: !!f.inline,
    hideLabel: !!f.hideLabel
  });

  const fetchMistakes = async () => {
    setLoading(true);
    try {
      const endpoint = chapterId ? `/api/mistakes?chapterId=${chapterId}` : '/api/mistakes';
      const res = await apiRequest(endpoint);
      const normalized = res.map((m: any) => ({
        ...m,
        template_fields: {
          questionFields: (m.template_fields?.questionFields || []).map(normalizeField),
          answerFields: (m.template_fields?.answerFields || []).map(normalizeField)
        }
      }));
      setMistakes(normalized);
      // Reset expansion state
      setExpandedIds({});
      // Reset selection state
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMistakes();
  }, [chapterId]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除錯題「${title}」嗎？`)) return;
    try {
      await apiRequest(`/api/mistakes?id=${id}`, {
        method: 'DELETE'
      });
      setMistakes(prev => prev.filter(m => m.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const next: { [id: string]: boolean } = {};
    filteredMistakes.forEach(m => {
      next[m.id] = true;
    });
    setExpandedIds(next);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  // Card select logic
  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredMistakes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMistakes.map(m => m.id));
    }
  };

  // Search filter
  const filteredMistakes = mistakes.filter(m => {
    const titleMatch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Also search in text/textarea question fields data
    let dataMatch = false;
    if (m.data?.questionData) {
      dataMatch = Object.values(m.data.questionData).some(val => 
        typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return titleMatch || dataMatch;
  });

  // Mastery evaluation statistics
  const stats = {
    total: filteredMistakes.length,
    success: 0, // 順
    warning: 0, // 卡
    danger: 0,  // 不會 + 誤解
    unevaluated: 0 // 未評估
  };

  filteredMistakes.forEach(m => {
    let masteryValues: string[] = [];
    
    m.template_fields.answerFields?.forEach(f => {
      if (f.type === 'options' && (f.label === '掌握度' || f.id.includes('mastery'))) {
        const val = m.data.answerData?.[f.id];
        if (Array.isArray(val)) {
          masteryValues = [...masteryValues, ...val];
        }
      }
    });
    
    m.template_fields.questionFields?.forEach(f => {
      if (f.type === 'options' && (f.label === '掌握度' || f.id.includes('mastery'))) {
        const val = m.data.questionData?.[f.id];
        if (Array.isArray(val)) {
          masteryValues = [...masteryValues, ...val];
        }
      }
    });

    if (masteryValues.length === 0) {
      stats.unevaluated++;
    } else {
      if (masteryValues.includes('順')) stats.success++;
      if (masteryValues.includes('卡')) stats.warning++;
      if (masteryValues.includes('不會') || masteryValues.includes('誤解')) stats.danger++;
    }
  });

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
      
      {/* Control bar */}
      <div className="glass no-print" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '300px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '38px', height: '40px' }}
            placeholder="搜尋題目或敘述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Global toggles and actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {filteredMistakes.length > 0 && (
            <>
              <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.9rem' }} onClick={handleExpandAll}>
                <Eye size={16} /> 展開全部答案
              </button>
              <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.9rem' }} onClick={handleCollapseAll}>
                <EyeOff size={16} /> 收折全部答案
              </button>
            </>
          )}

          {chapterId ? (
            <button
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => {
                setEditingMistake(null);
                setShowEditor(true);
              }}
            >
              <Plus size={16} /> 新增錯題
            </button>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              (請選擇特定章節以新增錯題)
            </div>
          )}
        </div>
      </div>

      {/* Mastery Evaluation Stats Dashboard */}
      {filteredMistakes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', margin: '0' }} className="no-print animate-fade-in">
          {/* Total mistakes */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', borderLeft: '4px solid var(--accent-primary)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>章節錯題總數</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {stats.total} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>題</span>
            </span>
          </div>

          {/* Mastered (順) */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', borderLeft: '4px solid #10b981', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>已完全掌握 (順)</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>
              {stats.success} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>題</span>
              {stats.total > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({Math.round((stats.success / stats.total) * 100)}%)</span>}
            </span>
          </div>

          {/* Need practice (卡) */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', borderLeft: '4px solid #f59e0b', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 500 }}>需要多練習 (卡)</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.warning} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>題</span>
              {stats.total > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({Math.round((stats.warning / stats.total) * 100)}%)</span>}
            </span>
          </div>

          {/* Heavy weakness (不會 / 誤解) */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', borderLeft: '4px solid #ef4444', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>觀念重災區 (不會/誤解)</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>
              {stats.danger} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>題</span>
              {stats.total > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({Math.round((stats.danger / stats.total) * 100)}%)</span>}
            </span>
          </div>
        </div>
      )}

      {/* Multi-select Export Bar */}
      {selectedIds.length > 0 && (
        <div className="glass animate-fade-in no-print" style={{ padding: '14px 24px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            已勾選 {selectedIds.length} 題錯題
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setSelectedIds([])}>
              取消全選
            </button>
            <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => onNavigateToExport(selectedIds)}>
              <FileDown size={14} /> 匯出為 PDF ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Mistakes list container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Bulk select check */}
        {filteredMistakes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px' }} className="no-print">
            <button
              onClick={handleSelectAll}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 500 }}
            >
              {selectedIds.length === filteredMistakes.length ? <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} /> : <Square size={18} />}
              <span>{selectedIds.length === filteredMistakes.length ? '取消全選' : '全選本頁'}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2" style={{ gap: '20px' }}>
          {filteredMistakes.map(m => {
            const isExpanded = !!expandedIds[m.id];
            const isSelected = selectedIds.includes(m.id);
            
            return (
              <div
                key={m.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderLeft: isSelected ? '4px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                  position: 'relative'
                }}
              >
                {/* Header row (selection checkbox + Title) */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <button
                    onClick={() => handleSelectToggle(m.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', paddingTop: '2px' }}
                    className="no-print"
                  >
                    {isSelected ? <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} /> : <Square size={18} />}
                  </button>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{m.title}</h3>
                    
                    {/* Metadata tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {m.subject_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--glass-bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          {m.subject_name}
                        </span>
                      )}
                      {m.chapter_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--glass-bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          {m.chapter_name}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }} className="no-print">
                    <button
                      onClick={() => {
                        setEditingMistake(m);
                        setShowEditor(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.title)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 1. Render Question fields */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', display: 'block' }}>
                  {m.template_fields.questionFields?.map(field => (
                    <DynamicValueRenderer
                      key={field.id}
                      field={field}
                      value={m.data.questionData?.[field.id]}
                      onImageClick={onImageClick}
                    />
                  ))}
                </div>

                {/* 2. Collapsible Answer & Solution block */}
                {m.template_fields.answerFields && m.template_fields.answerFields.length > 0 && (
                  <div className="collapsible-container">
                    <div
                      className="collapsible-trigger no-print"
                      onClick={() => handleToggleExpand(m.id)}
                    >
                      <span style={{ fontSize: '0.85rem', color: isExpanded ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {isExpanded ? '隱藏答案與解析' : '顯示答案與解析'}
                      </span>
                      {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                    </div>

                    {(isExpanded) && (
                      <div className="collapsible-content" style={{ display: 'block' }}>
                        {m.template_fields.answerFields.map(field => (
                          <DynamicValueRenderer
                            key={field.id}
                            field={field}
                            value={m.data.answerData?.[field.id]}
                            onImageClick={onImageClick}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Empty status */}
        {filteredMistakes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>在此章節中找不到任何錯題紀錄。</p>
            {chapterId && (
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', marginTop: '12px' }}
                onClick={() => {
                  setEditingMistake(null);
                  setShowEditor(true);
                }}
              >
                建立第一筆錯題
              </button>
            )}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          </div>
        )}
      </div>

      {/* Mistake creation/edit modal */}
      {showEditor && chapterId && (
        <MistakeEditor
          chapterId={chapterId}
          mistake={editingMistake}
          onClose={() => setShowEditor(false)}
          onSaveSuccess={() => {
            setShowEditor(false);
            fetchMistakes();
          }}
        />
      )}
    </div>
  );
}

// Sub-component to render field values dynamically based on type
interface DynamicValueRendererProps {
  field: Field;
  value: any;
  onImageClick?: (src: string) => void;
}

function DynamicValueRenderer({ field, value, onImageClick }: DynamicValueRendererProps) {
  const isOptions = field.type === 'options';
  const isUnderline = field.styleType === 'underline';
  const isEmptyValue = value === undefined || value === null || value === '';

  // If no value, and not options or underline, hide it
  if (isEmptyValue && !isOptions && !isUnderline) {
    return null;
  }

  // 1. Layout styles
  const containerStyle: React.CSSProperties = field.inline ? {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginRight: '20px',
    marginBottom: '8px',
    verticalAlign: 'middle'
  } : {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px'
  };

  const labelStyle: React.CSSProperties = field.inline ? {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    margin: 0,
    display: field.hideLabel ? 'none' : 'inline'
  } : {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginBottom: '2px',
    display: field.hideLabel ? 'none' : 'block'
  };

  const underlineStyle = isUnderline ? {
    borderBottom: '1px solid var(--text-primary)',
    padding: '0 6px 1px 6px',
    minWidth: field.inline ? '80px' : '200px',
    display: 'inline-block',
    color: 'var(--text-primary)'
  } : {};

  // 2. Custom checkmarks style helpers
  const getOptionStyles = (isChecked: boolean, color?: string) => {
    let borderColor = 'var(--glass-border)';
    let activeBg = 'rgba(99, 102, 241, 0.15)';
    let activeBorder = 'var(--accent-primary)';
    let textColor = isChecked ? 'var(--text-primary)' : 'var(--text-secondary)';
    
    if (color === 'danger') {
      borderColor = 'rgba(239, 68, 68, 0.4)';
      activeBg = 'rgba(239, 68, 68, 0.15)';
      activeBorder = '#ef4444';
      if (isChecked) textColor = '#ef4444';
    } else if (color === 'warning') {
      borderColor = 'rgba(245, 158, 11, 0.4)';
      activeBg = 'rgba(245, 158, 11, 0.15)';
      activeBorder = '#f59e0b';
      if (isChecked) textColor = '#f59e0b';
    } else if (color === 'success') {
      borderColor = 'rgba(16, 185, 129, 0.4)';
      activeBg = 'rgba(16, 185, 129, 0.15)';
      activeBorder = '#10b981';
      if (isChecked) textColor = '#10b981';
    }
    
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.8rem',
      padding: '4px 10px',
      background: isChecked ? activeBg : 'var(--glass-bg)',
      border: `1px solid ${isChecked ? activeBorder : borderColor}`,
      borderRadius: 'var(--radius-md)',
      color: textColor
    };
  };

  const renderCheckbox = (isChecked: boolean, color?: string) => {
    let boxBorder = '1px solid var(--text-muted)';
    let checkColor = '#3b82f6';
    
    if (color === 'danger') boxBorder = '1px solid #ef4444';
    else if (color === 'warning') boxBorder = '1px solid #f59e0b';
    else if (color === 'success') boxBorder = '1px solid #10b981';

    return (
      <div style={{
        width: '14px',
        height: '14px',
        border: boxBorder,
        borderRadius: '3px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)',
        position: 'relative'
      }}>
        {isChecked && (
          <span style={{
            color: checkColor,
            fontWeight: 'bold',
            fontSize: '1.1rem',
            position: 'absolute',
            top: '-5px',
            left: '0px',
            fontFamily: 'cursive, sans-serif'
          }}>
            ✓
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={containerStyle} className="dynamic-value-card">
      {!field.hideLabel && (
        <span style={labelStyle}>
          {field.label}：
        </span>
      )}

      {/* Underline text or textarea */}
      {isUnderline && (field.type === 'text' || field.type === 'textarea') && (
        <span style={underlineStyle}>
          {value || '\u00A0'}
        </span>
      )}

      {/* Normal Bordered Style Text Rendering */}
      {!isUnderline && field.type === 'text' && (
        <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', wordBreak: 'break-word', margin: 0, display: field.inline ? 'inline' : 'block' }}>
          {value}
        </p>
      )}

      {/* Normal Bordered Style Textarea Rendering */}
      {!isUnderline && field.type === 'textarea' && (
        <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, display: field.inline ? 'inline' : 'block' }}>
          {value}
        </p>
      )}

      {/* Image Rendering */}
      {field.type === 'image' && (
        <div style={{ width: '100%', maxWidth: '350px', marginTop: '4px' }}>
          <img
            src={`/api/images/${value}`}
            alt={field.label}
            onClick={() => onImageClick?.(`/api/images/${value}`)}
            style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: onImageClick ? 'zoom-in' : 'default' }}
          />
        </div>
      )}

      {/* Options Rendering */}
      {field.type === 'options' && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '8px', verticalAlign: 'middle' }}>
          {field.options?.map((opt, i) => {
            const isChecked = Array.isArray(value) && value.includes(opt.value);
            return (
              <span
                key={i}
                style={getOptionStyles(isChecked, opt.color)}
              >
                {renderCheckbox(isChecked, opt.color)}
                <span>{opt.value}</span>
              </span>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>無選項</span>
          )}
        </div>
      )}
    </div>
  );
}
