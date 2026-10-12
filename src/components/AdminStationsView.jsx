import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import {
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  PlusCircle,
  Calendar,
  Sparkles,
  ChevronRight,
  Database,
  ArrowRight,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  RotateCcw
} from 'lucide-react';

export default function AdminStationsView() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [deptTab, setDeptTab] = useState('ACTIVE'); // 'ACTIVE' (現行營運) 或 'INACTIVE' (停用刪除)

  // 編輯/新增站點彈窗狀態
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    deptId: '',
    deptName: '',
    deptType: 'STORE',
    openStartTime: '09:30',
    openDeadline: '10:30',
    closeStartTime: '16:45',
    closeDeadline: '20:00',
    sortOrder: 10,
    isActive: true
  });
  const [savingDept, setSavingDept] = useState(false);

  // 連假檢查相關狀態
  const [holidayCheckData, setHolidayCheckData] = useState(null);
  const [checkingHolidays, setCheckingHolidays] = useState(false);
  const [writingHolidays, setWritingHolidays] = useState(false);
  const [holidayMonths, setHolidayMonths] = useState(3);
  const [statusMsg, setStatusMsg] = useState('');

  // 載入站點資訊 (含現行與停用)
  const loadDepartments = async () => {
    setLoadingDepts(true);
    try {
      const res = await apiGet({ action: 'admin_get_departments', token });
      if (res.success && res.data) {
        setDepartments(res.data.departments || []);
      } else {
        // Fallback
        const fallbackRes = await apiGet({ action: 'get_user_depts', token });
        if (fallbackRes.success && fallbackRes.data) {
          setDepartments((fallbackRes.data.departments || []).map((d) => ({
            ...d,
            openStartTime: d.openStartTime || '09:30',
            closeStartTime: d.closeStartTime || '16:45',
            isActive: true
          })));
        }
      }
    } catch (err) {
      console.warn('載入站點失敗:', err.message);
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDepartments();
    }
  }, [token]);

  // 開啟新增彈窗
  const handleOpenCreate = () => {
    setEditingDept(null);
    setFormData({
      deptId: '',
      deptName: '',
      deptType: 'STORE',
      openStartTime: '09:30',
      openDeadline: '10:30',
      closeStartTime: '16:45',
      closeDeadline: '20:00',
      sortOrder: (departments.length + 1) * 10,
      isActive: true
    });
    setDeptModalOpen(true);
  };

  // 開啟編輯彈窗
  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      deptId: dept.deptId,
      deptName: dept.deptName,
      deptType: dept.deptType || 'STORE',
      openStartTime: dept.openStartTime || '09:30',
      openDeadline: dept.openDeadline || '10:30',
      closeStartTime: dept.closeStartTime || '16:45',
      closeDeadline: dept.closeDeadline || '20:00',
      sortOrder: dept.sortOrder || 10,
      isActive: dept.isActive !== false
    });
    setDeptModalOpen(true);
  };

  // 儲存站點規格
  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!formData.deptId.trim()) return alert('請輸入站點代碼');
    if (!formData.deptName.trim()) return alert('請輸入站點名稱');

    setSavingDept(true);
    try {
      const res = await apiPost({
        action: 'admin_save_department',
        token,
        payload: formData
      });

      if (res.success) {
        alert(res.message || '站點規格儲存成功！');
        setDeptModalOpen(false);
        loadDepartments();
      } else {
        alert(res.error || '儲存失敗');
      }
    } catch (err) {
      alert('儲存失敗：' + (err.message || '網路錯誤'));
    } finally {
      setSavingDept(false);
    }
  };

  // 停用或啟用站點
  const handleToggleDeptStatus = async (deptId, deptName, newStatus) => {
    const actionText = newStatus ? '恢復為現行營運' : '停用刪除';
    const confirm = window.confirm(`確定要將站點【${deptName}】(${deptId}) ${actionText} 嗎？`);
    if (!confirm) return;

    try {
      const res = await apiPost({
        action: 'admin_toggle_dept_status',
        token,
        deptId,
        isActive: newStatus
      });

      if (res.success) {
        alert(res.message || `站點已成功${actionText}！`);
        if (newStatus) {
          setDeptTab('ACTIVE'); // 恢復現行後自動切換回現行營運頁面
        }
        loadDepartments();
      } else {
        alert(res.error || '操作失敗');
      }
    } catch (err) {
      alert('操作失敗：' + (err.message || '網路錯誤'));
    }
  };

  // 上下微調排序
  const handleMoveSort = async (index, direction) => {
    const activeDepts = departments.filter((d) => d.isActive !== false);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeDepts.length) return;

    const newOrder = [...activeDepts];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedDeptIds = newOrder.map((d) => d.deptId);
    try {
      const res = await apiPost({
        action: 'admin_update_dept_sort',
        token,
        orderedDeptIds
      });
      if (res.success) {
        loadDepartments();
      }
    } catch (err) {
      console.warn('更新排序失敗', err);
    }
  };

  // 檢查未來連假
  const handleCheckHolidays = async (months = 3) => {
    setCheckingHolidays(true);
    setStatusMsg('');
    try {
      const res = await apiGet({
        action: 'check_upcoming_holidays',
        months,
      });
      if (res.success && res.data) {
        setHolidayCheckData(res.data);
      }
    } catch (err) {
      setStatusMsg('檢查連假失敗：' + (err.message || '網路通訊錯誤'));
    } finally {
      setCheckingHolidays(false);
    }
  };

  // 一鍵確認寫入資料庫
  const handleConfirmWriteHolidays = async () => {
    if (!holidayCheckData?.upcomingHolidays?.length) return;
    const confirm = window.confirm(
      `確定要將檢查出的 ${holidayCheckData.upcomingHolidays.length} 筆未來連續假期與補休日確認寫入 Google Sheets Calendar 資料庫嗎？`
    );
    if (!confirm) return;

    setWritingHolidays(true);
    setStatusMsg('');
    try {
      const res = await apiPost({
        action: 'confirm_write_holidays',
        token,
        holidays: holidayCheckData.upcomingHolidays,
      });

      if (res.success) {
        setStatusMsg(`✅ 成功寫入連假資料庫！共新增 ${res.data?.addedCount || 0} 筆全新假期紀錄。`);
        handleCheckHolidays(holidayMonths);
      } else {
        setStatusMsg('❌ 寫入失敗：' + (res.error || '不明錯誤'));
      }
    } catch (err) {
      setStatusMsg('❌ 寫入失敗：' + (err.message || '網路錯誤'));
    } finally {
      setWritingHolidays(false);
    }
  };

  const activeDepts = departments.filter((d) => d.isActive !== false);
  const inactiveDepts = departments.filter((d) => d.isActive === false);
  const displayedDepts = deptTab === 'ACTIVE' ? activeDepts : inactiveDepts;

  return (
    <div className="space-y-4">
      {/* 站點管理面板 */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">全商場站點規格總覽</h3>
              <p className="text-[11px] text-slate-400">
                現行營運 {activeDepts.length} 站 / 停用刪除 {inactiveDepts.length} 站
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={loadDepartments}
              disabled={loadingDepts}
              title="重新整理"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDepts ? 'animate-spin text-purple-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>新增站點</span>
            </button>
          </div>
        </div>

        {/* 現行營運 / 停用刪除 雙分頁切換 */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setDeptTab('ACTIVE')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              deptTab === 'ACTIVE'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            現行營運站點 ({activeDepts.length})
          </button>
          <button
            type="button"
            onClick={() => setDeptTab('INACTIVE')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              deptTab === 'INACTIVE'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            停用刪除站點 ({inactiveDepts.length})
          </button>
        </div>

        {/* 站點清單列表 */}
        {loadingDepts ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span>載入站點清單中...</span>
          </div>
        ) : displayedDepts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
            {deptTab === 'ACTIVE' ? '目前無現行營運之站點' : '目前無已停用之站點'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedDepts.map((dept, idx) => (
              <div
                key={dept.deptId}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  deptTab === 'ACTIVE'
                    ? 'bg-slate-50/70 border-slate-200/90 hover:bg-white hover:shadow-xs'
                    : 'bg-red-50/40 border-red-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-800">{dept.deptName}</span>
                    <span className="text-[11px] font-mono text-slate-400">({dept.deptId})</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600 font-medium">
                      {dept.deptType || '門市'}
                    </span>
                  </div>

                  {/* 排序微調 (僅現行頁面提供) */}
                  {deptTab === 'ACTIVE' && (
                    <div className="flex items-center space-x-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSort(idx, -1)}
                        title="向上移動順序"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === displayedDepts.length - 1}
                        onClick={() => handleMoveSort(idx, 1)}
                        title="向下移動順序"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 回報開始與截止時段規格 */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                  <div className="p-2 bg-amber-50/60 rounded-lg border border-amber-200/60 text-amber-900">
                    <span className="font-bold block text-[10px] text-amber-700">開店回報時段</span>
                    <span className="font-mono text-xs">{dept.openStartTime || '09:30'} ~ {dept.openDeadline || '10:30'}</span>
                  </div>
                  <div className="p-2 bg-indigo-50/60 rounded-lg border border-indigo-200/60 text-indigo-900">
                    <span className="font-bold block text-[10px] text-indigo-700">閉店回報時段</span>
                    <span className="font-mono text-xs">{dept.closeStartTime || '16:45'} ~ {dept.closeDeadline || '20:00'}</span>
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center justify-end space-x-1.5 pt-1">
                  {deptTab === 'ACTIVE' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(dept)}
                        className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>編輯規格</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleDeptStatus(dept.deptId, dept.deptName, false)}
                        className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>停用</span>
                      </button>
                    </>
                  ) : (
                    /* 停用清單中的【恢復為現行營運】按鈕 */
                    <button
                      type="button"
                      onClick={() => handleToggleDeptStatus(dept.deptId, dept.deptName, true)}
                      className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>恢復現行營運</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 站點編輯／新增彈窗 */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editingDept ? `編輯站點規格 [${editingDept.deptId}]` : '新增商場站點'}
              </h3>
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    站點代碼 (Dept ID)
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingDept)}
                    value={formData.deptId}
                    onChange={(e) => setFormData({ ...formData, deptId: e.target.value.toUpperCase() })}
                    placeholder="例如: 9F, EXHIBIT"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 uppercase font-mono disabled:opacity-60"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    站點中文名稱
                  </label>
                  <input
                    type="text"
                    value={formData.deptName}
                    onChange={(e) => setFormData({ ...formData, deptName: e.target.value })}
                    placeholder="例如: 9F特展區"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  站點類型
                </label>
                <select
                  value={formData.deptType}
                  onChange={(e) => setFormData({ ...formData, deptType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="STORE">門市櫃位 (STORE)</option>
                  <option value="SERVICE">服務台 (SERVICE)</option>
                  <option value="EXHIBIT">展區／活動區 (EXHIBIT)</option>
                </select>
              </div>

              {/* 開店時段規格 */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-2">
                <span className="text-xs font-bold text-amber-900 block">開店回報時段設定</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-amber-700 mb-0.5">開始回報時間</label>
                    <input
                      type="time"
                      value={formData.openStartTime}
                      onChange={(e) => setFormData({ ...formData, openStartTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-amber-700 mb-0.5">截止回報時間</label>
                    <input
                      type="time"
                      value={formData.openDeadline}
                      onChange={(e) => setFormData({ ...formData, openDeadline: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 閉店時段規格 */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/60 space-y-2">
                <span className="text-xs font-bold text-indigo-900 block">閉店回報時段設定</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-indigo-700 mb-0.5">開始回報時間</label>
                    <input
                      type="time"
                      value={formData.closeStartTime}
                      onChange={(e) => setFormData({ ...formData, closeStartTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-indigo-700 mb-0.5">截止回報時間</label>
                    <input
                      type="time"
                      value={formData.closeDeadline}
                      onChange={(e) => setFormData({ ...formData, closeDeadline: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="flex-1 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50"
                >
                  {savingDept ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>儲存站點規格</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 國定假日與連續假期管理模組 (保留既有功能) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                國定假日與連假檢查模組
              </h3>
              <p className="text-[11px] text-slate-400">
                依行政院人事行政總處公開資料，自動比對未來連續假期並寫入行事曆庫
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <select
              value={holidayMonths}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                setHolidayMonths(m);
                handleCheckHolidays(m);
              }}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer font-medium"
            >
              <option value={3}>檢查未來 3 個月</option>
              <option value={6}>檢查未來 6 個月</option>
              <option value={12}>檢查未來 1 年</option>
            </select>

            <button
              type="button"
              onClick={() => handleCheckHolidays(holidayMonths)}
              disabled={checkingHolidays}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {checkingHolidays ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              <span>檢查連假</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              statusMsg.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {statusMsg}
          </div>
        )}

        {holidayCheckData && (
          <div className="space-y-3 pt-1">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-700">檢查涵蓋區間：</span>
                <span className="font-mono text-purple-700 font-semibold ml-1">
                  {holidayCheckData.startDate} ~ {holidayCheckData.endDate}
                </span>
                <span className="text-slate-400 ml-2">
                  (共 {holidayCheckData.totalHolidaysFound} 天假日，含已建檔及新檢查出假期)
                </span>
              </div>

              {holidayCheckData.upcomingHolidays?.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmWriteHolidays}
                  disabled={writingHolidays}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {writingHolidays ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Database className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span>確認寫入資料庫 ({holidayCheckData.upcomingHolidays.length} 筆)</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">日期</th>
                    <th className="py-2.5 px-3">節日 / 假期名稱</th>
                    <th className="py-2.5 px-3">類型</th>
                    <th className="py-2.5 px-3">資料庫狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidayCheckData.upcomingHolidays?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        目前區間內所有國定連假均已全數建檔於資料庫中，無漏缺項目。
                      </td>
                    </tr>
                  ) : (
                    holidayCheckData.upcomingHolidays?.map((h) => (
                      <tr key={h.date} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {h.date}
                        </td>
                        <td className="py-2 px-3 font-medium text-purple-900">
                          {h.name}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {h.dayType === 'HOLIDAY' ? '國定/補休' : h.dayType}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            已比對就緒
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
