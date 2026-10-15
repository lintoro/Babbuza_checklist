import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, MessageSquare, X, AlertTriangle } from 'lucide-react';

export default function SubmitModal({ isOpen, onClose, resultData }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !resultData) return null;

  const { logId, stats, notifyReport, isLate } = resultData;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(notifyReport);
      } else {
        // Fallback 複製方案
        const textArea = document.createElement('textarea');
        textArea.value = notifyReport;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('複製失敗，請手動複製下方文字區塊');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
        {/* 頂部成功圖示 */}
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">點檢紀錄已成功送出！</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">單號：{logId}</p>

          {isLate && (
            <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-100/90 text-amber-800 text-xs font-bold rounded-full border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>已記錄為「遲交補登」紀錄</span>
            </div>
          )}
        </div>

        {/* 統計摘要卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 text-center py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">總項數</span>
              <span className="font-bold text-slate-700">{stats.total}</span>
            </div>
            <div>
              <span className="text-emerald-500 block text-[10px]">正常</span>
              <span className="font-bold text-emerald-700">{stats.ok}</span>
            </div>
            <div>
              <span className="text-red-500 block text-[10px]">異常</span>
              <span className="font-bold text-red-700">{stats.ng}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">不適用</span>
              <span className="font-bold text-slate-600">{stats.na}</span>
            </div>
          </div>
        )}

        {/* LINE 通報預覽區塊 */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
            <div className="flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>LINE 通報訊息預覽</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">
              可直接貼入工作群組
            </span>
          </div>

          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto select-all border border-slate-800">
            {notifyReport}
          </pre>
        </div>

        {/* 底部按鈕區 */}
        <div className="space-y-2 pt-2">
          {/* 一鍵複製按鈕 */}
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>已複製到剪貼簿！</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>一鍵複製 LINE 通報訊息</span>
              </>
            )}
          </button>

          {/* 關閉按鈕 */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            完成並返回點檢頁面
          </button>
        </div>
      </div>
    </div>
  );
}
