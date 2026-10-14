import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPost, apiGet } from '../api';
import {
  MessageSquareText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Check,
  History,
  X,
  Loader2
} from 'lucide-react';

export default function HandoverCard({ notes = [], loading = false, onReload = null }) {
  const { token, user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);

  // 結案彈窗狀態
  const [resolvingNote, setResolvingNote] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 查看已結案歷史彈窗狀態
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 送出結案核銷
  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolvingNote) return;

    setIsSubmitting(true);
    try {
      const res = await apiPost({
        action: 'resolve_handover',
        token,
        noteId: resolvingNote.noteId,
        resolution: resolutionText.trim() || '已確認處理完成'
      });

      if (res.success) {
        alert(`已成功結案！核銷人員：${user?.name || user?.userId}`);
        setResolvingNote(null);
        setResolutionText('');
        if (onReload) onReload();
      } else {
        alert(res.error || '結案失敗');
      }
    } catch (err) {
      alert('結案失敗：' + (err.message || '網路錯誤'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 載入已結案歷史
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await apiGet({
        action: 'get_resolved_history',
        token,
        limit: 30
      });
      if (res.success && res.data) {
        setHistoryRecords(res.data.records || []);
      }
    } catch (err) {
      console.warn('載入結案歷史失敗', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 animate-pulse text-xs text-slate-400">
        正在載入站點即時備忘與異常...
      </div>
    );
  }

  // 僅顯示未結案 (OPEN)
  const openNotes = notes.filter((n) => n.status === 'OPEN');
  const openDefects = openNotes.filter((n) => n.type === 'DEFECT');

  return (
    <>
      <div className="bg-amber-50/70 rounded-2xl border border-amber-200/90 overflow-hidden shadow-xs transition-all">
        {/* 標題欄位 */}
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 flex items-center space-x-2 text-left cursor-pointer hover:opacity-80 transition-opacity"
          >
            <MessageSquareText className="w-4 h-4 text-amber-700 shrink-0" />
            <h4 className="text-xs font-bold text-amber-900">
              站點即時備忘與未結案異常 ({openNotes.length} 則)
            </h4>
            {openDefects.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {openDefects.length} 異常
              </span>
            )}
          </button>

          <div className="flex items-center space-x-2">
            {/* 查看已結案歷史按鍵 */}
            <button
              type="button"
              onClick={handleOpenHistory}
              title="查看已結案歷史紀錄"
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium flex items-center space-x-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200/80 rounded-lg transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>結案紀錄</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-amber-700 p-1 cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 展開之備忘內容 */}
        {isExpanded && (
          <div className="px-4 pb-3 pt-1 space-y-2 border-t border-amber-200/50">
            {openNotes.length === 0 ? (
              <div className="py-3 text-center text-xs text-amber-800/80 flex items-center justify-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>目前無未結案之異常或交接事項，全站運作正常！</span>
              </div>
            ) : (
              openNotes.map((note) => {
                const isDefect = note.type === 'DEFECT';

                return (
                  <div
                    key={note.noteId}
                    className={`p-3 rounded-xl text-xs space-y-2 ${
                      isDefect
                        ? 'bg-red-50 border border-red-200 text-red-900'
                        : 'bg-white border border-amber-200/80 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        {isDefect ? (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            設備異常報修
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            現場交接備忘
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {note.bizDate}
                        </span>
                      </div>

                      {/* 全員皆可核銷確認按鍵 */}
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingNote(note);
                          setResolutionText('');
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>結案核銷</span>
                      </button>
                    </div>

                    <p className="text-xs leading-relaxed font-normal">
                      {note.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>提報人員：{note.reporterId || '現場同仁'}</span>
                      <span>時間：{note.createdAt || ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 結案確認對話框彈窗 */}
      {resolvingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Check className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">異常／備忘結案確認</h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingNote(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">欲核銷之項目：</span>
              <p className="text-slate-800 font-medium">{resolvingNote.content}</p>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  處理說明／解決備註
                </label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="例如：已維修完成、已更換耗材、零找金已補齊..."
                  rows={3}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                核銷人員將自動登記為：<span className="font-bold text-emerald-900">{user?.name} ({user?.userId})</span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResolvingNote(null)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>確認結案移除</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 已結案歷史紀錄彈窗 (任何人皆可查看) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <History className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">已結案歷史紀錄</h3>
                  <p className="text-[11px] text-slate-400">全員均可查閱問題與結案詳細歷程</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span>載入已結案歷史紀錄中...</span>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400">目前尚無已結案之歷史紀錄</div>
              ) : (
                historyRecords.map((rec) => (
                  <div
                    key={rec.noteId}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">{rec.deptName || rec.deptId}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                          {rec.type === 'DEFECT' ? '設備報修' : '交接備忘'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                        已結案
                      </span>
                    </div>

                    <p className="text-slate-700">{rec.content}</p>

                    <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100 text-[11px] text-emerald-900 space-y-0.5">
                      <div className="font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>處理說明：{rec.resolution}</span>
                      </div>
                      <div className="text-[10px] text-emerald-700/80 flex items-center justify-between pt-0.5">
                        <span>結案人員：{rec.resolvedBy}</span>
                        <span>結案時間：{rec.resolvedAt}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
