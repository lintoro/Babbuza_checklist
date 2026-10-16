import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  KeyRound,
  Edit2,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Store,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function AdminUsersView() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 預設顯示全部：ALL, ACTIVE, INACTIVE
  const [roleFilter, setRoleFilter] = useState('ALL');     // ALL, ADMIN, SUPERVISOR, STAFF

  // 角色權重順序：ADMIN (1) -> SUPERVISOR (2) -> STAFF (3)
  const ROLE_RANK = {
    ADMIN: 1,
    SUPERVISOR: 2,
    STAFF: 3,
  };

  // 人員名冊排序邏輯：
  // 1. 一階：角色順序 (ADMIN -> SUPERVISOR -> STAFF)
  // 2. 二階：工號由 B 到 A，號碼由小到大 (例如 B111001 < B111002 < A111001)
  const compareUsers = (a, b) => {
    const roleA = ROLE_RANK[String(a.role || '').toUpperCase()] || 99;
    const roleB = ROLE_RANK[String(b.role || '').toUpperCase()] || 99;
    if (roleA !== roleB) return roleA - roleB;

    const idA = String(a.userId || '').trim().toUpperCase();
    const idB = String(b.userId || '').trim().toUpperCase();

    const matchA = idA.match(/^([A-Z]+)(\d+)?(.*)$/);
    const matchB = idB.match(/^([A-Z]+)(\d+)?(.*)$/);

    const prefixA = matchA ? matchA[1] : '';
    const prefixB = matchB ? matchB[1] : '';

    const getPrefixPriority = (p) => {
      if (p === 'B') return 1;
      if (p === 'A') return 2;
      return 3;
    };

    const pRankA = getPrefixPriority(prefixA);
    const pRankB = getPrefixPriority(prefixB);
    if (pRankA !== pRankB) return pRankA - pRankB;
    if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);

    const numA = matchA && matchA[2] ? parseInt(matchA[2], 10) : null;
    const numB = matchB && matchB[2] ? parseInt(matchB[2], 10) : null;
    if (numA !== null && numB !== null && numA !== numB) return numA - numB;

    return idA.localeCompare(idB, undefined, { numeric: true });
  };

  // 站點中文名稱對照 (依規範 BENPU 顯示為「本鋪」)
  const getDeptDisplayName = (deptId) => {
    if (deptId === 'BENPU') return '本鋪';
    if (deptId === 'XIAOPU') return '小鋪';
    const found = departments.find((d) => d.deptId === deptId);
    if (found && found.deptName) return found.deptName;
    const MAP = {
      '1F': '1F服務台',
      'B1': 'B1服務台',
      '8F': '8F服務台',
      'MSS1': '旗艦一店',
      'MSS2': '旗艦二店',
      'YUANPIN': '原品',
      'GAGOO': 'GAGU',
      'BAOQINGZHU': '保青竹',
      'EXTREME': '極限組',
    };
    return MAP[deptId] || deptId;
  };


  // 編輯/新增彈窗狀態
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null 為新增，非 null 為編輯
  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    role: 'STAFF',
    status: 'ACTIVE',
    deptIds: [],
  });
  const [saving, setSaving] = useState(false);

  // 載入人員名單
  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiGet({ action: 'admin_get_users', token });
      if (res.success && res.data) {
        setUsers(res.data.users || []);
        setDepartments(res.data.departments || []);
      } else {
        setErrorMsg(res.error || '載入人員名冊失敗');
      }
    } catch (err) {
      setErrorMsg(err.message || '連線伺服器失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadUsers();
    }
  }, [token]);

  // 開啟新增彈窗
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      userId: '',
      name: '',
      role: 'STAFF',
      status: 'ACTIVE',
      deptIds: [],
    });
    setEditModalOpen(true);
  };

  // 開啟編輯彈窗
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      userId: user.userId,
      name: user.name,
      role: user.role,
      status: user.status,
      deptIds: [...(user.deptIds || [])],
    });
    setEditModalOpen(true);
  };

  // 切換站點勾選 (含本小舖雙向連動)
  const toggleDept = (deptId) => {
    setFormData((prev) => {
      let current = [...prev.deptIds];
      const exists = current.includes(deptId);

      if (exists) {
        // 取消勾選
        current = current.filter((id) => id !== deptId);
        if (deptId === 'BENPU') current = current.filter((id) => id !== 'XIAOPU');
        if (deptId === 'XIAOPU') current = current.filter((id) => id !== 'BENPU');
      } else {
        // 勾選
        current.push(deptId);
        if (deptId === 'BENPU' && !current.includes('XIAOPU')) current.push('XIAOPU');
        if (deptId === 'XIAOPU' && !current.includes('BENPU')) current.push('BENPU');
      }

      return { ...prev, deptIds: current };
    });
  };

  // 站點全選 / 清空
  const handleSelectAllDepts = (selectAll) => {
    if (selectAll) {
      setFormData((prev) => ({
        ...prev,
        deptIds: departments.map((d) => d.deptId),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        deptIds: [],
      }));
    }
  };

  // 儲存人員資料
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.userId.trim()) return alert('請輸入工號');
    if (!formData.name.trim()) return alert('請輸入姓名');

    setSaving(true);
    try {
      const res = await apiPost({
        action: 'admin_save_user',
        token,
        payload: formData,
      });

      if (res.success) {
        alert(res.message || '儲存成功！');
        setEditModalOpen(false);
        loadUsers();
      } else {
        alert(res.error || '儲存失敗');
      }
    } catch (err) {
      alert('儲存失敗：' + (err.message || '網路錯誤'));
    } finally {
      setSaving(false);
    }
  };

  // 一鍵重設密碼為 000000
  const handleResetPassword = async (targetUserId, targetName) => {
    const confirm = window.confirm(
      `確定要將【${targetName}】(${targetUserId}) 的密碼重設為預設密碼 000000 嗎？\n重設後該同仁於下次登入時會強制要求變更密碼。`
    );
    if (!confirm) return;

    try {
      const res = await apiPost({
        action: 'admin_reset_user_password',
        token,
        targetUserId,
      });

      if (res.success) {
        alert(res.message || `已成功重設 ${targetName} 的密碼為 000000！`);
        loadUsers();
      } else {
        alert(res.error || '重設密碼失敗');
      }
    } catch (err) {
      alert('重設密碼失敗：' + (err.message || '網路錯誤'));
    }
  };

  // 一鍵恢復在職
  const handleRestoreActive = async (targetUserId, targetName) => {
    const confirm = window.confirm(
      `確定要將【${targetName}】(${targetUserId}) 恢復為【在職】狀態嗎？\n恢復後該同仁將可正常登入系統並操作授權站點。`
    );
    if (!confirm) return;

    try {
      const res = await apiPost({
        action: 'admin_set_user_status',
        token,
        targetUserId,
        status: 'ACTIVE',
      });

      if (res.success) {
        alert(res.message || `已成功將 ${targetName} 恢復為在職！`);
        setStatusFilter('ACTIVE'); // 自動切換回在職分頁
        loadUsers();
      } else {
        alert(res.error || '狀態更新失敗');
      }
    } catch (err) {
      alert('狀態更新失敗：' + (err.message || '網路錯誤'));
    }
  };

  // 篩選人員清單 (含一階角色 + 二階工號由 B 到 A 升冪排序)
  const filteredUsers = users
    .filter((u) => {
      // 搜尋字串
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        u.userId.toLowerCase().includes(query) ||
        u.name.toLowerCase().includes(query);

      // 狀態篩選：ACTIVE 為在職，INACTIVE 為離職留停 (LEAVE 或 DISABLED)
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? u.status === 'ACTIVE'
          : u.status !== 'ACTIVE';

      // 角色篩選
      const matchRole =
        roleFilter === 'ALL' || u.role === roleFilter;

      return matchQuery && matchStatus && matchRole;
    })
    .sort(compareUsers);

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const leaveCount = users.filter((u) => u.status === 'LEAVE').length;
  const disabledCount = users.filter((u) => u.status === 'DISABLED').length;

  return (
    <div className="space-y-4">
      {/* 頂部工具列 */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">全商場人員權限名冊</h2>
              <p className="text-[11px] text-slate-400">
                共 {users.length} 位人員（在職 {activeCount} 人 / 留停 {leaveCount} 人 / 離職 {disabledCount} 人）
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              title="重新載入"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>新增人員</span>
            </button>
          </div>
        </div>

        {/* 搜尋與篩選欄 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* 搜尋關鍵字 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋工號或姓名..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* 狀態切換 (全部、在職 與 離職留停) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-brand-700 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              全部 ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex-1 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              在職 ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`flex-1 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'INACTIVE' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              離職留停 ({leaveCount + disabledCount})
            </button>
          </div>


          {/* 角色篩選 (次序：ADMIN -> SUPERVISOR -> STAFF) */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="ALL">全部角色</option>
            <option value="ADMIN">系統管理員 (ADMIN)</option>
            <option value="SUPERVISOR">巡店主管 (SUPERVISOR)</option>
            <option value="STAFF">現場同仁 (STAFF)</option>
          </select>
        </div>
      </div>

      {/* 錯誤警告 */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 人員清單列表 */}
      {loading ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          <p>載入人員權限名冊中...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200/80 shadow-xs text-center text-slate-400 text-xs">
          查無符合篩選條件的人員資料。
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((u) => {
            const isActive = u.status === 'ACTIVE';
            const isAdmin = u.role === 'ADMIN';
            const isSupervisor = u.role === 'SUPERVISOR';

            return (
              <div
                key={u.userId}
                className={`bg-white rounded-2xl p-4 border shadow-xs transition-all space-y-2.5 ${
                  isActive ? 'border-slate-200/80' : 'border-red-200 bg-red-50/20 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isAdmin
                          ? 'bg-purple-100 text-purple-700'
                          : isSupervisor
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isAdmin ? '管' : isSupervisor ? '主' : '員'}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-800">{u.name}</span>
                        <span className="font-mono text-xs text-slate-400">({u.userId})</span>

                        {/* 狀態徽章 */}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : u.status === 'LEAVE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.status === 'ACTIVE'
                            ? '在職'
                            : u.status === 'LEAVE'
                            ? '留停/長假'
                            : '離職停用'}
                        </span>

                        {/* 角色徽章 */}
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-700'
                              : isSupervisor
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>

                      {u.lastLogin && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          最後登入：{u.lastLogin}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 操作動作按鈕 */}
                  <div className="flex items-center space-x-1 shrink-0">
                    {/* 非在職人員 (留停/長假 或 離職停用) 提供一鍵恢復在職按鍵 */}
                    {u.status !== 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleRestoreActive(u.userId, u.name)}
                        title="恢復為在職狀態"
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>恢復在職</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleResetPassword(u.userId, u.name)}
                      title="重設密碼為 000000"
                      className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">重設密碼</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      title="編輯資料與站點"
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">編輯</span>
                    </button>
                  </div>
                </div>

                {/* 授權站點清單 */}
                <div className="pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
                    <Store className="w-3 h-3" />
                    <span>授權站點：</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {isAdmin || isSupervisor ? (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold">
                        ★ 全商場 12 站點完全權限
                      </span>
                    ) : u.deptIds && u.deptIds.length > 0 ? (
                      u.deptIds.map((did) => (
                        <span
                          key={did}
                          className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                        >
                          {getDeptDisplayName(did)}
                        </span>
                      ))
                    ) : (

                      <span className="text-[10px] text-slate-400 italic">
                        {isActive ? '尚未指派任何站點' : '帳號已停用（無站點權限）'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增 / 編輯 人員彈窗 */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingUser ? `編輯人員：${editingUser.name} (${editingUser.userId})` : '新增同仁帳號'}
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              <div className="grid grid-cols-2 gap-3">
                {/* 工號 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    員工工號 (User ID)
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) =>
                      setFormData({ ...formData, userId: e.target.value.toUpperCase() })
                    }
                    disabled={Boolean(editingUser)}
                    placeholder="例如：B115050"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>

                {/* 姓名 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    員工姓名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="請輸入全名"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 角色 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    系統角色 (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="ADMIN">系統管理員 (ADMIN)</option>
                    <option value="SUPERVISOR">巡店主管 (SUPERVISOR)</option>
                    <option value="STAFF">現場同仁 (STAFF)</option>
                  </select>
                </div>

                {/* 帳號狀態 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    帳號狀態
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="ACTIVE">在職 (ACTIVE)</option>
                    <option value="LEAVE">留停/長假 (LEAVE)</option>
                    <option value="DISABLED">離職停用 (DISABLED)</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-xl">
                  💡 新增人員預設密碼為 <b>000000</b>，首次登入系統會強制要求其設定專屬密碼。
                </p>
              )}

              {/* 站點授權勾選區 */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    站點授權分配 (User_Depts)
                  </label>
                  <div className="space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleSelectAllDepts(true)}
                      className="text-brand-600 hover:underline cursor-pointer"
                    >
                      全選
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllDepts(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {departments.map((dept) => {
                    const isChecked = formData.deptIds.includes(dept.deptId);
                    return (
                      <label
                        key={dept.deptId}
                        className={`p-2 rounded-xl border text-xs flex items-center space-x-2 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-brand-50 border-brand-500 text-brand-900 font-semibold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDept(dept.deptId)}
                          className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <span className="truncate">{getDeptDisplayName(dept.deptId)}</span>
                      </label>

                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  ※ 系統內建雙向綁定：勾選「本舖」會自動同步勾選「小舖」，反之亦然。
                </p>
              </div>

              {/* 彈窗按鈕列 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>儲存中...</span>
                    </>
                  ) : (
                    <span>確認儲存</span>
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
