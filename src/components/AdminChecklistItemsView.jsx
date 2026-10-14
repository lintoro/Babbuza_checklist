import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import {
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sun,
  Moon,
  FolderPlus,
  Store,
  Layers,
  X
} from 'lucide-react';

export default function AdminChecklistItemsView() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('1F');
  const [stage, setStage] = useState('OPEN');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 彈窗狀態 (新增/編輯)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    itemId: '',
    deptId: '1F',
    stage: 'OPEN',
    category: '',
    title: '',
    itemType: 'CHECK',
    frequency: 'DAILY',
    sortOrder: 10,
    isActive: true,
  });

  // 載入站點清單
  const loadDepartments = async () => {
    try {
      const res = await apiGet({ action: 'admin_get_departments', token });
      if (res.success && res.data?.departments) {
        setDepartments(res.data.departments.filter(d => d.isActive !== false));
      }
    } catch (err) {
      console.warn('載入站點失敗', err);
    }
  };

  // 載入該站點與時段的點檢項目清單
  const loadItems = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiGet({
        action: 'admin_get_checklist_items',
        token,
        deptId: selectedDeptId,
        stage,
      });

      if (res.success && res.data) {
        setItems(res.data.items || []);
      } else {
        setErrorMsg(res.error || '載入點檢項目失敗');
      }
    } catch (err) {
      setErrorMsg(err.message || '連線伺服器失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDepartments();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedDeptId) {
      loadItems();
    }
  }, [token, selectedDeptId, stage]);

  // 開啟新增彈窗
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      itemId: '',
      deptId: selectedDeptId,
      stage,
      category: items.length > 0 ? items[0].category : '一般環境',
      title: '',
      itemType: 'CHECK',
      frequency: 'DAILY',
      sortOrder: (items.length + 1) * 10,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // 開啟編輯彈窗
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      itemId: item.itemId,
      deptId: item.deptId,
      stage: item.stage,
      category: item.category,
      title: item.title,
      itemType: item.itemType || 'CHECK',
      frequency: item.frequency || 'DAILY',
      sortOrder: item.sortOrder || 10,
      isActive: item.isActive,
    });
    setIsModalOpen(true);
  };

  // 儲存項目 (新增或修改)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return alert('請輸入題目名稱');

    setSaving(true);
    try {
      const res = await apiPost({
        action: 'admin_save_checklist_item',
        token,
        payload: formData,
      });

      if (res.success) {
        setStatusMsg(res.message || '儲存成功！');
        setTimeout(() => setStatusMsg(''), 3000);
        setIsModalOpen(false);
        loadItems();
      } else {
        alert(res.error || '儲存失敗');
      }
    } catch (err) {
      alert('儲存失敗：' + (err.message || '網路錯誤'));
    } finally {
      setSaving(false);
    }
  };

  // 切換啟用/停用狀態
  const handleToggleStatus = async (item) => {
    const nextStatus = !item.isActive;
    try {
      const res = await apiPost({
        action: 'admin_toggle_item_status',
        token,
        itemId: item.itemId,
        isActive: nextStatus,
      });

      if (res.success) {
        setItems(prev =>
          prev.map(it => (it.itemId === item.itemId ? { ...it, isActive: nextStatus } : it))
        );
      } else {
        alert(res.error || '狀態更新失敗');
      }
    } catch (err) {
      alert('操作失敗：' + (err.message || '網路錯誤'));
    }
  };

  // 刪除項目 (二次確認)
  const handleDeleteItem = async (item) => {
    const confirm = window.confirm(`確定要刪除點檢項目【${item.title}】嗎？\n此動作將自資料庫中移除該題目。`);
    if (!confirm) return;

    try {
      const res = await apiPost({
        action: 'admin_delete_checklist_item',
        token,
        itemId: item.itemId,
      });

      if (res.success) {
        setStatusMsg(`項目【${item.title}】已成功刪除！`);
        setTimeout(() => setStatusMsg(''), 3000);
        loadItems();
      } else {
        alert(res.error || '刪除失敗');
      }
    } catch (err) {
      alert('刪除失敗：' + (err.message || '網路錯誤'));
    }
  };

  // 上下微調排序
  const handleMoveSort = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setItems(newItems);

    const orderedItemIds = newItems.map(it => it.itemId);
    try {
      await apiPost({
        action: 'admin_update_item_sort',
        token,
        orderedItemIds,
      });
    } catch (err) {
      console.warn('更新排序失敗', err);
      loadItems();
    }
  };

  // 取得目前所有分類供選單建議
  const existingCategories = Array.from(new Set(items.map(it => it.category).filter(Boolean)));

  // 依據 Category 分組
  const groupedItems = items.reduce((acc, it) => {
    const cat = it.category || '一般項目';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(it);
    return acc;
  }, {});

  const currentDeptName = departments.find(d => d.deptId === selectedDeptId)?.deptName || selectedDeptId;

  return (
    <div className="space-y-4">
      {/* 頂部操作控制列 */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                點檢項目規格維護中心
              </h2>
              <p className="text-xs text-slate-400">
                管理各站點於營業前（開店）與營業後（閉店）之檢核題目、分類與順序
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增點檢項目</span>
            </button>

            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="重新載入"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 站點切換與時段切換 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* 站點選擇 */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center space-x-1">
              <Store className="w-3.5 h-3.5 text-brand-600" />
              <span>所屬巡檢站點</span>
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept.deptId} value={dept.deptId}>
                  {dept.deptName} ({dept.deptId})
                </option>
              ))}
            </select>
          </div>

          {/* 時段切換 */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>點檢時段</span>
            </label>
            <div className="flex bg-slate-100 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setStage('OPEN')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  stage === 'OPEN'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>營業前（開店）</span>
              </button>
              <button
                type="button"
                onClick={() => setStage('CLOSE')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  stage === 'CLOSE'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span>營業後（閉店）</span>
              </button>
            </div>
          </div>
        </div>

        {/* 提示訊息 */}
        {statusMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 項目清單區 */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs border border-slate-200/80">
          <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
          <span>正在載入【{currentDeptName}】之點檢項目清冊...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center space-y-3 border border-slate-200/80">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-bold text-sm">目前【{currentDeptName}】尚無任何點檢項目</p>
          <p className="text-xs text-slate-400">點擊上方「新增點檢項目」按鈕即可為此站點建立第一個檢查項目！</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              站點【<b>{currentDeptName}</b>】於【<b>{stage === 'OPEN' ? '營業前（開店）' : '營業後（閉店）'}</b>】共配置 <b>{items.length}</b> 個檢查項目
            </span>
            <span className="text-[11px] text-slate-400">可使用 ⬆️ ⬇️ 箭頭即時調整題目排序</span>
          </div>

          {Object.entries(groupedItems).map(([categoryName, catItems]) => (
            <div
              key={categoryName}
              className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3"
            >
              {/* 分類標題 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-4 rounded-full bg-purple-600" />
                  <h3 className="font-bold text-slate-800 text-sm">{categoryName}</h3>
                  <span className="text-[11px] text-slate-400">({catItems.length} 項)</span>
                </div>
              </div>

              {/* 題目列表 */}
              <div className="space-y-2">
                {catItems.map((item) => {
                  const itemIndex = items.findIndex((it) => it.itemId === item.itemId);
                  return (
                    <div
                      key={item.itemId}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        item.isActive
                          ? 'bg-slate-50/70 border-slate-200/90 hover:bg-slate-50'
                          : 'bg-slate-100/60 border-slate-200/50 opacity-60'
                      }`}
                    >
                      {/* 左側排序按鈕與名稱 */}
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {/* 排序微調按鈕 */}
                        <div className="flex flex-col space-y-0.5">
                          <button
                            type="button"
                            disabled={itemIndex === 0}
                            onClick={() => handleMoveSort(itemIndex, -1)}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="上移"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={itemIndex === items.length - 1}
                            onClick={() => handleMoveSort(itemIndex, 1)}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="下移"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 題目名稱與標籤 */}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-bold text-xs text-slate-800 break-words">
                              {item.title}
                            </span>
                            {item.frequency !== 'DAILY' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-md">
                                {item.frequency}
                              </span>
                            )}
                            {!item.isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded-md">
                                已停用
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            代碼：{item.itemId} ｜ 順序權重：{item.sortOrder}
                          </span>
                        </div>
                      </div>

                      {/* 右側操作群組 */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* 啟用/停用開關按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            item.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {item.isActive ? '啟用中' : '已停用'}
                        </button>

                        {/* 編輯按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                          title="編輯項目"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* 刪除按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="刪除項目"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增／編輯彈窗 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ListChecks className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingItem ? '編輯點檢項目規格' : '新增站點點檢項目'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              {/* 站點與時段資訊 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    指定站點
                  </label>
                  <select
                    value={formData.deptId}
                    onChange={(e) => setFormData({ ...formData, deptId: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer font-bold"
                  >
                    {departments.map((dept) => (
                      <option key={dept.deptId} value={dept.deptId}>
                        {dept.deptName} ({dept.deptId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    適用時段
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer font-bold"
                  >
                    <option value="OPEN">營業前（開店）</option>
                    <option value="CLOSE">營業後（閉店）</option>
                  </select>
                </div>
              </div>

              {/* 題目分類 Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>所屬類別／分組 (Category)</span>
                  {existingCategories.length > 0 && (
                    <span className="text-[10px] text-slate-400">可手動輸入或點選既有分類</span>
                  )}
                </label>
                <input
                  type="text"
                  list="categoryList"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="例如：環境整潔、消防通道、收銀設備..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-bold"
                  required
                />
                <datalist id="categoryList">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* 題目內容 Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  點檢題目名稱／檢查說明
                </label>
                <textarea
                  rows={2}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="請輸入欲要求同仁檢查之項目說明..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                  required
                />
              </div>

              {/* 檢查頻率與排序序號 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    檢查頻率
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="DAILY">每日必檢 (DAILY)</option>
                    <option value="HOLIDAY">國定連假專案 (HOLIDAY)</option>
                    <option value="WEEKEND">僅週末六日 (WEEKEND)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    排序序號 (Sort Order)
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 10 })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* 啟用狀態核取框 */}
              <div className="pt-1 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="itemIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded-sm cursor-pointer"
                />
                <label htmlFor="itemIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  現行啟用此題目（若取消勾選則暫停巡檢填報）
                </label>
              </div>

              {/* 操作按鈕 */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{editingItem ? '確認儲存修改' : '建立點檢項目'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
