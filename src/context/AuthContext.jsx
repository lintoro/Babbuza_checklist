import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'babbuza_token';
const STORAGE_KEY_USER = 'babbuza_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN) || '');
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mustChangePwdModal, setMustChangePwdModal] = useState(false);

  // 載入使用者權限站點清單
  const fetchUserDepts = async (authToken) => {
    try {
      const res = await apiGet({ action: 'get_user_depts', token: authToken });
      if (res.success && res.data) {
        setDepartments(res.data.departments || []);
        if (res.data.user) {
          setUser(res.data.user);
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.data.user));
          if (res.data.user.mustChangePwd) {
            setMustChangePwdModal(true);
          }
        }
      }
    } catch (err) {
      console.warn('載入站點資訊失敗或 Token 已過期:', err.message);
      // 若 Token 失效，自動登出
      if (err.message.includes('過期') || err.message.includes('無效') || err.message.includes('驗證失敗')) {
        logout();
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserDepts(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // 登入
  const login = async (userId, password) => {
    const res = await apiPost({ action: 'login', userId, password });
    if (res.success && res.data) {
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));

      if (newUser.mustChangePwd) {
        setMustChangePwdModal(true);
      }
      await fetchUserDepts(newToken);
      return { success: true };
    }
    return { success: false, error: res.error || '登入失敗' };
  };

  // 登出
  const logout = () => {
    setToken('');
    setUser(null);
    setDepartments([]);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setMustChangePwdModal(false);
  };

  // 變更密碼
  const changePassword = async (oldPassword, newPassword) => {
    if (!user || !token) throw new Error('尚未登入');
    const res = await apiPost({
      action: 'change_password',
      token,
      userId: user.userId,
      oldPassword,
      newPassword,
    });
    if (res.success) {
      // 密碼變更成功後清除強制修改標記
      setUser(prev => ({ ...prev, mustChangePwd: false }));
      setMustChangePwdModal(false);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        departments,
        loading,
        mustChangePwdModal,
        setMustChangePwdModal,
        login,
        logout,
        changePassword,
        refreshDepts: () => fetchUserDepts(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 內使用');
  }
  return context;
}
