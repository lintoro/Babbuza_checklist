/**
 * Babbuza Checklist - 身份認證與帳號安全模組 (Auth.js)
 */

const Auth = {
  /**
   * 使用者登入
   * @param {string} userId - 員工編號 (例: B110001)
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

    // 檢查是否離職或留停
    if (user.Status === 'DISABLED') {
      return { success: false, error: '此帳號已離職停用，無法登入系統' };
    }
    if (user.Status === 'LEAVE') {
      return { success: false, error: '此帳號目前為留職停薪/長假狀態，暫停登入系統' };
    }

    // 密碼比對邏輯
    let isPasswordCorrect = false;
    const hasExistingHash = Boolean(user.Password_Hash && String(user.Password_Hash).trim() !== '');
    const isMustChangeMarked = Boolean(user.Must_Change_Pwd === true || String(user.Must_Change_Pwd).toUpperCase() === 'TRUE');

    if (!hasExistingHash) {
      // 尚未設定密碼：允許使用預設密碼 000000 登入
      if (cleanPwd === '000000') {
        isPasswordCorrect = true;
      }
    } else {
      const computedHash = Utils.sha256(cleanPwd, user.Salt || '');
      if (computedHash === String(user.Password_Hash).trim()) {
        isPasswordCorrect = true;
      } else if (cleanPwd === '000000' && isMustChangeMarked) {
        // 僅在被管理員重設且標記為需改密時，允許以 000000 登入
        isPasswordCorrect = true;
      }
    }

    if (!isPasswordCorrect) {
      return { success: false, error: '密碼錯誤，請重新確認' };
    }

    // 登入成功，更新最後登入時間
    const sheet = Utils.getSheet('Users');
    const rowIndex = user._rowIndex;
    const isUsingDefault = (cleanPwd === '000000');
    
    // 判定是否需要強制修改密碼：
    // 只有在「使用預設密碼 000000」或「尚未有密碼雜湊」時才強制修改！
    // 若使用者輸入的是自己設定的新密碼且雜湊相符，則絕不強制改密，並自動解除 Must_Change_Pwd 標記
    let shouldForceChange = false;
    if (isUsingDefault || !hasExistingHash) {
      shouldForceChange = true;
    } else if (isMustChangeMarked) {
      // 使用者已使用自訂密碼驗證通過，自動消除殘留的 Must_Change_Pwd 標記
      sheet.getRange(rowIndex, 6).setValue(false);
      shouldForceChange = false;
    }

    // Headers: User_ID(1), Name(2), Role(3), Password_Hash(4), Salt(5), Must_Change_Pwd(6), Token_Version(7), Status(8), Last_Login(9)
    sheet.getRange(rowIndex, 9).setValue(Utils.formatDateTime());
    if (shouldForceChange) {
      sheet.getRange(rowIndex, 6).setValue(true); // 強制下次/當前必須修改密碼
    }

    // 簽發 Token
    const tokenVersion = parseInt(user.Token_Version, 10) || 1;
    const token = Utils.generateToken(user.User_ID, user.Role, tokenVersion);
    Utils.invalidateCache('Users');

    // 順帶回傳可存取之站點，減少前端額外往返請求
    let userDepts = [];
    try {
      if (typeof Checklist !== 'undefined' && Checklist.getUserDepartments) {
        userDepts = Checklist.getUserDepartments(user);
      }
    } catch (e) {
      console.warn('Get user departments during login failed:', e);
    }

    return {
      success: true,
      token: token,
      user: {
        userId: user.User_ID,
        name: user.Name,
        role: user.Role,
        mustChangePwd: shouldForceChange
      },
      departments: userDepts
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
        if (!(cleanOldPwd === '000000' && user.Must_Change_Pwd)) {
          return { success: false, error: '原舊密碼輸入錯誤' };
        }
      }
    }

    // 4. 計算新加鹽雜湊
    const newSalt = Utils.generateSalt(16);
    const newHash = Utils.sha256(cleanNewPwd, newSalt);
    const currentTokenVersion = parseInt(user.Token_Version, 10) || 1;
    const newTokenVersion = currentTokenVersion + 1;

    // 5. 批次更新 Users 表格
    // Headers: User_ID(1), Name(2), Role(3), Password_Hash(4), Salt(5), Must_Change_Pwd(6), Token_Version(7), Status(8), Last_Login(9), Created_At(10), Updated_At(11)
    const sheet = Utils.getSheet('Users');
    const rowIndex = user._rowIndex;
    // 一次性寫入 Password_Hash, Salt, Must_Change_Pwd, Token_Version (欄位 4~7)
    sheet.getRange(rowIndex, 4, 1, 4).setValues([[newHash, newSalt, false, newTokenVersion]]);
    sheet.getRange(rowIndex, 11).setValue(Utils.formatDateTime()); // Updated_At
    Utils.invalidateCache('Users');

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
  },

  /**
   * 重設所有員工密碼為預設密碼 (加鹽 SHA-256)
   * @param {string} defaultPwd - 預設密碼，預設為 '000000'
   */
  resetAllDefaultPasswords: function(defaultPwd = '000000') {
    const sheet = Utils.getSheet('Users');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, count: 0 };

    const headers = data[0].map(h => String(h).trim());
    const hashColIdx = headers.indexOf('Password_Hash');
    const saltColIdx = headers.indexOf('Salt');
    const mustChangeColIdx = headers.indexOf('Must_Change_Pwd');
    const updatedColIdx = headers.indexOf('Updated_At');

    if (hashColIdx === -1 || saltColIdx === -1) {
      throw new Error('Users 表缺少 Password_Hash 或 Salt 欄位');
    }

    let count = 0;
    const nowStr = Utils.formatDateTime();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.every(cell => cell === '' || cell === null)) continue;

      const salt = Utils.generateSalt(16);
      const hash = Utils.sha256(defaultPwd, salt);

      data[i][hashColIdx] = hash;
      data[i][saltColIdx] = salt;
      if (mustChangeColIdx !== -1) {
        data[i][mustChangeColIdx] = true;
      }
      if (updatedColIdx !== -1) {
        data[i][updatedColIdx] = nowStr;
      }
      count++;
    }

    // 批次寫回工作表
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    return {
      success: true,
      count: count,
      message: `已成功將 ${count} 位員工密碼預設為 ${defaultPwd} 並加鹽加密`
    };
  },

  /**
   * 初始化設定系統管理員 (ADMIN)
   * @param {string} targetUserId - 指定管理員工號 (若無傳入則讀取系統設定)
   */
  initFirstAdmin: function(targetUserId) {
    const adminId = String(
      targetUserId ||
      PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID') ||
      'ADMIN'
    ).trim().toUpperCase();

    const sheet = Utils.getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('User_ID');
    const roleCol = headers.indexOf('Role');
    const hashCol = headers.indexOf('Password_Hash');
    const saltCol = headers.indexOf('Salt');
    const mustChangeCol = headers.indexOf('Must_Change_Pwd');
    const statusCol = headers.indexOf('Status');
    const updatedCol = headers.indexOf('Updated_At');

    const salt = Utils.generateSalt(16);
    const hash = Utils.sha256('000000', salt);
    const nowStr = Utils.formatDateTime();

    let foundIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim().toUpperCase() === adminId) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      sheet.getRange(foundIndex + 1, roleCol + 1).setValue('ADMIN');
      sheet.getRange(foundIndex + 1, hashCol + 1).setValue(hash);
      sheet.getRange(foundIndex + 1, saltCol + 1).setValue(salt);
      sheet.getRange(foundIndex + 1, mustChangeCol + 1).setValue(true);
      sheet.getRange(foundIndex + 1, statusCol + 1).setValue('ACTIVE');
      sheet.getRange(foundIndex + 1, updatedCol + 1).setValue(nowStr);
      return { success: true, message: `管理員 [${adminId}] 已成功更新為 ADMIN 並重設密碼為 000000` };
    } else {
      // 若原先名冊中無該管理員，則直接新增
      sheet.appendRow([adminId, '系統管理員', 'ADMIN', hash, salt, true, 1, 'ACTIVE', '', nowStr, nowStr]);
      return { success: true, message: `已建立管理員 [${adminId}] 系統管理員帳號 (密碼 000000)` };
    }
  },

  /**
   * 管理員取得所有員工清單 (含站點關聯)
   */
  adminGetUsers: function(currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可檢視人員名冊' };
    }

    const users = Utils.sheetToObjects('Users');
    const userDepts = Utils.sheetToObjects('User_Depts');
    const allDepts = Utils.sheetToObjects('Departments');

    const deptMap = {};
    userDepts.forEach(ud => {
      if (!ud.User_ID || !ud.Is_Active) return;
      const uid = String(ud.User_ID).trim().toUpperCase();
      if (!deptMap[uid]) deptMap[uid] = [];
      deptMap[uid].push(ud.Dept_ID);
    });

    const result = users.map(u => {
      const uid = String(u.User_ID).trim().toUpperCase();
      let depts = deptMap[uid] || [];
      if (depts.includes('BENPU') && !depts.includes('XIAOPU')) depts.push('XIAOPU');
      if (depts.includes('XIAOPU') && !depts.includes('BENPU')) depts.push('BENPU');

      return {
        userId: u.User_ID,
        name: u.Name,
        role: u.Role || 'STAFF',
        status: u.Status || 'ACTIVE',
        mustChangePwd: Boolean(u.Must_Change_Pwd),
        lastLogin: u.Last_Login ? Utils.formatDateTime(u.Last_Login) : '',
        deptIds: depts
      };
    });

    return {
      success: true,
      users: result,
      departments: allDepts.filter(d => Boolean(d.Is_Active)).map(d => ({
        deptId: d.Dept_ID,
        deptName: d.Dept_Name,
        deptType: d.Dept_Type
      }))
    };
  },

  /**
   * 管理員新增或修改員工資料 (同步更新 User_Depts)
   */
  adminSaveUser: function(userData, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可編輯人員資料' };
    }

    const userId = String(userData.userId || '').trim().toUpperCase();
    const name = String(userData.name || '').trim();
    const role = String(userData.role || 'STAFF').trim().toUpperCase();
    const status = String(userData.status || 'ACTIVE').trim().toUpperCase();
    let deptIds = Array.isArray(userData.deptIds) ? userData.deptIds : [];

    if (!userId) return { success: false, error: '請填寫員工工號' };
    if (!name) return { success: false, error: '請填寫員工姓名' };

    // 雙向綁定規則：若有 BENPU 或 XIAOPU，自動兩者皆有
    if (deptIds.includes('BENPU') && !deptIds.includes('XIAOPU')) deptIds.push('XIAOPU');
    if (deptIds.includes('XIAOPU') && !deptIds.includes('BENPU')) deptIds.push('BENPU');

    const usersSheet = Utils.getSheet('Users');
    const usersData = usersSheet.getDataRange().getValues();
    const headers = usersData[0].map(h => String(h).trim());

    const idCol = headers.indexOf('User_ID');
    const nameCol = headers.indexOf('Name');
    const roleCol = headers.indexOf('Role');
    const statusCol = headers.indexOf('Status');
    const updatedCol = headers.indexOf('Updated_At');

    const nowStr = Utils.formatDateTime();
    let targetRow = -1;

    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][idCol]).trim().toUpperCase() === userId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow !== -1) {
      usersSheet.getRange(targetRow, nameCol + 1).setValue(name);
      usersSheet.getRange(targetRow, roleCol + 1).setValue(role);
      usersSheet.getRange(targetRow, statusCol + 1).setValue(status);
      usersSheet.getRange(targetRow, updatedCol + 1).setValue(nowStr);
    } else {
      const salt = Utils.generateSalt(16);
      const hash = Utils.sha256('000000', salt);
      usersSheet.appendRow([userId, name, role, hash, salt, true, 1, status, '', nowStr, nowStr]);
    }

    // 同步更新 User_Depts 表
    const udSheet = Utils.getSheet('User_Depts');
    const udData = udSheet.getDataRange().getValues();
    const udHeaders = udData[0];
    const numCols = udHeaders.length;
    const newUdRows = [];
    newUdRows.push(udHeaders);

    for (let i = 1; i < udData.length; i++) {
      const row = udData[i];
      if (String(row[0]).trim().toUpperCase() !== userId) {
        newUdRows.push(row);
      }
    }


    if (status === 'ACTIVE' || status === 'LEAVE') {
      deptIds.forEach((deptId, idx) => {
        const newRow = new Array(numCols).fill('');
        newRow[0] = userId;
        newRow[1] = deptId;
        newRow[2] = (idx === 0);
        newRow[3] = true;
        if (numCols >= 5) {
          newRow[4] = nowStr;
        }
        newUdRows.push(newRow);
      });
    }

    udSheet.clearContents();
    udSheet.getRange(1, 1, newUdRows.length, numCols).setValues(newUdRows);

    return {
      success: true,
      message: `同仁 [${userId}] ${name} 資料與站點授權已儲存成功`
    };
  },

  /**
   * 管理員快速切換員工狀態 (例如：一鍵恢復在職)
   */
  adminSetUserStatus: function(userId, newStatus, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可切換人員狀態' };
    }

    const cleanUserId = String(userId || '').trim().toUpperCase();
    const cleanStatus = String(newStatus || 'ACTIVE').trim().toUpperCase();
    if (!cleanUserId) return { success: false, error: '缺少員工工號' };

    const usersSheet = Utils.getSheet('Users');
    const usersData = usersSheet.getDataRange().getValues();
    const headers = usersData[0].map(h => String(h).trim());

    const idCol = headers.indexOf('User_ID');
    const statusCol = headers.indexOf('Status');
    const updatedCol = headers.indexOf('Updated_At');

    let targetRow = -1;
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][idCol]).trim().toUpperCase() === cleanUserId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: '找不到該同仁資料' };
    }

    const nowStr = Utils.formatDateTime();
    usersSheet.getRange(targetRow, statusCol + 1).setValue(cleanStatus);
    usersSheet.getRange(targetRow, updatedCol + 1).setValue(nowStr);

    // 若設定為離職或留停，立即遞增 Token_Version 使既有連線 Token 瞬間失效
    const tokenVerCol = headers.indexOf('Token_Version');
    if (tokenVerCol !== -1 && (cleanStatus === 'LEAVE' || cleanStatus === 'DISABLED')) {
      const currentVer = parseInt(usersData[targetRow - 1][tokenVerCol], 10) || 1;
      usersSheet.getRange(targetRow, tokenVerCol + 1).setValue(currentVer + 1);
    }

    return {
      success: true,
      message: `同仁 [${cleanUserId}] 狀態已更新為 ${cleanStatus}，且已同步使舊 Token 作廢`
    };
  },


  /**
   * 管理員重設指定員工密碼為 000000
   */
  adminResetUserPassword: function(targetUserId, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可重設他人密碼' };
    }

    const cleanId = String(targetUserId).trim().toUpperCase();
    const sheet = Utils.getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('User_ID');
    const hashCol = headers.indexOf('Password_Hash');
    const saltCol = headers.indexOf('Salt');
    const mustChangeCol = headers.indexOf('Must_Change_Pwd');
    const tokenVerCol = headers.indexOf('Token_Version');
    const updatedCol = headers.indexOf('Updated_At');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim().toUpperCase() === cleanId) {
        const salt = Utils.generateSalt(16);
        const hash = Utils.sha256('000000', salt);
        const nextTokenVer = (parseInt(data[i][tokenVerCol], 10) || 1) + 1;

        sheet.getRange(i + 1, hashCol + 1, 1, 4).setValues([[hash, salt, true, nextTokenVer]]);
        sheet.getRange(i + 1, updatedCol + 1).setValue(Utils.formatDateTime());
        Utils.invalidateCache('Users');

        return {
          success: true,
          message: `員工 [${cleanId}] 密碼已重設為 000000，並已強制下次登入修改`
        };
      }
    }

    return { success: false, error: '找不到該員工' };
  },

  /**
   * 管理員刪除指定同仁紀錄 (包含 Users 與 User_Depts)
   */
  adminDeleteUser: function(targetUserId, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可刪除人員' };
    }

    const cleanId = String(targetUserId).trim().toUpperCase();
    if (currentUser && cleanId === String(currentUser.userId).trim().toUpperCase()) {
      return { success: false, error: '不可刪除當前登入之管理員帳號' };
    }

    const usersSheet = Utils.getSheet('Users');
    const usersData = usersSheet.getDataRange().getValues();
    const idCol = usersData[0].indexOf('User_ID');

    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][idCol]).trim().toUpperCase() === cleanId) {
        usersSheet.deleteRow(i + 1);
        break;
      }
    }

    // 清理 User_Depts
    const udSheet = Utils.getSheet('User_Depts');
    const udData = udSheet.getDataRange().getValues();
    const headers = udData[0];
    const newUdRows = [headers];
    for (let i = 1; i < udData.length; i++) {
      if (String(udData[i][0]).trim().toUpperCase() !== cleanId) {
        newUdRows.push(udData[i]);
      }
    }
    udSheet.clearContents();
    udSheet.getRange(1, 1, newUdRows.length, headers.length).setValues(newUdRows);

    return { success: true, message: `已成功刪除員工 [${cleanId}]` };
  }
};



