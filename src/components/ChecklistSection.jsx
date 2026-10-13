import React, { useState } from 'react';
import {
  Check,
  X,
  Minus,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Send,
  Loader2,
  CalendarDays,
  Clock,
} from 'lucide-react';

export default function ChecklistSection({
  items = [],
  itemStates,
  onChangeItemStatus,
  onChangeItemRemark,
  onCheckAllOk,
  handoverText,
  onChangeHandoverText,
  onSubmit,
  isSubmitting,
  currentDeptInfo,
  stage = 'OPEN',
}) {
  const startTime = stage === 'OPEN'
    ? (currentDeptInfo?.openStartTime || '09:30')
    : (currentDeptInfo?.closeStartTime || '16:45');
  const deadline = stage === 'OPEN'
    ? (currentDeptInfo?.openDeadline || '10:30')
    : (currentDeptInfo?.closeDeadline || '20:00');

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = (startTime || '09:30').split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const isNotOpenYet = currentMinutes < startMinutes;

  // 分組依據 Category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || '一般項目';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(groupedItems);

  // 控制各分類的摺疊狀態（預設全展開）
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // 計算目前完成度
  const totalCount = items.length;
  const completedCount = items.filter(
    (item) => itemStates[item.itemId]?.status
  ).length;
  const ngCount = items.filter(
    (item) => itemStates[item.itemId]?.status === 'NG'
  ).length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 未到開放時間警告橫幅 */}
      {isNotOpenYet && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center space-x-3 text-amber-900 text-xs">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block text-sm">⏰ 尚未到達開放回報時間</span>
            <span className="text-xs text-amber-700">
              {stage === 'OPEN' ? '營業前 (開店)' : '營業後 (閉店)'} 開放時段為 {startTime} ～ {deadline}，未到時間無法填報送出。
            </span>
          </div>
        </div>
      )}

      {/* 頂部操作與進度條 */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              點檢項目清單
            </h3>
            <p className="text-[11px] text-slate-400">
              進度：{completedCount} / {totalCount} 項 ({progressPercent}%)
              {ngCount > 0 && (
                <span className="text-red-500 font-semibold ml-2">
                  ({ngCount} 項異常)
                </span>
              )}
            </p>
          </div>

          {/* 一鍵全部正常按鈕 */}
          <button
            type="button"
            onClick={onCheckAllOk}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200/60 transition-colors cursor-pointer active:scale-95"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>全部正常 (OK)</span>
          </button>
        </div>

        {/* 視覺進度條 */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 分類 Accordion 區塊 */}
      {categories.map((cat) => {
        const catItems = groupedItems[cat];
        const isCollapsed = collapsedCategories[cat];
        const catDone = catItems.filter((i) => itemStates[i.itemId]?.status).length;
        const catHasNg = catItems.some((i) => itemStates[i.itemId]?.status === 'NG');

        return (
          <div
            key={cat}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
          >
            {/* 分類標頭 */}
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 px-2 py-0.5 rounded-md bg-slate-200/70">
                  {cat}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  ({catDone}/{catItems.length})
                </span>
                {catHasNg && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    異常
                  </span>
                )}
              </div>
              <div className="text-slate-400">
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </button>

            {/* 項目清單 */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {catItems.map((item) => {
                  const currentState = itemStates[item.itemId] || {};
                  const status = currentState.status;
                  const isNg = status === 'NG';

                  return (
                    <div
                      key={item.itemId}
                      className={`p-3.5 space-y-2.5 transition-colors ${
                        isNg ? 'bg-red-50/40' : 'hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* 項目標題與頻率 */}
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
                            {item.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.itemId}
                            </span>
                            {item.frequency && item.frequency !== 'DAILY' && (
                              <span className="inline-flex items-center text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded font-medium">
                                <CalendarDays className="w-2.5 h-2.5 mr-0.5" />
                                {item.frequency}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 三態按鈕切換 (OK / NG / NA) */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => onChangeItemStatus(item.itemId, 'OK')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                              status === 'OK'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>OK</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onChangeItemStatus(item.itemId, 'NG')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                              status === 'NG'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>NG</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onChangeItemStatus(item.itemId, 'NA')}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-0.5 transition-all cursor-pointer ${
                              status === 'NA'
                                ? 'bg-slate-500 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Minus className="w-3 h-3" />
                            <span>NA</span>
                          </button>
                        </div>
                      </div>

                      {/* 若選 NG，展開異常原因備註輸入框 */}
                      {isNg && (
                        <div className="pt-1 animate-fade-in">
                          <div className="flex items-center space-x-1 text-red-600 text-[11px] font-semibold mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>請填寫異常狀況說明（將自動建立報修備忘單）：</span>
                          </div>
                          <textarea
                            rows={2}
                            value={currentState.remark || ''}
                            onChange={(e) =>
                              onChangeItemRemark(item.itemId, e.target.value)
                            }
                            placeholder="請具體描述異常情形（如：開關接觸不良、畫面閃爍等）"
                            className="w-full text-xs p-2.5 bg-white border border-red-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-400 placeholder:text-slate-400"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 交接備忘輸入框 */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-2">
        <label className="block text-xs font-bold text-slate-700">
          📝 今日交接事項 / 特殊備忘（選填）
        </label>
        <textarea
          rows={3}
          value={handoverText}
          onChange={(e) => onChangeHandoverText(e.target.value)}
          placeholder="若有當日現場特殊狀況、活動引導、重要交接等，可在此填寫並一併排版至 LINE 通報訊息..."
          className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
        />
      </div>

      {/* 送出點檢按鈕 */}
      <div className="pt-2 pb-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || totalCount === 0 || isNotOpenYet}
          className={`w-full py-3.5 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all ${
            isNotOpenYet
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-brand-600 hover:bg-brand-700 active:scale-[0.99] shadow-brand-600/30 cursor-pointer'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isNotOpenYet ? (
            <>
              <Clock className="w-4 h-4" />
              <span>⏰ 尚未開放回報 ({startTime} 開放)</span>
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>儲存並產出通報中...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>送出今日巡檢紀錄 ({completedCount}/{totalCount})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
