/**
 * Babbuza Checklist - 通用工具函式庫 (Utils.js)
 */

const Utils = {
  /**
   * 取得主試算表物件
   */
  getSpreadsheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    try {
      if (ss && ss.getSpreadsheetTimeZone() !== 'Asia/Taipei') {
        ss.setSpreadsheetTimeZone('Asia/Taipei');
      }
    } catch (e) {
      console.warn('Set spreadsheet timezone failed:', e);
    }
    return ss;
  },

  /**
   * 取得指定工作表
   */
  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    return sheet;
  },

  /**
   * 讀取工作表並轉換為物件陣列 (第一列為欄位鍵名)
   */
  sheetToObjects: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0].map(h => String(h).trim());
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 若整列皆為空則略過
      if (row.every(cell => cell === '' || cell === null)) continue;

      const obj = { _rowIndex: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        if (key) {
          obj[key] = row[j];
        }
      }
      result.push(obj);
    }
    return result;
  },

  /**
   * 讀取 Settings 表設定並轉為 Key-Value 物件
   */
  getSettings: function() {
    const rows = this.sheetToObjects('Settings');
    const settings = {
      TOKEN_DAYS: 7,
      LOGIN_MAX_FAIL: 5,
      LOGIN_LOCK_MIN: 15,
      PWD_MIN_LEN: 6,
      PWD_MAX_LEN: 8,
      DEFAULT_OPEN_DEADLINE: '10:30',
      DEFAULT_CLOSE_DEADLINE: '20:00'
    };
    rows.forEach(r => {
      if (r.Key) {
        settings[r.Key] = r.Value;
      }
    });
    return settings;
  },

  /**
   * 取得系統安全密鑰 (優先自雲端 Script Properties 取得，杜絕程式碼硬編碼)
   */
  getSecretKey: function() {
    let secret = PropertiesService.getScriptProperties().getProperty('SECRET_KEY');
    if (!secret) {
      const settings = this.getSettings();
      secret = settings.SECRET_KEY;
    }
    if (!secret) {
      // 若尚未設定，自動生成一組 32 碼高強度隨機密鑰並安全寫入 ScriptProperties
      secret = this.generateSalt(32);
      PropertiesService.getScriptProperties().setProperty('SECRET_KEY', secret);
    }
    return secret;
  },

  /**
   * SHA-256 雜湊計算 (支援加鹽)
   */
  sha256: function(str, salt = '') {
    const combined = String(str) + String(salt);
    const rawHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      combined,
      Utilities.Charset.UTF_8
    );
    return rawHash.map(b => {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  },

  /**
   * 產生隨機鹽值 (16碼英數)
   */
  generateSalt: function(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  },

  /**
   * 產生安全的 Session Token
   * 格式: base64(userId:role:timestamp:tokenVersion:signature)
   */
  generateToken: function(userId, role, tokenVersion) {
    const secretKey = this.getSecretKey();
    const timestamp = Date.now();
    const payload = `${userId}:${role}:${timestamp}:${tokenVersion}`;
    const signature = this.sha256(payload, secretKey);
    const fullStr = `${payload}:${signature}`;
    return Utilities.base64Encode(fullStr);
  },

  /**
   * 驗證 Session Token
   */
  validateToken: function(tokenStr) {
    if (!tokenStr) return { valid: false, error: '缺少認證 Token' };
    try {
      const decoded = Utilities.newBlob(Utilities.base64Decode(tokenStr)).getDataAsString();
      const parts = decoded.split(':');
      if (parts.length < 5) return { valid: false, error: 'Token 格式不合規' };

      const [userId, role, timestampStr, tokenVersionStr, signature] = parts;
      const settings = this.getSettings();
      const secretKey = this.getSecretKey();
      const payload = `${userId}:${role}:${timestampStr}:${tokenVersionStr}`;
      const expectedSign = this.sha256(payload, secretKey);

      if (signature !== expectedSign) {
        return { valid: false, error: 'Token 簽章無效' };
      }

      const timestamp = parseInt(timestampStr, 10);
      const tokenDays = parseInt(settings.TOKEN_DAYS, 10) || 7;
      const maxAgeMs = tokenDays * 24 * 60 * 60 * 1000;

      if (Date.now() - timestamp > maxAgeMs) {
        return { valid: false, error: 'Token 已逾期，請重新登入' };
      }

      // 檢查 Users 表驗證版本與帳號狀態
      const users = this.sheetToObjects('Users');
      const user = users.find(u => String(u.User_ID).trim().toUpperCase() === String(userId).trim().toUpperCase());
      if (!user) {
        return { valid: false, error: '使用者不存在' };
      }
      if (user.Status === 'DISABLED') {
        return { valid: false, error: '此帳號已停用或已離職' };
      }
      if (user.Status === 'LEAVE') {
        return { valid: false, error: '此帳號為留職停薪/長假狀態，已暫停登入使用權限' };
      }
      if (parseInt(user.Token_Version, 10) !== parseInt(tokenVersionStr, 10)) {
        return { valid: false, error: 'Token 已失效，密碼可能已變更' };
      }

      return {
        valid: true,
        user: {
          userId: user.User_ID,
          name: user.Name,
          role: user.Role,
          mustChangePwd: Boolean(user.Must_Change_Pwd)
        }
      };
    } catch (e) {
      return { valid: false, error: 'Token 解密失敗: ' + e.message };
    }
  },

  /**
   * 格式化台北時區日期 YYYY-MM-DD
   */
  formatDate: function(date = new Date()) {
    return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
  },

  /**
   * 格式化台北時區時間 YYYY-MM-DD HH:mm:ss
   */
  formatDateTime: function(date = new Date()) {
    return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  },

  /**
   * 格式化純時間 HH:mm (台北時區)
   * 嚴格禁止以當前時間作為預設值，空值嚴格回傳空字串
   */
  formatTime: function(val) {
    if (!val || val === '') return '';
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // 若為 ISO 字串例如 2026-10-15T09:50:00.000Z，轉為台北時間
      if (trimmed.includes('T') || trimmed.includes('Z')) {
        try {
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) {
            return Utilities.formatDate(d, 'Asia/Taipei', 'HH:mm');
          }
        } catch (e) {}
      }
      const match = trimmed.match(/(\d{1,2}:\d{2})/);
      if (match) {
        const parts = match[1].split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return trimmed;
    }
    if (val instanceof Date) {
      // 一律強制以台灣台北標準時區 (Asia/Taipei) 格式化為 HH:mm，杜絕 UTC 偏差
      return Utilities.formatDate(val, 'Asia/Taipei', 'HH:mm');
    }
    return String(val);
  },

  /**
   * 取得當前台北時間 HH:mm (純字串比對用)
   */
  getCurrentTaipeiTime: function() {
    return Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm');
  },

  /**
   * 批次正規化 Departments 表格的時間為純字串，避免 Google Sheets Date 格式時區偏移
   */
  normalizeDepartmentTimes: function() {
    try {
      const ss = this.getSpreadsheet();
      if (ss) {
        ss.setSpreadsheetTimeZone('Asia/Taipei');
      }
      const sheet = this.getSheet('Departments');
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());

      const openStartCol = headers.indexOf('Open_Start_Time');
      const openDeadCol = headers.indexOf('Open_Deadline');
      const closeStartCol = headers.indexOf('Close_Start_Time');
      const closeDeadCol = headers.indexOf('Close_Deadline');

      if (openStartCol === -1 || closeStartCol === -1) return;

      for (let i = 1; i < data.length; i++) {
        let curOpenStart = this.formatTime(data[i][openStartCol]);
        if (!curOpenStart || curOpenStart < '06:00' || curOpenStart > '14:00') curOpenStart = '09:30';

        let curOpenDead = this.formatTime(data[i][openDeadCol]);
        if (!curOpenDead || curOpenDead < '07:00' || curOpenDead > '16:00') curOpenDead = '10:30';

        let curCloseStart = this.formatTime(data[i][closeStartCol]);
        if (!curCloseStart || curCloseStart < '13:00' || curCloseStart > '23:59') curCloseStart = '16:45';

        let curCloseDead = this.formatTime(data[i][closeDeadCol]);
        if (!curCloseDead || curCloseDead < '15:00' || curCloseDead > '23:59') curCloseDead = '20:00';

        sheet.getRange(i + 1, openStartCol + 1).setNumberFormat('@').setValue(curOpenStart);
        sheet.getRange(i + 1, openDeadCol + 1).setNumberFormat('@').setValue(curOpenDead);
        sheet.getRange(i + 1, closeStartCol + 1).setNumberFormat('@').setValue(curCloseStart);
        sheet.getRange(i + 1, closeDeadCol + 1).setNumberFormat('@').setValue(curCloseDead);
      }
    } catch (e) {
      console.warn('normalizeDepartmentTimes error:', e);
    }
  },

  /**
   * 批次檢查並修正 Audit_Logs 表格的時間為純字串，避免試算表底層日期格式時區偏移
   */
  normalizeAuditLogsTimes: function() {
    try {
      const sheet = this.getSheet('Audit_Logs');
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const headers = data[0].map(h => String(h).trim());
      const submitCol = headers.indexOf('Submit_Time');
      const deadCol = headers.indexOf('Deadline');
      const stageCol = headers.indexOf('Stage');

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const stg = stageCol !== -1 ? String(row[stageCol]).toUpperCase() : '';

        // 1. 處理 Submit_Time
        if (submitCol !== -1) {
          const val = row[submitCol];
          if (val instanceof Date) {
            let formatted = Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
            // 若因為之前試算表被預設美西時區 (UTC-7) 導致今天 17:xx 變成了 08:xx，在此進行校正
            const timePart = formatted.split(' ')[1] || '';
            if (stg === 'CLOSE' && timePart >= '07:00:00' && timePart <= '11:00:00') {
              // 補回 9 小時差距
              const fixedDate = new Date(val.getTime() + 9 * 60 * 60 * 1000);
              formatted = Utilities.formatDate(fixedDate, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
            }
            sheet.getRange(i + 1, submitCol + 1).setNumberFormat('@').setValue(formatted);
          } else if (typeof val === 'string' && val.includes('T')) {
            // ISO 字串格式處理
            try {
              const d = new Date(val);
              if (!isNaN(d.getTime())) {
                let formatted = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
                sheet.getRange(i + 1, submitCol + 1).setNumberFormat('@').setValue(formatted);
              }
            } catch (e) {}
          }
        }

        // 2. 處理 Deadline
        if (deadCol !== -1) {
          const dVal = row[deadCol];
          let dStr = this.formatTime(dVal);
          if (stg === 'OPEN' && (!dStr || dStr < '07:00' || dStr > '16:00')) {
            dStr = '10:30';
            sheet.getRange(i + 1, deadCol + 1).setNumberFormat('@').setValue(dStr);
          } else if (stg === 'CLOSE' && (!dStr || dStr < '15:00' || dStr > '23:59')) {
            dStr = '20:00';
            sheet.getRange(i + 1, deadCol + 1).setNumberFormat('@').setValue(dStr);
          }
        }
      }
    } catch (e) {
      console.warn('normalizeAuditLogsTimes error:', e);
    }
  },

  /**
   * 判斷指定日期是否為休館日或國定假日
   */
  checkDayType: function(dateStr) {
    const calendar = this.sheetToObjects('Calendar');
    const matched = calendar.find(c => {
      let d = c.Date;
      if (d instanceof Date) d = this.formatDate(d);
      return String(d).trim() === String(dateStr).trim();
    });

    if (matched) {
      return matched.Day_Type; // HOLIDAY 或 CLOSED
    }

    // 檢查是否為週末
    const d = new Date(dateStr + 'T00:00:00+08:00');
    const day = d.getDay();
    if (day === 0 || day === 6) {
      return 'WEEKEND';
    }
    return 'WORKDAY';
  },

  /**
   * 標準化 JSON 回傳物件
   */
  jsonResponse: function(data, success = true, error = null) {
    const payload = {
      success: success,
      timestamp: this.formatDateTime(),
      data: data,
      error: error
    };
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }
};
