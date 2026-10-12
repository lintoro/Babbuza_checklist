import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, KeyRound, RefreshCw, ShieldCheck, Users, ClipboardCheck } from 'lucide-react';

export default function Navbar({ onOpenChangePwd, viewMode, onToggleViewMode }) {
  const { user, logout, refreshDepts } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDepts();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* 左側 LOGO 與標題 */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-sm tracking-tight leading-none">
              Babbuza 巡檢
            </h1>
            <span className="text-[10px] text-slate-400 font-medium">
              {viewMode === 'admin' ? '系統管理後台中心' : '商場日常點檢系統'}
            </span>
          </div>
        </div>

        {/* 右側操作按鈕 */}
        {user && (
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* 管理員專用：切換後台管理 / 巡檢作業 */}
            {isAdmin && (
              <button
                type="button"
                onClick={onToggleViewMode}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'admin'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700'
                }`}
                title={viewMode === 'admin' ? '返回巡檢點檢作業' : '切換至系統管理後台'}
              >
                {viewMode === 'admin' ? (
                  <>
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">回巡檢</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span className="hidden sm:inline">後台管理</span>
                  </>
                )}
              </button>
            )}


            {/* 人員名稱標籤 */}
            <div className="flex items-center space-x-1 bg-slate-100 py-1 px-2 rounded-full text-xs text-slate-700">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium max-w-16 truncate">{user.name}</span>
              {isAdmin && (
                <span className="text-[10px] bg-purple-200 text-purple-800 px-1 py-0.2 rounded font-bold">
                  管
                </span>
              )}
            </div>

            {/* 變更密碼 */}
            <button
              onClick={onOpenChangePwd}
              title="變更個人密碼"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* 重新整理 */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="重新載入"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            </button>

            {/* 登出 */}
            <button
              onClick={logout}
              title="登出系統"
              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
