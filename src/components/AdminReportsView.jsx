import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, getTaipeiDateString } from '../api';
import {
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sun,
  Moon,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  Loader2,
} from 'lucide-react';

export default function AdminReportsView() {
  const { token } = useAuth();
  const [stage, setStage] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 14 ? 'CLOSE' : 'OPEN';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    return getTaipeiDateString();
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 載入巡檢總結報表
  const loadReport = async (targetStage, targetDate) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiGet({
        action: 'get_summary_report',
        token,
        stage: targetStage,
        date: targetDate,
      });

      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setErrorMsg(res.error || '載入報表失敗');
      }
    } catch (err) {
      setErrorMsg(err.message || '連線伺服器失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(stage, selectedDate);
  }, [stage, selectedDate]);

  // 一鍵複製 LINE 報表
  const handleCopy = async () => {
    if (!reportData?.reportText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reportData.reportText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = reportData.reportText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('複製失敗，請手動複製文字');
    }
  };

  const stats = reportData?.stats;
  const lists = reportData?.lists;

  return (
    <div className="space-y-4">
      {/* 頂部時段切換與日期選擇 */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                商場巡檢定時總結報表中心
              </h3>
              <p className="text-[11px] text-slate-400">
                每日 11:00 (開店) 與 20:00 (閉店) 站點完成狀況與異常統計
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {/* 日期選擇器 */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 pl-8 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              />
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {/* 重新整理 */}
            <button
              type="button"
              onClick={() => loadReport(stage, selectedDate)}
              disabled={loading}
              title="重新計算產出"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 開店 (11:00) / 閉店 (20:00) 快捷切換按鈕 */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setStage('OPEN')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              stage === 'OPEN'
                ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-2 ring-amber-500/20'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sun className={`w-4 h-4 ${stage === 'OPEN' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>開店總結報表 (11:00 產出)</span>
          </button>

          <button
            type="button"
            onClick={() => setStage('CLOSE')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              stage === 'CLOSE'
                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Moon className={`w-4 h-4 ${stage === 'CLOSE' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>閉店總結報表 (20:00 產出)</span>
          </button>
        </div>
      </div>

      {/* 錯誤警告 */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
          <p>彙整全商場 12 站點巡檢數據與異常紀錄中...</p>
        </div>
      ) : reportData && (
        <>
          {/* 指標總覽儀表板 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 總繳交率 */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">站點繳交率</span>
              <div className="text-xl font-black text-slate-800">
                {stats?.completionRate}%
              </div>
              <span className="text-[10px] text-slate-500">
                已繳 {stats?.submittedCount} / 總 {stats?.totalStations} 站
              </span>
            </div>

            {/* 準時站數 */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-1">
              <span className="text-[11px] text-emerald-600 block font-medium">準時完成</span>
              <div className="text-xl font-black text-emerald-700">
                {stats?.onTimeCount} 站
              </div>
              <span className="text-[10px] text-emerald-600/80">符合截止規範</span>
            </div>

            {/* 遲交站數 */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-1">
              <span className="text-[11px] text-amber-600 block font-medium">遲交完成</span>
              <div className="text-xl font-black text-amber-700">
                {stats?.lateCount} 站
              </div>
              <span className="text-[10px] text-amber-600/80">逾時送出</span>
            </div>

            {/* 缺交站數 */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-1">
              <span className="text-[11px] text-red-600 block font-medium">尚未繳交 (缺交)</span>
              <div className="text-xl font-black text-red-700">
                {stats?.missingCount} 站
              </div>
              <span className="text-[10px] text-red-600/80">未送出點檢</span>
            </div>
          </div>

          {/* 格式化 LINE 通報文字預覽與複製區塊 (核心產出) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  LINE 工作群組標準回報排版文字
                </h4>
              </div>

              <span className="text-[11px] text-slate-400">可一鍵複製貼入通報群組</span>
            </div>

            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto select-all border border-slate-800">
              {reportData.reportText}
            </pre>

            {/* 一鍵複製按鍵 */}
            <button
              type="button"
              onClick={handleCopy}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-99'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>已複製 LINE 通報訊息至剪貼簿！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>一鍵複製 LINE 總結通報訊息</span>
                </>
              )}
            </button>
          </div>

          {/* 站點詳細明細摺疊清單 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">站點繳交狀態明細</h4>

            {/* 缺交站點列表 */}
            {lists?.missing?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-red-600 flex items-center space-x-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>尚未繳交站點 ({lists.missing.length} 站)：</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lists.missing.map((m) => (
                    <div
                      key={m.deptId}
                      className="p-2.5 bg-red-50/60 border border-red-200 rounded-xl text-xs flex items-center justify-between"
                    >
                      <span className="font-bold text-red-900">{m.deptName}</span>
                      <span className="text-[10px] text-red-600 font-mono">
                        截止：{m.deadline}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 遲交站點列表 */}
            {lists?.late?.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-amber-600 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>遲交站點 ({lists.late.length} 站)：</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lists.late.map((l) => (
                    <div
                      key={l.deptId}
                      className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-amber-900">{l.deptName}</span>
                        <span className="text-[10px] text-amber-700 ml-1.5 font-medium">
                          ({l.executor})
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-mono">
                        {l.submitTime} 繳交 (截止 {l.deadline})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 準時完成列表 */}
            {lists?.onTime?.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>準時完成站點 ({lists.onTime.length} 站)：</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lists.onTime.map((o) => (
                    <div
                      key={o.deptId}
                      className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-emerald-900">{o.deptName}</span>
                        <span className="text-[10px] text-emerald-700 ml-1.5 font-medium">
                          ({o.executor})
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        {o.submitTime} 完成
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
