/**
 * Babbuza Checklist - 身份認證與帳號安全模組 (Auth.js)
 */

const Auth = {
  /**
   * 使用者登入
   * @param {string} userId - 員工編號 (例: B115050)
   * @param {string} password - 登入密碼
   */
  login: function(userId, password) {
    if (!userId || !password) {
      return { success: false, error: '請輸入員工編號與密碼' };
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    const cleanPwd = String(password).trim();
    const users = Utils.sheetToObjects('Users');
    const user = users.find(u => String(u.User_ID).trim().toUpperCase() === cleanUserId);

    if (!user) {
      return { success: false, error: '查無此員工編號，請確認輸入是否正確' };
    }

    // 檢查是否離職或停用
    if (user.Status === 'DISABLED') {
      return { success: false, error: '此帳號已離職或停用，無法登入系統' };
    }

    // 密碼比對邏輯
    let isPasswordCorrect = false;
    const hasExistingHash = Boolean(user.Password_Hash && String(user.Password_Hash).trim() !== '');

    if (!hasExistingHash) {
      // 首次登入預設密碼：可為自身工號 (大寫) 或 預設 '123456'
      if (cleanPwd === cleanUserId || cleanPwd === '123456') {
        isPasswordCorrect = true;
      }
    } else {
      const computedHash = Utils.sha256(cleanPwd, user.Salt || '');
      if (computedHash === String(user.Password_Hash).trim()) {
        isPasswordCorrect = true;
      }
    }

    if (!isPasswordCorrect) {
      return { success: false, error: '密碼錯誤，請重新確認' };
    }

    // 登入成功，更新最後登入時間
    const sheet = Utils.getSheet('Users');
    const rowIndex = user._rowIndex;
    // 假設 Headers: User_ID(1), Name(2), Role(3), Password_Hash(4), Salt(5), Must_Change_Pwd(6), Token_Version(7), Status(8), Last_Login(9)
    sheet.getRange(rowIndex, 9).setValue(Utils.formatDateTime());

    // 簽發 Token
    const tokenVersion = parseInt(user.Token_Version, 10) || 1;
    const token = Utils.generateToken(user.User_ID, user.Role, tokenVersion);

    return {
      success: true,
      token: token,
      user: {
        userId: user.User_ID,
        name: user.Name,
        role: user.Role,
        mustChangePwd: Boolean(user.Must_Change_Pwd) || !hasExistingHash
      }
    };
  },

  /**
   * 變更密碼
   * @param {string} userId - 員工編號
   * @param {string} oldPassword - 舊密碼 (若首次設定可帶空或原預設)
   * @param {string} newPassword - 新密碼
   * @param {string} token - 認證 Token
   */
  changePassword: function(userId, oldPassword, newPassword, token) {
    // 1. 驗證 Token
    const authCheck = Utils.validateToken(token);
    if (!authCheck.valid) {
      return { success: false, error: authCheck.error };
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    if (authCheck.user.userId.toUpperCase() !== cleanUserId && authCheck.user.role !== 'ADMIN') {
      return { success: false, error: '無權限修改其他使用者的密碼' };
    }

    // 2. 驗證新密碼長度與規範
    const settings = Utils.getSettings();
    const minLen = parseInt(settings.PWD_MIN_LEN, 10) || 6;
    const maxLen = parseInt(settings.PWD_MAX_LEN, 10) || 8;
    const cleanNewPwd = String(newPassword).trim();

    if (cleanNewPwd.length < minLen || cleanNewPwd.length > maxLen) {
      return { success: false, error: `新密碼長度必須介於 ${minLen} 至 ${maxLen} 碼之間` };
    }

    // 3. 讀取使用者
    const users = Utils.sheetToObjects('Users');
    const user = users.find(u => String(u.User_ID).trim().toUpperCase() === cleanUserId);
    if (!user) {
      return { success: false, error: '找不到該使用者' };
    }

    const hasExistingHash = Boolean(user.Password_Hash && String(user.Password_Hash).trim() !== '');
    if (hasExistingHash) {
      const cleanOldPwd = String(oldPassword).trim();
      const checkOldHash = Utils.sha256(cleanOldPwd, user.Salt || '');
      if (checkOldHash !== String(user.Password_Hash).trim()) {
        return { success: false, error: '原舊密碼輸入錯誤' };
      }
    }

    // 4. 計算新加鹽雜湊
    const newSalt = Utils.generateSalt(16);
    const newHash = Utils.sha256(cleanNewPwd, newSalt);
    const currentTokenVersion = parseInt(user.Token_Version, 10) || 1;
    const newTokenVersion = currentTokenVersion + 1;

    // 5. 更新 Users 表格
    // Headers: User_ID(1), Name(2), Role(3), Password_Hash(4), Salt(5), Must_Change_Pwd(6), Token_Version(7), Status(8), Last_Login(9), Created_At(10), Updated_At(11)
    const sheet = Utils.getSheet('Users');
    const rowIndex = user._rowIndex;
    sheet.getRange(rowIndex, 4).setValue(newHash);           // Password_Hash
    sheet.getRange(rowIndex, 5).setValue(newSalt);           // Salt
    sheet.getRange(rowIndex, 6).setValue(false);             // Must_Change_Pwd
    sheet.getRange(rowIndex, 7).setValue(newTokenVersion);   // Token_Version
    sheet.getRange(rowIndex, 11).setValue(Utils.formatDateTime()); // Updated_At

    // 6. 簽發新 Token
    const newToken = Utils.generateToken(user.User_ID, user.Role, newTokenVersion);

    return {
      success: true,
      message: '密碼變更成功',
      token: newToken,
      user: {
        userId: user.User_ID,
        name: user.Name,
        role: user.Role,
        mustChangePwd: false
      }
    };
  }
};
