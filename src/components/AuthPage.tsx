import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { LogIn, UserPlus, BookOpen, Key, User } from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: (user: { id: string; username: string }) => void;
}

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        });
        onLoginSuccess(res.user);
      } else {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: { username, password }
        });
        setSuccess('註冊成功！請直接登入。');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || '發生錯誤，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '20px'
    }} className="animate-fade-in">
      <div className="glass" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative glow */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            color: '#fff',
            marginBottom: '15px',
            boxShadow: '0 8px 16px rgba(99,102,241,0.2)'
          }}>
            <BookOpen size={30} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>線上錯題本</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isLogin ? '歡迎回來！請登入您的帳戶' : '立即註冊，建立專屬的錯題本'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-glow)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'var(--success-glow)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">使用者名稱</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}>
                <User size={18} />
              </span>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '45px' }}
                placeholder="請輸入使用者名稱"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label className="form-label">密碼</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}>
                <Key size={18} />
              </span>
              <input
                type="password"
                className="input"
                style={{ paddingLeft: '45px' }}
                placeholder={isLogin ? "請輸入密碼" : "設定 6 位數以上密碼"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', height: '48px' }}
            disabled={loading}
          >
            {loading ? '處理中...' : (
              isLogin ? (
                <>登入 <LogIn size={18} /></>
              ) : (
                <>註冊 <UserPlus size={18} /></>
              )
            )}
          </button>
        </form>

        <div style={{
          marginTop: '25px',
          textAlign: 'center',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)'
        }}>
          {isLogin ? '還沒有帳號嗎？' : '已經有帳號了？'}
          <button
            type="button"
            className="btn-text"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontWeight: '600',
              marginLeft: '5px'
            }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
            disabled={loading}
          >
            {isLogin ? '立即註冊' : '前往登入'}
          </button>
        </div>
      </div>
    </div>
  );
}
