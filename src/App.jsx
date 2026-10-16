import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { apiGet, apiPost } from './api';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import StationSelector from './components/StationSelector';
import HandoverCard from './components/HandoverCard';
import ChecklistSection from './components/ChecklistSection';
import SubmitModal from './components/SubmitModal';
import { Loader2, AlertCircle, RefreshCw, Users, Store, FileText, LayoutGrid, ListChecks } from 'lucide-react';

// 動態延遲載入管理端重型組件 (Code Splitting)，現場手機端首屏體積大幅降低
const AdminUsersView = lazy(() => import('./components/AdminUsersView'));
const AdminStationsView = lazy(() => import('./components/AdminStationsView'));
const AdminReportsView = lazy(() => import('./components/AdminReportsView'));
const AdminWarRoomView = lazy(() => import('./components/AdminWarRoomView'));
const AdminChecklistItemsView = lazy(() => import('./components/AdminChecklistItemsView'));
const ChangePasswordModal = lazy(() => import('./components/ChangePasswordModal'));

export default function App() {
  const { user, token, departments, loading: authLoading, mustChangePwdModal, setMustChangePwdModal } = useAuth();

  // 畫面檢視模式：'checklist' (巡檢) 或 'admin' (管理後台)
  const [viewMode, setViewMode] = useState('checklist');
  // 管理後台頁籤：'users' (人員名冊)、'stations' (站點與連假)、'reports' (總結報表)、'warroom' (巡檢戰情報表)
  const [adminTab, setAdminTab] = useState('warroom');


  // 站點與時段選擇
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [stage, setStage] = useState(() => {
    // 預設時段：下午 14:00 後預設進入閉站 (CLOSE)，否則開站 (OPEN)
    const hour = new Date().getHours();
    return hour >= 14 ? 'CLOSE' : 'OPEN';
  });


  // 點檢資料
  const [items, setItems] = useState([]);
  const [deptStatus, setDeptStatus] = useState(null);
  const [handoverNotes, setHandoverNotes] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHandover, setLoadingHandover] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 勾選狀態：{ [itemId]: { status: 'OK'|'NG'|'NA', remark: '' } }
  const [itemStates, setItemStates] = useState({});
  const [handoverText, setHandoverText] = useState('');

  // 彈窗狀態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [manualChangePwdOpen, setManualChangePwdOpen] = useState(false);

  // 當授權站點載入完成後，自動選取預設站點
  useEffect(() => {
    if (departments && departments.length > 0 && !selectedDeptId) {
      const primary = departments.find((d) => d.isPrimary) || departments[0];
      setSelectedDeptId(primary.deptId);
    }
  }, [departments, selectedDeptId]);

  // 載入點檢項目、站點狀態與交接備忘 (合一請求，消除網路瀑布流)
  const loadChecklist = async (deptId, currentStage) => {
    if (!deptId) return;
    setLoadingItems(true);
    setLoadingHandover(true);
    setErrorMsg('');
    try {
      const res = await apiGet({
        action: 'get_checklist',
        token,
        deptId,
        stage: currentStage,
        includeHandover: 'true',
      });

      if (res.success && res.data) {
        setItems(res.data.items || []);
        setDeptStatus(res.data.status || null);
        if (res.data.handoverNotes) {
          setHandoverNotes(res.data.handoverNotes);
        }

        // 重設點檢項目勾選狀態
        const initialStates = {};
        (res.data.items || []).forEach((item) => {
          initialStates[item.itemId] = { status: null, remark: '' };
        });
        setItemStates(initialStates);
      }
    } catch (err) {
      setErrorMsg(err.message || '載入點檢項目失敗');
    } finally {
      setLoadingItems(false);
      setLoadingHandover(false);
    }
  };

  // 當站點或時段變更時重新載入 (單次合一請求)
  useEffect(() => {
    if (token && selectedDeptId) {
      loadChecklist(selectedDeptId, stage);
    }
  }, [token, selectedDeptId, stage]);

  // 變更項目狀態 (OK, NG, NA)
  const handleItemStatusChange = (itemId, status) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        status: prev[itemId]?.status === status ? null : status,
      },
    }));
  };

  // 變更項目備註
  const handleItemRemarkChange = (itemId, remark) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        remark,
      },
    }));
  };

  // 一鍵全部標記為正常 (OK)
  const handleCheckAllOk = () => {
    const updated = {};
    items.forEach((item) => {
      // 保留原有填寫的 remark，若原本是 NG 轉 OK 則清空
      const prev = itemStates[item.itemId] || {};
      updated[item.itemId] = {
        status: 'OK',
        remark: prev.status === 'NG' ? '' : prev.remark || '',
      };
    });
    setItemStates(updated);
  };

  // 送出點檢
  const handleSubmit = async () => {
    // 檢查是否有未勾選項
    const uncompleted = items.filter((item) => !itemStates[item.itemId]?.status);
    if (uncompleted.length > 0) {
      if (
        !window.confirm(
          `尚有 ${uncompleted.length} 個項目尚未勾選，確認要直接送出嗎？`
        )
      ) {
        return;
      }
    }

    // 檢查 NG 項目是否有未填寫備註者
    const ngWithoutRemark = items.filter(
      (item) =>
        itemStates[item.itemId]?.status === 'NG' &&
        !(itemStates[item.itemId]?.remark || '').trim()
    );
    if (ngWithoutRemark.length > 0) {
      alert(`有 ${ngWithoutRemark.length} 項異常項目未填寫原因備註，請補充說明後再送出。`);
      return;
    }

    // 組裝 payload
    const auditItems = items.map((item) => {
      const state = itemStates[item.itemId] || {};
      return {
        itemId: item.itemId,
        category: item.category,
        title: item.title,
        status: state.status || 'NA',
        value: '',
        remark: (state.remark || '').trim(),
      };
    });

    // 沙盒測試隔離機制：本地開發 (localhost / 127.0.0.1) 自動帶入 TEST- 前綴與 isTest 標記，完全隔離正式營運資料
    const isLocalDev = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );
    const clientPrefix = isLocalDev ? 'TEST-' : 'WEB-';

    const payload = {
      deptId: selectedDeptId,
      stage,
      isTest: isLocalDev,
      clientKey: `${clientPrefix}${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      items: auditItems,
      handoverNote: handoverText.trim(),
    };

    setIsSubmitting(true);
    try {
      const res = await apiPost({
        action: 'submit_audit',
        token,
        payload,
      });

      if (res.success && res.data) {
        setSubmitResult(res.data);
        setShowSubmitModal(true);
        setHandoverText('');
        // 若後端直接回傳最新站點狀態，立即更新 State
        if (res.data.departmentStatus) {
          setDeptStatus(res.data.departmentStatus);
        }
        // 重新整理站點狀態與交接備忘 (合一請求)
        loadChecklist(selectedDeptId, stage);
      } else {
        alert(res.error || '點檢送出失敗');
      }
    } catch (err) {
      alert('點檢送出失敗：' + (err.message || '網路錯誤'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 尚未登入時顯示登入視窗
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">系統啟動中...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <LoginModal />;
  }

  const currentDeptInfo = departments.find((d) => d.deptId === selectedDeptId);

  return (
    <div className="min-h-screen bg-slate-100/70 pb-12">
      {/* 頂部導覽列 */}
      <Navbar
        onOpenChangePwd={() => setManualChangePwdOpen(true)}
        viewMode={viewMode}
        onToggleViewMode={() =>
          setViewMode((prev) => (prev === 'admin' ? 'checklist' : 'admin'))
        }
      />

      {/* 主體工作區塊 */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* 管理員與巡店主管後台視圖 (依角色權限動態呈現頁籤) */}
        {viewMode === 'admin' && (user.role === 'ADMIN' || user.role === 'SUPERVISOR') ? (
          <div className="space-y-4">
            {/* 管理後台切換頁籤 Tabs */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs flex items-center">
              <button
                type="button"
                onClick={() => setAdminTab('warroom')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  adminTab === 'warroom'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>即時戰情</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('items')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  adminTab === 'items'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>點檢項目</span>
              </button>

              {/* 站點規格 (僅 ADMIN 系統管理員) */}
              {user.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setAdminTab('stations')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    adminTab === 'stations'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>站點規格</span>
                </button>
              )}

              {/* 人員名冊 (僅 ADMIN 系統管理員) */}
              {user.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setAdminTab('users')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    adminTab === 'users'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>人員名冊</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAdminTab('reports')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  adminTab === 'reports'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>總結報表</span>
              </button>
            </div>

            {/* 根據頁籤渲染對應元件 (以 Suspense 包裹動態載入之組件，並加入主管越權防呆保護) */}
            <Suspense
              fallback={
                <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3 text-purple-600">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">載入管理後台模組中...</p>
                </div>
              }
            >
              {adminTab === 'warroom' || (user.role !== 'ADMIN' && (adminTab === 'stations' || adminTab === 'users')) ? (
                <AdminWarRoomView />
              ) : adminTab === 'items' ? (
                <AdminChecklistItemsView />
              ) : adminTab === 'stations' && user.role === 'ADMIN' ? (
                <AdminStationsView />
              ) : adminTab === 'users' && user.role === 'ADMIN' ? (
                <AdminUsersView />
              ) : (
                <AdminReportsView />
              )}
            </Suspense>
          </div>
        ) : (
          <>

            {/* 錯誤警告 */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => loadChecklist(selectedDeptId, stage)}
                  className="text-xs font-semibold underline ml-2"
                >
                  重試
                </button>
              </div>
            )}

            {/* 1. 站點與時段選擇器 */}
            <StationSelector
              departments={departments}
              selectedDeptId={selectedDeptId}
              onSelectDept={(deptId) => setSelectedDeptId(deptId)}
              stage={stage}
              onSelectStage={(s) => setStage(s)}
              deptStatus={deptStatus}
              currentDeptInfo={currentDeptInfo}
            />

            {/* 2. 站點交接與未結案異常備忘 */}
            <HandoverCard
              notes={handoverNotes}
              loading={loadingHandover}
              onReload={() => loadChecklist(selectedDeptId, stage)}
            />

            {/* 3. 點檢項目清單 (Accordion / OK / NG / NA) */}
            {loadingItems ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <p className="text-xs">載入 {currentDeptInfo?.deptName || ''} 點檢項目中...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center text-slate-400 text-xs space-y-2">
                <p>目前查無 {stage === 'OPEN' ? '營業前' : '營業後'} 適用點檢項目。</p>
                <button
                  onClick={() => loadChecklist(selectedDeptId, stage)}
                  className="inline-flex items-center space-x-1 text-brand-600 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  <span>重新整理</span>
                </button>
              </div>
            ) : (
              <ChecklistSection
                items={items}
                itemStates={itemStates}
                onChangeItemStatus={handleItemStatusChange}
                onChangeItemRemark={handleItemRemarkChange}
                onCheckAllOk={handleCheckAllOk}
                handoverText={handoverText}
                onChangeHandoverText={setHandoverText}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                currentDeptInfo={currentDeptInfo}
                stage={stage}
              />
            )}
          </>
        )}
      </main>


      {/* 送出成功確認彈窗 (含 LINE 通報文字複製) */}
      <SubmitModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        resultData={submitResult}
      />

      {/* 強制首次修改密碼與手動變更密碼彈窗 (Suspense 異步載入) */}
      <Suspense fallback={null}>
        {mustChangePwdModal && (
          <ChangePasswordModal
            isOpen={mustChangePwdModal}
            onClose={() => setMustChangePwdModal(false)}
            isForced={true}
          />
        )}
        {manualChangePwdOpen && (
          <ChangePasswordModal
            isOpen={manualChangePwdOpen}
            onClose={() => setManualChangePwdOpen(false)}
            isForced={false}
          />
        )}
      </Suspense>
    </div>
  );
}
