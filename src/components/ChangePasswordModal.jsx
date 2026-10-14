import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, onClose, isForced = false }) {
  const { changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      setError('請輸入目前使用的密碼');
      return;
    }
    if (!newPassword || newPassword.length < 6 || newPassword.length > 8) {
      setError('新密碼長度必須介於 6 至 8 碼之間');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的新密碼不一致，請重新檢查');
      return;
    }
    if (newPassword === oldPassword) {
      setError('新密碼不能與目前密碼相同');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          onClose();
        }, 1500);
      } else {
        setError(res.error || '變更密碼失敗');
      }
    } catch (err) {
      setError(err.message || '變更密碼失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 border border-slate-100 relative">
        {/* 若非強制修改密碼，提供關閉按鈕 */}
        {!isForced && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto mb-2.5">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isForced ? '首次登入：請設定新密碼' : '變更個人密碼'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isForced
              ? '為保障帳號安全性，初次登入必須完成密碼變更'
              : '請輸入原密碼與您欲更換的新密碼'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <p className="text-sm font-semibold text-emerald-700">密碼變更成功！</p>
            <p className="text-xs text-slate-400">系統即將為您轉入首頁...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                目前密碼
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="請輸入原密碼"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                新密碼（6 ~ 8 碼）
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="請輸入 6 ~ 8 碼新密碼"
                maxLength={8}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                再次確認新密碼
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="請再次輸入新密碼"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div className="pt-2 flex items-center space-x-2">
              {!isForced && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>儲存中...</span>
                  </>
                ) : (
                  <span>確認變更</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
