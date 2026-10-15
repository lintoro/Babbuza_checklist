import React from 'react';
import { Store, Sun, Moon, Clock, CheckCircle2 } from 'lucide-react';

export default function StationSelector({
  departments,
  selectedDeptId,
  onSelectDept,
  stage,
  onSelectStage,
  deptStatus,
  currentDeptInfo,
}) {
  const openStatus = deptStatus?.open || deptStatus?.OPEN;
  const closeStatus = deptStatus?.close || deptStatus?.CLOSE;
  const isOpenCompleted = Boolean(openStatus?.isSubmitted || openStatus?.completed);
  const isCloseCompleted = Boolean(closeStatus?.isSubmitted || closeStatus?.completed);

  const formatShortTime = (t) => {
    if (!t) return '';
    const str = String(t).trim();
    if (str.includes('T') || str.includes('Z')) {
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('zh-TW', {
            timeZone: 'Asia/Taipei',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        }
      } catch (e) {}
    }
    if (str.includes(' ')) return str.split(' ')[1].slice(0, 5);
    return str.slice(0, 5);
  };

  const openStart = currentDeptInfo?.openStartTime || '09:30';
  const openDead = currentDeptInfo?.openDeadline || '10:30';
  const closeStart = currentDeptInfo?.closeStartTime || '16:45';
  const closeDead = currentDeptInfo?.closeDeadline || '20:00';

  // 取得當前台北時間分鐘數
  const getTaipeiMinutes = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()).split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    } catch {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
  };

  const currentMinutes = getTaipeiMinutes();
  const parseMinutes = (tStr, defaultVal) => {
    const [h, m] = (tStr || defaultVal).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const openStartMin = parseMinutes(openStart, '09:30');
  const openDeadMin = parseMinutes(openDead, '10:30');
  const closeStartMin = parseMinutes(closeStart, '16:45');
  const closeDeadMin = parseMinutes(closeDead, '20:00');

  // 渲染時段狀態標籤
  const renderStatusBadge = (isCompleted, statusObj, startMin, deadMin) => {
    if (isCompleted) {
      if (statusObj?.isLate) {
        return (
          <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300/60">
            ✓ 遲交完成 ({formatShortTime(statusObj?.submitTime)})
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
          ✓ 已於 {formatShortTime(statusObj?.submitTime)} 完成
        </span>
      );
    }

    if (currentMinutes < startMin) {
      return (
        <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
          未到開放時間
        </span>
      );
    }

    if (currentMinutes > deadMin) {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
          ⚠️ 逾期未檢 (可補登)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
        待點檢
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-4">
      {/* 站點選擇下拉選單 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-500 flex items-center space-x-1.5">
            <Store className="w-3.5 h-3.5 text-brand-600" />
            <span>巡檢站點</span>
          </label>
          {departments.length > 1 && (
            <span className="text-[11px] text-slate-400">
              共授權 {departments.length} 個站點
            </span>
          )}
        </div>

        <div className="relative">
          <select
            value={selectedDeptId}
            onChange={(e) => onSelectDept(e.target.value)}
            className="w-full py-2.5 px-3.5 pr-8 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white appearance-none cursor-pointer transition-all"
          >
            {departments.map((dept) => (
              <option key={dept.deptId} value={dept.deptId}>
                {dept.deptName} ({dept.deptId})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 營業時段切換卡片 (開站 / 閉站) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* 營業前 (OPEN) */}
        <button
          type="button"
          onClick={() => onSelectStage('OPEN')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            stage === 'OPEN'
              ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-500/20'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1.5">
              <Sun className={`w-4 h-4 ${stage === 'OPEN' ? 'text-amber-500' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${stage === 'OPEN' ? 'text-brand-900' : 'text-slate-700'}`}>
                營業前 (開店)
              </span>
            </div>
            {isOpenCompleted && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>開放：{openStart} ~ {openDead}</span>
          </div>

          {/* 狀態標籤 */}
          <div className="mt-2 flex items-center">
            {renderStatusBadge(isOpenCompleted, openStatus, openStartMin, openDeadMin)}
          </div>
        </button>

        {/* 營業後 (CLOSE) */}
        <button
          type="button"
          onClick={() => onSelectStage('CLOSE')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            stage === 'CLOSE'
              ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1.5">
              <Moon className={`w-4 h-4 ${stage === 'CLOSE' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${stage === 'CLOSE' ? 'text-indigo-950' : 'text-slate-700'}`}>
                營業後 (閉店)
              </span>
            </div>
            {isCloseCompleted && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>開放：{closeStart} ~ {closeDead}</span>
          </div>

          {/* 狀態標籤 */}
          <div className="mt-2 flex items-center">
            {renderStatusBadge(isCloseCompleted, closeStatus, closeStartMin, closeDeadMin)}
          </div>
        </button>
      </div>
    </div>
  );
}
