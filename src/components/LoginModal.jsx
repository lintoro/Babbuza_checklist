import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

const STORAGE_KEY_REMEMBER = 'babbuza_remembered_userId';

export default function LoginModal() {
  const { login } = useAuth();
  const [userId, setUserId] = useState(() => localStorage.getItem(STORAGE_KEY_REMEMBER) || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(STORAGE_KEY_REMEMBER) !== null ? localStorage.getItem(STORAGE_KEY_REMEMBER) : true));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanId = userId.trim().toUpperCase();
    if (!cleanId) {
      setError('請輸入員工編號（工號）');
      return;
    }
    if (!password) {
      setError('請輸入密碼');
      return;
    }

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, cleanId);
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER);
    }

    setError('');
    setLoading(true);
    try {
      const res = await login(cleanId, password);
      if (!res.success) {
        setError(res.error || '登入失敗，請確認工號與密碼');
      }
    } catch (err) {
      setError(err.message || '連線伺服器失敗，請檢查網路或稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-b from-brand-900 via-slate-900 to-slate-950">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100">
        {/* 圖示與品牌 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Babbuza 巡檢系統</h2>
          <p className="text-xs text-slate-500 mt-1">商場每日營業前 / 後標準化檢核</p>
        </div>

        {/* 錯誤警告區塊 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* 登入表單 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              員工工號 (User ID)
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="username"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="例如：B110001"
                className="w-full px-3.5 py-2.5 pl-10 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all uppercase placeholder:normal-case placeholder:text-slate-400 font-mono"
                required
              />
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              登入密碼
            </label>
            <div className="relative">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full px-3.5 py-2.5 pl-10 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-slate-400"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* 記住帳號勾選框 */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded-sm border-slate-300 focus:ring-brand-500 cursor-pointer"
              />
              <span className="font-medium text-slate-700">記住員工工號（下次免重複輸入）</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-medium text-sm rounded-xl shadow-md shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>驗證身分中...</span>
                </>
              ) : (
                <span>登入巡檢系統</span>
              )}
            </button>
          </div>
        </form>

        {/* 底部說明 */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 leading-normal">
            登入後系統將自動記憶 7 天免重複輸入。<br />
            如遇帳號問題或需重設密碼，請洽管理員。
          </p>
        </div>
      </div>
    </div>
  );
}
