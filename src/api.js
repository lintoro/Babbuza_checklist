/**
 * 前端 API 呼叫模組 (src/api.js)
 * 負責與 Google Apps Script (GAS) 後端進行通訊
 */

// 支援 Vite define 注入、全域變數或本機自訂 API URL
export const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.__ENV_WEB_APP_URL__) {
    return window.__ENV_WEB_APP_URL__;
  }
  if (typeof __WEB_APP_URL__ !== 'undefined' && __WEB_APP_URL__) {
    return __WEB_APP_URL__;
  }
  const custom = localStorage.getItem('BABBUZA_API_URL');
  if (custom) return custom;
  return '';
};

/**
 * 執行 GET 請求
 */
export async function apiGet(params = {}) {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('未設定後端 API URL，請檢查環境變數或設定檔');
  }

  const query = new URLSearchParams(params).toString();
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`網路通訊錯誤 (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success && data.error) {
    throw new Error(data.error);
  }
  return data;
}

/**
 * 執行 POST 請求
 * 特別注意：使用 text/plain;charset=utf-8 傳送以規避 GAS 的 CORS preflight 限制
 */
export async function apiPost(payload = {}) {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('未設定後端 API URL，請檢查環境變數或設定檔');
  }

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`伺服器回應錯誤 (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success && data.error) {
    throw new Error(data.error);
  }
}

/**
 * 取得台北時區 (Asia/Taipei, UTC+8) 的 YYYY-MM-DD 字串
 * 杜絕 UTC 跨日轉換 (00:00~08:00) 導致日期倒退一天的問題
 */
export function getTaipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
