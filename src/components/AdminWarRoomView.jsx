import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, getTaipeiDateString } from '../api';
import {
  LayoutGrid,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Download,
  Calendar,
  Store,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Check,
  X,
  MessageSquare,
  Search,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

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

// 中華民國 2026 ~ 2027 年重要國定假日與連續假期清冊
const HOLIDAY_MAP = {
  // 2026 年
  '2026-01-01': '元旦',
  '2026-02-14': '春節連假',
  '2026-02-15': '除夕',
  '2026-02-16': '春節初一',
  '2026-02-17': '春節初二',
  '2026-02-18': '春節初三',
  '2026-02-19': '春節初四',
  '2026-02-20': '春節初五',
  '2026-02-21': '春節連假',
  '2026-02-22': '春節連假',
  '2026-02-27': '228補假',
  '2026-02-28': '228紀念日',
  '2026-04-03': '兒童節補假',
  '2026-04-04': '兒童節',
  '2026-04-05': '清明節',
  '2026-04-06': '清明補假',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-06-20': '端午連假',
  '2026-06-21': '端午連假',
  '2026-09-25': '中秋節',
  '2026-09-26': '中秋連假',
  '2026-09-27': '中秋連假',
  '2026-10-09': '國慶補假',
  '2026-10-10': '國慶日',
  '2026-10-11': '國慶連假',
  // 2027 年
  '2027-01-01': '元旦',
  '2027-01-02': '元旦連假',
  '2027-01-03': '元旦連假',
  '2027-02-05': '除夕前一日',
  '2027-02-06': '除夕',
  '2027-02-07': '春節初一',
  '2027-02-08': '春節初二',
  '2027-02-09': '春節初三',
  '2027-02-10': '春節初四',
  '2027-02-11': '春節初五',
  '2027-02-12': '春節連假',
  '2027-02-13': '春節連假',
  '2027-02-14': '春節連假',
  '2027-02-26': '228補假',
  '2027-02-27': '228連假',
  '2027-02-28': '228紀念日',
  '2027-03-01': '228補假',
  '2027-04-02': '兒童節補假',
  '2027-04-03': '清明連假',
  '2027-04-04': '兒童節',
  '2027-04-05': '清明節',
  '2027-04-06': '清明補假',
  '2027-05-01': '勞動節',
  '2027-06-09': '端午節',
  '2027-09-15': '中秋節',
  '2027-10-08': '國慶補假',
  '2027-10-10': '國慶日',
  '2027-10-11': '國慶補假'
};

/**
 * 格式化日期欄位：例如 10-13(二) 或 10-10(六)(國慶日)
 */
function formatDateHeader(dateStr, customHolidays = {}) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const parts = dateStr.split('-');
  const mmdd = `${parts[1]}-${parts[2]}`;
  const d = new Date(`${dateStr}T00:00:00`);
  const dayName = !isNaN(d.getTime()) ? WEEK_DAYS[d.getDay()] : '';

  // 優先由後端 Calendar 取得，次之由內建 HOLIDAY_MAP 比對
  let holiday = (customHolidays && customHolidays[dateStr]) || HOLIDAY_MAP[dateStr] || '';
  if (holiday) {
    holiday = holiday.replace(/\s*\([^)]*\)/g, '').trim();
    return `${mmdd}(${dayName})(${holiday})`;
  }
  return `${mmdd}(${dayName})`;
}

/**
 * 將巡檢戰情矩陣資料轉換為 XLSX 工作表物件
 */
