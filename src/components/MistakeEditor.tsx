import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { compressImage } from '../utils/compress';
import { Save, X, Image as ImageIcon, Loader2 } from 'lucide-react';

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

interface Template {
  id: string;
  name: string;
  fields: {
    questionFields: Field[];
    answerFields: Field[];
  };
}

interface Mistake {
  id: string;
  title: string;
  chapter_id: string;
  template_id: string;
  data: {
    questionData: { [fieldId: string]: any };
    answerData: { [fieldId: string]: any };
  };
}

interface MistakeEditorProps {
  chapterId: string | null;
  mistake: Mistake | null; // Null means create new
  onClose: () => void;
  onSaveSuccess: () => void;
  onImageClick?: (src: string) => void;
}

export default function MistakeEditor({
  chapterId,
  mistake,
  onClose,
  onSaveSuccess,
  onImageClick
}: MistakeEditorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const [title, setTitle] = useState('');
  const [questionData, setQuestionData] = useState<{ [fieldId: string]: any }>({});
  const [answerData, setAnswerData] = useState<{ [fieldId: string]: any }>({});
  
  const [uploadingFields, setUploadingFields] = useState<{ [fieldId: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  const normalizeOptions = (options: any[] | undefined): FieldOption[] => {
    if (!options || !Array.isArray(options)) return [];
    return options
      .filter(opt => opt !== null && opt !== undefined)
      .map(opt => {
        if (typeof opt === 'string') {
          return { value: opt, color: 'default' };
        }
        return {
          value: opt.value || '',
          color: opt.color || 'default'
        };
      });
  };

  const normalizeField = (f: any): Field => {
    if (!f) {
      return {
        id: 'field_' + Math.random().toString(36).substr(2, 9),
        type: 'text',
        label: '',
        options: [],
        styleType: 'bordered',
        inline: false,
        hideLabel: false
      };
    }
    return {
      id: f.id || 'field_' + Math.random().toString(36).substr(2, 9),
      type: f.type || 'text',
      label: f.label || '',
      options: normalizeOptions(f.options),
      styleType: f.styleType || 'bordered',
      inline: !!f.inline,
      hideLabel: !!f.hideLabel
    };
  };

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await apiRequest('/api/templates');
        const normalized = (res || []).filter(Boolean).map((t: any) => ({
          ...t,
          fields: {
            questionFields: (t.fields?.questionFields || []).map(normalizeField),
            answerFields: (t.fields?.answerFields || []).map(normalizeField)
          }
        }));
        setTemplates(normalized);
        
        if (mistake) {
          // Edit mode
          setTitle(mistake.title || '');
          setSelectedTemplateId(mistake.template_id || '');
          const tpl = normalized.find((t: Template) => t && t.id === mistake.template_id);
          if (tpl) {
            setSelectedTemplate(tpl);
            setQuestionData(mistake.data?.questionData || {});
            setAnswerData(mistake.data?.answerData || {});
          }
        } else if (normalized.length > 0) {
          // Create mode: select first template by default
          setSelectedTemplateId(normalized[0].id || '');
          setSelectedTemplate(normalized[0]);
          // Initialize empty structures
          setQuestionData({});
          setAnswerData({});
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTemplates();
  }, [mistake]);

  // Handle template switch
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId) || null;
    setSelectedTemplate(tpl);
    // Clear previous data structure
    setQuestionData({});
    setAnswerData({});
  };

  // Image Upload handler
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
    section: 'question' | 'answer'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));

    try {
      // 1. Client-side compression
      const compressedBlob = await compressImage(file, 1200, 0.8);

      // 2. Upload to R2 via API
      const res = await apiRequest('/api/images/upload', {
        method: 'POST',
        body: compressedBlob,
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });

      // 3. Store key in data
      if (section === 'question') {
        setQuestionData(prev => ({ ...prev, [fieldId]: res.key }));
      } else {
        setAnswerData(prev => ({ ...prev, [fieldId]: res.key }));
      }
    } catch (e) {
      alert('圖片上傳失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  // Checkbox option toggle handler
  const handleOptionToggle = (
    fieldId: string,
    option: string,
    section: 'question' | 'answer'
  ) => {
    const currentData = section === 'question' ? questionData : answerData;
    const selectedOptions = Array.isArray(currentData[fieldId]) ? currentData[fieldId] : [];
    
    let nextOptions;
    if (selectedOptions.includes(option)) {
      nextOptions = selectedOptions.filter((o: string) => o !== option);
    } else {
      nextOptions = [...selectedOptions, option];
    }

    if (section === 'question') {
      setQuestionData(prev => ({ ...prev, [fieldId]: nextOptions }));
    } else {
      setAnswerData(prev => ({ ...prev, [fieldId]: nextOptions }));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('請輸入錯題名稱！');
      return;
    }
    if (!selectedTemplateId) {
      alert('請先選擇模板！');
      return;
    }

    setLoading(true);
    const payload = {
      title: title.trim(),
      chapterId,
      templateId: selectedTemplateId,
      data: {
        questionData,
        answerData
      }
    };

    try {
      if (mistake) {
        // Edit mode
        await apiRequest('/api/mistakes', {
          method: 'PUT',
          body: { id: mistake.id, title: payload.title, data: payload.data }
        });
      } else {
        // Create mode
        await apiRequest('/api/mistakes', {
          method: 'POST',
          body: payload
        });
      }
      onSaveSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} className="animate-fade-in no-print">
      <div className="glass" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Editor Header */}
        <div style={{
          padding: '20px 30px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {mistake ? '編輯錯題紀錄' : '新增錯題紀錄'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
              依模板填入錯誤的題目與詳細解析
            </p>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Editor Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="grid grid-cols-2" style={{ gap: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">錯題標題 / 簡述</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：115學測數學單選第三題、英文文法關代錯題..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">選擇模板</label>
              <select
                className="input"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={!!mistake} // Disable template changing in edit mode to avoid data layout corruptions
              >
                <option value="" disabled>-- 請選擇欄位模板 --</option>
                {templates.filter(t => t && t.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedTemplate ? (
            <div className="grid grid-cols-2" style={{ gap: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              {/* Question Fields Column */}
              <div style={{ display: 'block', borderRight: '1px solid var(--glass-border)', paddingRight: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '16px' }}>
                  1. 題目內容填寫
                </h4>
                
                {selectedTemplate.fields.questionFields?.map(field => (
                  <div
                    key={field.id}
                    style={{
                      display: field.inline ? 'inline-flex' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      verticalAlign: 'bottom',
                      marginRight: field.inline ? '16px' : '0',
                      marginBottom: '20px',
                      width: field.inline ? (field.type === 'options' ? 'auto' : '180px') : '100%'
                    }}
                  >
                    {!field.hideLabel && <label className="form-label" style={{ marginBottom: '6px' }}>{field.label}</label>}
                    {field.hideLabel && field.inline && <div style={{ height: '23px' }} />}
                    <DynamicFieldInput
                      field={field}
                      value={questionData[field.id]}
                      onChange={(val) => setQuestionData(prev => ({ ...prev, [field.id]: val }))}
                      onImageUpload={(e) => handleImageUpload(e, field.id, 'question')}
                      uploading={uploadingFields[field.id]}
                      onOptionToggle={(opt) => handleOptionToggle(field.id, opt, 'question')}
                      onImageClick={onImageClick}
                    />
                  </div>
                ))}
                
                {(!selectedTemplate.fields.questionFields || selectedTemplate.fields.questionFields.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '30px' }}>
                    題目欄位為空，請到模板管理處設定欄位。
                  </div>
                )}
              </div>

              {/* Answer Fields Column */}
              <div style={{ display: 'block' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--success)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '16px' }}>
                  2. 答案與解析填寫
                </h4>

                {selectedTemplate.fields.answerFields?.map(field => (
                  <div
                    key={field.id}
                    style={{
                      display: field.inline ? 'inline-flex' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      verticalAlign: 'bottom',
                      marginRight: field.inline ? '16px' : '0',
                      marginBottom: '20px',
                      width: field.inline ? (field.type === 'options' ? 'auto' : '180px') : '100%'
                    }}
                  >
                    {!field.hideLabel && <label className="form-label" style={{ marginBottom: '6px' }}>{field.label}</label>}
                    {field.hideLabel && field.inline && <div style={{ height: '23px' }} />}
                    <DynamicFieldInput
                      field={field}
                      value={answerData[field.id]}
                      onChange={(val) => setAnswerData(prev => ({ ...prev, [field.id]: val }))}
                      onImageUpload={(e) => handleImageUpload(e, field.id, 'answer')}
                      uploading={uploadingFields[field.id]}
                      onOptionToggle={(opt) => handleOptionToggle(field.id, opt, 'answer')}
                      onImageClick={onImageClick}
                    />
                  </div>
                ))}

                {(!selectedTemplate.fields.answerFields || selectedTemplate.fields.answerFields.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '30px' }}>
                    答案與解析欄位為空，請到模板管理處設定欄位。
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>您需要先建立自訂欄位模板，才能新增錯題哦！</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>請關閉本視窗並至左側點選「自訂模板管理」建立新模板。</p>
            </div>
          )}

        </div>

        {/* Editor Footer */}
        <div style={{
          padding: '16px 30px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !selectedTemplate}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            儲存錯題
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-component to render field inputs dynamically based on type
interface DynamicFieldInputProps {
  field: Field;
  value: any;
  onChange: (val: any) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  onOptionToggle: (option: string) => void;
  onImageClick?: (src: string) => void;
}

function DynamicFieldInput({
  field,
  value,
  onChange,
  onImageUpload,
  uploading = false,
  onOptionToggle,
  onImageClick
}: DynamicFieldInputProps) {
  const getOptionStyles = (isChecked: boolean, color?: string) => {
    let borderColor = 'var(--glass-border)';
    let activeBg = 'rgba(99, 102, 241, 0.1)';
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
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      background: isChecked ? activeBg : 'var(--glass-bg)',
      border: `1px solid ${isChecked ? activeBorder : borderColor}`,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      color: textColor,
      transition: 'all 0.2s'
    };
  };

  const renderCheckbox = (isChecked: boolean, color?: string) => {
    let boxBorder = '1px solid var(--text-muted)';
    let checkColor = '#3b82f6'; // Hand-drawn styled blue
    
    if (color === 'danger') {
      boxBorder = '1px solid #ef4444';
    } else if (color === 'warning') {
      boxBorder = '1px solid #f59e0b';
    } else if (color === 'success') {
      boxBorder = '1px solid #10b981';
    }
    
    return (
      <div style={{
        width: '16px',
        height: '16px',
        border: boxBorder,
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)',
        position: 'relative'
      }}>
        {isChecked && (
          <span style={{
            color: checkColor,
            fontWeight: 'bold',
            fontSize: '1.25rem',
            position: 'absolute',
            top: '-5px',
            left: '1px',
            fontFamily: '"Architects Daughter", cursive, sans-serif'
          }}>
            ✓
          </span>
        )}
      </div>
    );
  };

  switch (field.type) {
    case 'text':
      const underlineStyle = field.styleType === 'underline' ? {
        border: 'none',
        borderBottom: '1px solid var(--text-primary)',
        borderRadius: 0,
        background: 'transparent',
        paddingLeft: '4px',
        paddingRight: '4px',
        width: field.inline ? '120px' : '100%'
      } : {};
      
      return (
        <input
          type="text"
          className="input"
          style={underlineStyle}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.styleType === 'underline' ? '' : `請輸入${field.label}`}
        />
      );
    case 'textarea':
      const textareaUnderlineStyle = field.styleType === 'underline' ? {
        border: 'none',
        borderBottom: '1px solid var(--text-primary)',
        borderRadius: 0,
        background: 'transparent',
        paddingLeft: '4px',
        paddingRight: '4px',
        width: '100%',
        resize: 'vertical' as const
      } : {};
      
      return (
        <textarea
          className="input"
          rows={field.styleType === 'underline' ? 2 : 4}
          style={textareaUnderlineStyle}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.styleType === 'underline' ? '' : `請輸入${field.label}`}
        />
      );
    case 'image':
      const imageKey = value as string;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {imageKey ? (
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={`/api/images/${imageKey}`}
                alt={field.label}
                onClick={() => onImageClick?.(`/api/images/${imageKey}`)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: onImageClick ? 'zoom-in' : 'default' }}
              />
              <button
                type="button"
                onClick={() => onChange('')}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(239, 68, 68, 0.8)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}
              >
                &times;
              </button>
            </div>
          ) : (
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              cursor: uploading ? 'default' : 'pointer',
              background: 'var(--glass-bg)',
              transition: 'all 0.2s',
              textAlign: 'center',
              width: '100%'
            }} className="btn-secondary-hover-bg">
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>壓縮並上傳中...</span>
                </>
              ) : (
                <>
                  <ImageIcon size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>點擊上傳圖片 (自動壓縮)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      );
    case 'options':
      const checkedOptions = Array.isArray(value) ? value : [];
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {field.options?.map((opt, i) => {
            const isChecked = checkedOptions.includes(opt.value);
            return (
              <div
                key={i}
                onClick={() => onOptionToggle(opt.value)}
                style={getOptionStyles(isChecked, opt.color)}
              >
                {renderCheckbox(isChecked, opt.color)}
                <span style={{ fontSize: '0.9rem' }}>{opt.value}</span>
              </div>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>無選項可選</span>
          )}
        </div>
      );
  }
}