function createMatrixWorksheet(matrixData, XLSX) {
  if (!matrixData || !matrixData.items || !XLSX) return null;
  const dates = matrixData.dates || [];

  // 建立表頭列
  const headerRow = [
    '大類別',
    '點檢項目',
    ...dates.map((d) => formatDateHeader(d, matrixData.holidays))
  ];
  const rows = [headerRow];

  // 填入每一列題目與日期紀錄
  matrixData.items.forEach((item) => {
    const cat = item.category || '';
    const title = item.title || '';
    const rowCols = dates.map((d) => {
      const rec = item.records?.[d];
      if (!rec || !rec.executed) return '未執行';
      const statusZh = rec.status === 'OK' ? '正常' : rec.status === 'NG' ? '異常' : '不適用';
      const remark = rec.remark ? ` [${rec.remark}]` : '';
      const execTime = formatShortTime(rec.submitTime);
      const execInfo = rec.executor ? ` (${rec.executor} ${execTime})` : '';
      return `${statusZh}${execInfo}${remark}`;
    });
    rows.push([cat, title, ...rowCols]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 自適應欄寬
  const colWidths = [
    { wch: 18 },
    { wch: 32 },
    ...dates.map(() => ({ wch: 24 }))
  ];
  ws['!cols'] = colWidths;

  return ws;
}

export default function AdminWarRoomView() {
  const { token, user: currentUser, departments: authDepartments } = useAuth();
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'issues' | 'resolved'

  // 1. 戰情矩陣狀態
  const [deptId, setDeptId] = useState('1F');
  const [stage, setStage] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 14 ? 'CLOSE' : 'OPEN';
  });
  const [matrixData, setMatrixData] = useState(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [departments, setDepartments] = useState(() => authDepartments || []);
  const tableContainerRef = useRef(null);

  // 匯出相關狀態 (單一單位雙分頁與多單位批次單一總表)
  const [isExportingSingle, setIsExportingSingle] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedDeptIds, setSelectedDeptIds] = useState(() => (authDepartments || []).map((d) => d.deptId));
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: '' });

  // 2. 未結案異常集中看板狀態
  const [issuesData, setIssuesData] = useState(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueSubTab, setIssueSubTab] = useState('DEFECT'); // 'DEFECT' (設備報修) 或 'HANDOVER' (交接備忘)
  const [resolvingNote, setResolvingNote] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // 3. 已結案歷史紀錄狀態
  const [resolvedData, setResolvedData] = useState(null);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolvedSubTab, setResolvedSubTab] = useState('DEFECT'); // 'DEFECT' (設備報修) 或 'HANDOVER' (交接備忘)

  // 載入站點清單 (若 AuthContext 已有則直接複用，否則才透過 API 載入)
  const loadDepts = async () => {
    if (authDepartments && authDepartments.length > 0) {
      setDepartments(authDepartments);
      setSelectedDeptIds(authDepartments.map((d) => d.deptId));
      return;
    }
    try {
      const res = await apiGet({ action: 'get_user_depts', token });
      if (res.success && res.data) {
        const list = res.data.departments || [];
        setDepartments(list);
        setSelectedDeptIds(list.map((d) => d.deptId)); // 預設全選所有單位
      }
    } catch (err) {
      console.warn('載入站點失敗', err);
    }
  };

  // 載入巡檢戰情矩陣
  const loadMatrix = async (targetDept, targetStage) => {
    setLoadingMatrix(true);
    try {
      const res = await apiGet({
        action: 'get_inspection_matrix',
        token,
        deptId: targetDept,
        stage: targetStage
      });
      if (res.success && res.data) {
        setMatrixData(res.data);
      }
    } catch (err) {
      console.warn('載入巡檢矩陣失敗', err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  // 載入未結案異常追蹤
  const loadIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await apiGet({ action: 'get_open_issues', token });
      if (res.success && res.data) {
        setIssuesData(res.data);
      }
    } catch (err) {
      console.warn('載入未結案異常失敗', err);
    } finally {
      setLoadingIssues(false);
    }
  };

  // 載入已結案歷史
  const loadResolved = async () => {
    setLoadingResolved(true);
    try {
      const res = await apiGet({ action: 'get_resolved_history', token, limit: 100 });
      if (res.success && res.data) {
        setResolvedData(res.data);
      }
    } catch (err) {
      console.warn('載入已結案歷史失敗', err);
    } finally {
      setLoadingResolved(false);
    }
  };

  useEffect(() => {
    loadDepts();
  }, []);

  useEffect(() => {
    if (activeTab === 'matrix') {
      loadMatrix(deptId, stage);
    } else if (activeTab === 'issues') {
      loadIssues();
    } else if (activeTab === 'resolved') {
      loadResolved();
    }
  }, [activeTab, deptId, stage]);

  // 當矩陣資料載入完成，直接定位至當時日期 (免手動拉動)
  useEffect(() => {
    if (activeTab === 'matrix' && matrixData && matrixData.dates && tableContainerRef.current) {
      const todayStr = getTaipeiDateString();
      const targetDate = matrixData.dates.includes(todayStr)
        ? todayStr
        : matrixData.dates[matrixData.dates.length - 1];

      const timer = setTimeout(() => {
        const targetEl = document.getElementById(`th-date-${targetDate}`);
        if (targetEl && tableContainerRef.current) {
          // 凍結前兩欄寬度：7rem + 13rem = 320px
          const freezeOffset = 320;
          const scrollTarget = Math.max(0, targetEl.offsetLeft - freezeOffset);
          tableContainerRef.current.scrollTo({
            left: scrollTarget,
            behavior: 'smooth'
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, matrixData]);

  // 全員核銷結案確認
  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolvingNote) return;

    setIsSubmittingResolve(true);
    try {
      const res = await apiPost({
        action: 'resolve_handover',
        token,
        noteId: resolvingNote.noteId,
        resolution: resolutionText.trim() || '已確認處理完成'
      });

      if (res.success) {
        alert(`已成功結案！核銷人員：${currentUser?.name || currentUser?.userId}`);
        setResolvingNote(null);
        setResolutionText('');
        loadIssues(); // 重新載入，該筆項目立即自集中看板移除！
      } else {
        alert(res.error || '結案失敗');
      }
    } catch (err) {
      alert('結案失敗：' + (err.message || '網路錯誤'));
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // 1. 匯出當前單位完整 Excel (包含開店與閉店雙分頁)
  const handleExportCurrentDept = async () => {
    if (!deptId) return;
    setIsExportingSingle(true);
    try {
      const XLSX = await import('xlsx');
      const curDeptObj = departments.find((d) => d.deptId === deptId);
      const deptName = curDeptObj?.deptName || deptId;

      // 同時請求該單位的 OPEN 與 CLOSE 矩陣
      const [resOpen, resClose] = await Promise.all([
        apiGet({ action: 'get_inspection_matrix', token, deptId, stage: 'OPEN' }),
        apiGet({ action: 'get_inspection_matrix', token, deptId, stage: 'CLOSE' })
      ]);

      const wb = XLSX.utils.book_new();

      if (resOpen?.success && resOpen?.data) {
        const wsOpen = createMatrixWorksheet(resOpen.data, XLSX);
        if (wsOpen) XLSX.utils.book_append_sheet(wb, wsOpen, '營業前 (開店)');
      }

      if (resClose?.success && resClose?.data) {
        const wsClose = createMatrixWorksheet(resClose.data, XLSX);
        if (wsClose) XLSX.utils.book_append_sheet(wb, wsClose, '營業後 (閉店)');
      }

      const todayStr = getTaipeiDateString();
      XLSX.writeFile(wb, `${deptName}_巡檢戰情報表_${todayStr}.xlsx`);
    } catch (err) {
      console.error('匯出單一單位失敗:', err);
      alert('匯出 Excel 發生錯誤，請稍後再試');
    } finally {
      setIsExportingSingle(false);
    }
  };

  // 勾選/取消單一單位
  const toggleDeptSelection = (id) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 切換全選 / 全取消
  const toggleSelectAll = () => {
    if (selectedDeptIds.length === departments.length) {
      setSelectedDeptIds([]);
    } else {
      setSelectedDeptIds(departments.map((d) => d.deptId));
    }
  };

  // 2. 批次匯出選取單位之綜合 Excel 總表 (單次呼叫後端批次矩陣端點，純記憶體組裝，秒級匯出)
  const handleExportBatchDepts = async () => {
    const targetDeptIds = departments
      .map((d) => d.deptId)
      .filter((id) => selectedDeptIds.includes(id));

    if (targetDeptIds.length === 0) {
      alert('請至少勾選一個要下載的單位！');
      return;
    }

    setIsExportingBatch(true);
    setBatchProgress({ current: 0, total: targetDeptIds.length, currentName: '向雲端請求批次數據中...' });

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const todayStr = getTaipeiDateString();

      // 單次批次向後端獲取所有站點的矩陣資料 (消除 16 次重複請求)
      const resBatch = await apiGet({
        action: 'get_batch_inspection_matrix',
        token,
        deptIds: targetDeptIds.join(','),
        stages: 'OPEN,CLOSE'
      });

      const matrices = resBatch?.data?.matrices || {};

      for (let i = 0; i < targetDeptIds.length; i++) {
        const dId = targetDeptIds[i];
        const deptObj = departments.find((d) => d.deptId === dId);
        const deptName = deptObj?.deptName || dId;

        setBatchProgress({
          current: i + 1,
          total: targetDeptIds.length,
          currentName: deptName
        });

        const cleanDeptPrefix = deptName.replace(/[:\\/?*\[\]]/g, '').slice(0, 22);

        const matrixOpen = matrices[`${dId}_OPEN`];
        if (matrixOpen) {
          const wsOpen = createMatrixWorksheet(matrixOpen, XLSX);
          if (wsOpen) {
            XLSX.utils.book_append_sheet(wb, wsOpen, `${cleanDeptPrefix}-開店`);
          }
        }

        const matrixClose = matrices[`${dId}_CLOSE`];
        if (matrixClose) {
          const wsClose = createMatrixWorksheet(matrixClose, XLSX);
          if (wsClose) {
            XLSX.utils.book_append_sheet(wb, wsClose, `${cleanDeptPrefix}-閉店`);
          }
        }
      }

      // 下載單一綜合 Excel 檔案
      XLSX.writeFile(wb, `Babbuza_商場巡檢總表_全單位綜合_${todayStr}.xlsx`);
      setIsBatchModalOpen(false);
    } catch (err) {
      console.error('批次匯出失敗:', err);
      alert('批次匯出 Excel 發生錯誤，請稍後再試');
    } finally {
      setIsExportingBatch(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 頂部戰情中心分頁 Tabs */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs flex items-center">
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>站點項目執行戰情報表</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('issues')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer relative ${
            activeTab === 'issues'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
          <span>全商場未結案異常追蹤</span>
          {issuesData?.totalOpen > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {issuesData.totalOpen}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolved')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            activeTab === 'resolved'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>已結案歷史紀錄</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 分頁 1：站點項目執行戰情報表 (如同原始 Excel 矩陣，顯示打勾、執行人與時間) */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  即時巡檢戰情報表 (執行矩陣看板)
                </h3>
                <p className="text-[11px] text-slate-400">
                  比照原始試算表矩陣架構，即時查驗各項目執行落實狀況、執行人與完成精確時間
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              {/* 匯出目前單位 Excel (含開店/閉店雙分頁) */}
              <button
                type="button"
                onClick={() => handleExportCurrentDept(deptId)}
                disabled={isExportingSingle || isExportingBatch}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="匯出目前單位的開店前與營業後雙分頁 Excel 檔案"
              >
                {isExportingSingle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>匯出目前單位 (雙分頁)</span>
              </button>

              {/* 批次勾選匯出總表按鈕 */}
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                disabled={isExportingSingle || isExportingBatch}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="勾選多個或全部單位，匯出包含所有單位的單一 Excel 總表"
              >
                <Download className="w-3.5 h-3.5" />
                <span>批次勾選匯出總表</span>
              </button>

              {/* 重新整理 */}
              <button
                type="button"
                onClick={() => loadMatrix(deptId, stage)}
                disabled={loadingMatrix}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMatrix ? 'animate-spin text-purple-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* 控制列：站點切換與時段切換 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* 站點選擇 */}
            <div className="flex items-center space-x-2">
              <Store className="w-4 h-4 text-purple-600 shrink-0" />
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptId}>
                    {d.deptName} ({d.deptId})
                  </option>
                ))}
              </select>
            </div>

            {/* 開店 / 閉店 切換 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setStage('OPEN')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  stage === 'OPEN'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>營業前 (開店)</span>
              </button>

              <button
                type="button"
                onClick={() => setStage('CLOSE')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  stage === 'CLOSE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>營業後 (閉店)</span>
              </button>
            </div>
          </div>

          {/* 矩陣大看板展示 (重現原始 Excel 格式) */}
          {loadingMatrix ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
              <span>載入 {matrixData?.deptName || deptId} 巡檢戰情矩陣中...</span>
            </div>
          ) : !matrixData || !matrixData.items?.length ? (
            <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
              查無此站點與時段適用點檢項目或紀錄
            </div>
          ) : (
            <div
              ref={tableContainerRef}
              className="overflow-auto max-h-[72vh] border border-slate-300 rounded-xl shadow-xs relative bg-white"
            >
              <table className="w-full border-collapse text-xs text-left">
                {/* 凍結表頭列 (Sticky Header) */}
                <thead className="sticky top-0 z-30 select-none shadow-xs">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {/* 凍結第一欄：分類 (Sticky Left 0, Z-index 40) */}
                    <th className="sticky top-0 left-0 z-40 bg-slate-100 border-r border-b-2 border-slate-300 font-black text-slate-800 w-28 min-w-[7rem] max-w-[7rem] py-2.5 px-3 text-left">
                      分類
                    </th>

                    {/* 凍結第二欄：點檢項目 (Sticky Left 7rem, Z-index 40) */}
                    <th className="sticky top-0 left-[7rem] z-40 bg-slate-100 border-r-2 border-b-2 border-slate-300 font-black text-slate-800 w-52 min-w-[13rem] max-w-[13rem] py-2.5 px-3 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                      點檢項目
                    </th>

                    {/* 日期欄位 (向右延伸可橫向捲動，頂部固定) */}
                    {matrixData.dates.map((dateStr) => {
                      const summary = matrixData.daySummaries?.[dateStr];
                      const isToday = dateStr === getTaipeiDateString();
                      const headerTitle = formatDateHeader(dateStr, matrixData.holidays);
                      const isHoliday = Boolean(
                        (matrixData.holidays && matrixData.holidays[dateStr]) ||
                          HOLIDAY_MAP[dateStr]
                      );

                      return (
                        <th
                          key={dateStr}
                          id={`th-date-${dateStr}`}
                          className={`sticky top-0 z-20 py-2.5 px-2 border-r border-b-2 text-center font-bold min-w-[130px] transition-colors ${
                            isToday
                              ? 'bg-slate-300 text-slate-900 border-slate-400 font-black ring-1 ring-inset ring-slate-400'
                              : isHoliday
                              ? 'bg-amber-50 text-slate-900 border-slate-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          <div
                            className={`font-mono text-[11px] leading-tight tracking-tight whitespace-nowrap ${
                              isHoliday ? 'text-amber-800 font-extrabold' : ''
                            }`}
                          >
                            <span>{headerTitle}</span>
                          </div>
                          {summary ? (
                            <div className="text-[10px] text-emerald-700 font-normal mt-0.5 whitespace-nowrap">
                              ✓ {summary.executorName}
                            </div>
                          ) : (
                            <div className="text-[10px] text-red-500 font-normal mt-0.5 whitespace-nowrap">
                              未繳交
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* 表身項目矩陣 */}
                <tbody className="divide-y divide-slate-200 bg-white">
                  {matrixData.items.map((item) => (
                    <tr key={item.itemId} className="hover:bg-slate-50 transition-colors">
                      {/* 凍結第一欄：分類 (Sticky Left 0, Z-index 10) */}
                      <td className="sticky left-0 z-10 bg-slate-50 border-r border-b border-slate-200 font-bold text-slate-800 w-28 min-w-[7rem] max-w-[7rem] py-2.5 px-3">
                        {item.category}
                      </td>

                      {/* 凍結第二欄：點檢項目 (Sticky Left 7rem, Z-index 10) */}
                      <td className="sticky left-[7rem] z-10 bg-white border-r-2 border-b border-slate-200 font-medium text-slate-900 w-52 min-w-[13rem] max-w-[13rem] py-2.5 px-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                        {item.title}
                      </td>

                      {/* 日期欄位資料格 */}
                      {matrixData.dates.map((dateStr) => {
                        const rec = item.records?.[dateStr];
                        const isToday = dateStr === getTaipeiDateString();

                        if (!rec || !rec.executed) {
                          return (
                            <td
                              key={dateStr}
                              className={`py-2 px-2 border-r border-b border-slate-200 text-center text-slate-300 min-w-[130px] ${
                                isToday ? 'bg-slate-100/70' : 'bg-slate-50/30'
                              }`}
                            >
                              —
                            </td>
                          );
                        }

                        const isOk = rec.status === 'OK';
                        const isNg = rec.status === 'NG';

                        return (
                          <td
                            key={dateStr}
                            className={`py-2 px-2 border-r border-b border-slate-200 text-center font-mono min-w-[130px] ${
                              isNg
                                ? 'bg-red-50/90 text-red-950 font-bold'
                                : isToday
                                ? 'bg-slate-100/80 text-emerald-950'
                                : 'bg-emerald-50/20 text-emerald-950'
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              {/* 打勾 ✔ 或 異常 ❌ 符號 */}
                              {isOk ? (
                                <span className="inline-block text-emerald-600 font-black text-sm">
                                  ✔
                                </span>
                              ) : isNg ? (
                                <span className="inline-block text-red-600 font-black text-xs px-1.5 py-0.5 rounded bg-red-100">
                                  ❌ 異常
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">NA</span>
                              )}

                              {/* 執行人與時間 (直接顯示於畫面上) */}
                              <div className="text-[10px] text-slate-600 leading-tight">
                                <span className="font-semibold block">{rec.executorName}</span>
                                <span className="text-slate-400 text-[9px]">{formatShortTime(rec.submitTime)}</span>
                              </div>

                              {rec.remark && (
                                <span
                                  className="text-[9px] text-red-600 font-medium truncate max-w-[100px]"
                                  title={rec.remark}
                                >
                                  {rec.remark}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 分頁 2：全商場未結案異常集中追蹤看板 (條列集中顯示，直到被解決才移除) */}
      {/* ========================================================================= */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  全商場未結案異常集中追蹤看板
                </h3>
                <p className="text-[11px] text-slate-400">
                  集中列管各站點回報之未結案異常與交接事項，全員皆可核銷確認，直到被解決才移除
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadIssues}
              disabled={loadingIssues}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingIssues ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>

          {loadingIssues ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
              <span>載入未結案異常紀錄中...</span>
            </div>
          ) : !issuesData || issuesData.issues?.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-emerald-50/50 rounded-xl border border-emerald-200 text-emerald-800 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">目前全商場無任何未結案之異常項目！</p>
              <p className="text-emerald-700 text-[11px]">所有站點運作正常，設備皆維持良善狀態。</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* 二級分類 Tab 切換：報修 / 交接 (進入預設鎖定報修) */}
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setIssueSubTab('DEFECT')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    issueSubTab === 'DEFECT'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🚨 設備報修</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      issueSubTab === 'DEFECT'
                        ? 'bg-red-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {issuesData.defectCount ?? issuesData.issues?.filter(n => n.type === 'DEFECT').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIssueSubTab('HANDOVER')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    issueSubTab === 'HANDOVER'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📋 現場交接</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      issueSubTab === 'HANDOVER'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {issuesData.handoverCount ?? issuesData.issues?.filter(n => n.type === 'HANDOVER').length}
                  </span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  {issueSubTab === 'DEFECT'
                    ? `待處理設備報修共 ${issuesData.defectCount ?? issuesData.issues?.filter(n => n.type === 'DEFECT').length} 則`
                    : `現場交接事項共 ${issuesData.handoverCount ?? issuesData.issues?.filter(n => n.type === 'HANDOVER').length} 則（逾 3 日未核銷將自動結案封存）`}
                </span>
                <span className="text-slate-400">全員皆可核銷結案</span>
              </div>

              {issuesData.issues.filter((n) => n.type === issueSubTab).length === 0 ? (
                <div className="py-12 text-center space-y-1.5 bg-slate-50 rounded-xl border border-slate-200/60 text-slate-500 text-xs">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-700">
                    {issueSubTab === 'DEFECT'
                      ? '目前無任何未結案之設備報修項目！'
                      : '目前無列管中之現場交接備忘！'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {issueSubTab === 'DEFECT'
                      ? '所有站點設備運作正常。'
                      : '交接備忘若超過 3 日未核銷，系統已自動收入結案歷史。'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {issuesData.issues
                    .filter((issue) => issue.type === issueSubTab)
                    .map((issue) => (
                      <div
                        key={issue.noteId}
                        className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-xs space-y-2.5 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {/* 站點名稱標籤 */}
                            <span className="text-xs font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                              {issue.deptName}
                            </span>

                            {/* 類型標籤 */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                issue.type === 'DEFECT'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {issue.type === 'DEFECT' ? '設備報修' : '交接備忘'}
                            </span>

                            {/* 累積天數警示 */}
                            {issue.pendingDays > 0 ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>已待處理 {issue.pendingDays} 天</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">今日提報</span>
                            )}
                          </div>

                          {/* 全員核銷結案按鈕 */}
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingNote(issue);
                              setResolutionText('');
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>結案核銷</span>
                          </button>
                        </div>

                        {/* 異常內容描述 */}
                        <p className="text-xs text-slate-800 leading-relaxed font-normal bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {issue.content}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>提報人員：{issue.reporterName || issue.reporterId}</span>
                          <span>提報時間：{issue.createdAt}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 分頁 3：已結案歷史紀錄 (任何人皆可點開查看結案資料) */}
      {/* ========================================================================= */}
      {activeTab === 'resolved' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">已結案歷史紀錄查詢</h3>
                <p className="text-[11px] text-slate-400">
                  記錄所有過去被核銷處理的問題、解決說明、結案人工號與結案時間
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadResolved}
              disabled={loadingResolved}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingResolved ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>

          {loadingResolved ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
              <span>載入已結案歷史紀錄中...</span>
            </div>
          ) : !resolvedData || resolvedData.records?.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
              目前尚無已結案之歷史資料
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* 二級分類 Tab 切換：報修 / 交接 (進入預設鎖定報修) */}
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setResolvedSubTab('DEFECT')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    resolvedSubTab === 'DEFECT'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🔧 設備報修紀錄</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      resolvedSubTab === 'DEFECT'
                        ? 'bg-purple-800 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {(resolvedData.records || []).filter((r) => r.type === 'DEFECT').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setResolvedSubTab('HANDOVER')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    resolvedSubTab === 'HANDOVER'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📋 現場交接紀錄</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      resolvedSubTab === 'HANDOVER'
                        ? 'bg-purple-800 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {(resolvedData.records || []).filter((r) => r.type === 'HANDOVER').length}
                  </span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                {resolvedSubTab === 'DEFECT'
                  ? `已結案之設備報修歷程共 ${(resolvedData.records || []).filter((r) => r.type === 'DEFECT').length} 筆`
                  : `已結案之現場交接歷程共 ${(resolvedData.records || []).filter((r) => r.type === 'HANDOVER').length} 筆（含逾 3 日系統自動結案備忘）`}
              </div>

              {(resolvedData.records || []).filter((r) => r.type === resolvedSubTab).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200/60">
                  {resolvedSubTab === 'DEFECT'
                    ? '目前尚無已結案之設備報修歷史紀錄'
                    : '目前尚無已結案之現場交接歷史紀錄'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {(resolvedData.records || [])
                    .filter((r) => r.type === resolvedSubTab)
                    .map((rec) => (
                      <div
                        key={rec.noteId}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{rec.deptName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                              {rec.type === 'DEFECT' ? '設備報修' : '交接備忘'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {rec.bizDate}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            已核銷結案
                          </span>
                        </div>

                        <p className="text-slate-700 leading-relaxed font-medium">
                          {rec.content}
                        </p>

                        <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-950 space-y-1">
                          <div className="font-bold flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>處理說明：{rec.resolution}</span>
                          </div>
                          <div className="text-[10px] text-emerald-800 flex items-center justify-between pt-0.5 border-t border-emerald-100">
                            <span>核銷人員：<b>{rec.resolvedBy}</b></span>
                            <span>結案時間：{rec.resolvedAt}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 結案確認核銷彈窗 (全員皆可操作) */}
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
                  placeholder="處理說明（非必填，空白將自動預設為「已確認處理完成」）..."
                  rows={3}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                核銷人員將自動登記為：<span className="font-bold text-emerald-900">{currentUser?.name} ({currentUser?.userId})</span>
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
                  disabled={isSubmittingResolve}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50"
                >
                  {isSubmittingResolve ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>確認核銷並移除</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 批次勾選匯出總表彈窗 */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">批次勾選匯出商場巡檢總表</h4>
                  <p className="text-[11px] text-slate-400">
                    下載單一 Excel 檔案，內含所選各單位的開店前與營業後分頁
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isExportingBatch && setIsBatchModalOpen(false)}
                disabled={isExportingBatch}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 說明與控制按鈕 */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-xs">
              <span className="font-medium text-slate-600">
                已選取 <span className="font-bold text-indigo-600">{selectedDeptIds.length}</span> / {departments.length} 個單位
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={isExportingBatch}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {selectedDeptIds.length === departments.length ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>全部取消</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>全部選取</span>
                  </>
                )}
              </button>
            </div>

            {/* 單位勾選網格清單 */}
            <div className="max-h-60 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {departments.map((dept) => {
                const isChecked = selectedDeptIds.includes(dept.deptId);
                return (
                  <label
                    key={dept.deptId}
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-50/50 border-indigo-300 text-indigo-950 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${isExportingBatch ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDeptSelection(dept.deptId)}
                      disabled={isExportingBatch}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="truncate">
                      <div className="font-bold truncate">{dept.deptName}</div>
                      <div className="text-[10px] text-slate-400">{dept.deptId}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* 匯出進度指示條 */}
            {isExportingBatch && (
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <div className="flex items-center space-x-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>正在獲取資料：{batchProgress.currentName}...</span>
                  </div>
                  <span>
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                disabled={isExportingBatch}
                className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExportBatchDepts}
                disabled={isExportingBatch || selectedDeptIds.length === 0}
                className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isExportingBatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在產生綜合總表...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>確認匯出單一 Excel ({selectedDeptIds.length} 個單位)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
