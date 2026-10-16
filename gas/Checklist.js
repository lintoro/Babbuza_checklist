/**
 * Babbuza Checklist - 點檢項目與站點模組 (Checklist.js)
 */

const Checklist = {
  resolveTime: function(rawVal, defaultVal, minValid, maxValid) {
    const formatted = Utils.formatTime(rawVal);
    if (!formatted) return defaultVal;
    if (minValid && formatted < minValid) return defaultVal;
    if (maxValid && formatted > maxValid) return defaultVal;
    return formatted;
  },

  /**
   * 取得同仁可執行的站點清單
   * @param {string} userId - 員工編號
   * @param {string} role - 角色 (STAFF / SUPERVISOR / ADMIN)
   */
  getUserDepartments: function(userId, role) {
    const allDepts = Utils.sheetToObjects('Departments')
      .filter(d => Boolean(d.Is_Active))
      .sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    // 管理員或主管擁有全商場站點權限
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
      return allDepts.map((d, idx) => ({
        deptId: d.Dept_ID,
        deptName: d.Dept_Name,
        deptType: d.Dept_Type,
        openStartTime: this.resolveTime(d.Open_Start_Time, '09:30', '06:00', '14:00'),
        openDeadline: this.resolveTime(d.Open_Deadline, '10:30', '07:00', '16:00'),
        closeStartTime: this.resolveTime(d.Close_Start_Time, '16:45', '13:00', '23:59'),
        closeDeadline: this.resolveTime(d.Close_Deadline, '20:00', '15:00', '23:59'),
        isPrimary: idx === 0
      }));
    }

    // 一般同仁依據 User_Depts 表查詢
    const userDepts = Utils.sheetToObjects('User_Depts')
      .filter(ud => String(ud.User_ID).trim().toUpperCase() === String(userId).trim().toUpperCase() && Boolean(ud.Is_Active));

    let allowedDeptIds = userDepts.map(ud => ud.Dept_ID);

    // 業務鐵律：本小舖雙向綁定 (有 BENPU 就必有 XIAOPU，反之亦然)
    if (allowedDeptIds.includes('BENPU') && !allowedDeptIds.includes('XIAOPU')) {
      allowedDeptIds.push('XIAOPU');
    } else if (allowedDeptIds.includes('XIAOPU') && !allowedDeptIds.includes('BENPU')) {
      allowedDeptIds.push('BENPU');
    }

    const primaryRecord = userDepts.find(ud => Boolean(ud.Is_Primary));
    const primaryDeptId = primaryRecord ? primaryRecord.Dept_ID : (allowedDeptIds[0] || '');

    return allDepts
      .filter(d => allowedDeptIds.includes(d.Dept_ID))
      .map(d => ({
        deptId: d.Dept_ID,
        deptName: d.Dept_Name,
        deptType: d.Dept_Type,
        openStartTime: this.resolveTime(d.Open_Start_Time, '09:30', '06:00', '14:00'),
        openDeadline: this.resolveTime(d.Open_Deadline, '10:30', '07:00', '16:00'),
        closeStartTime: this.resolveTime(d.Close_Start_Time, '16:45', '13:00', '23:59'),
        closeDeadline: this.resolveTime(d.Close_Deadline, '20:00', '15:00', '23:59'),
        isPrimary: d.Dept_ID === primaryDeptId
      }));
  },

  /**
   * 管理員取得所有站點清單 (含現行營運與停用刪除)
   */
  getAllDepartments: function(currentUser) {
    const depts = Utils.sheetToObjects('Departments')
      .sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    return {
      success: true,
      departments: depts.map(d => ({
        deptId: d.Dept_ID,
        deptName: d.Dept_Name,
        deptType: d.Dept_Type || 'STORE',
        openStartTime: this.resolveTime(d.Open_Start_Time, '09:30', '06:00', '14:00'),
        openDeadline: this.resolveTime(d.Open_Deadline, '10:30', '07:00', '16:00'),
        closeStartTime: this.resolveTime(d.Close_Start_Time, '16:45', '13:00', '23:59'),
        closeDeadline: this.resolveTime(d.Close_Deadline, '20:00', '15:00', '23:59'),
        sortOrder: parseInt(d.Sort_Order, 10) || 0,
        isActive: Boolean(d.Is_Active)
      }))
    };
  },

  /**
   * 管理員儲存站點規格 (新增或編輯)
   */
  saveDepartment: function(deptData, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可編輯站點規格' };
    }

    const deptId = String(deptData.deptId || '').trim().toUpperCase();
    const deptName = String(deptData.deptName || '').trim();
    if (!deptId) return { success: false, error: '請填寫站點代碼' };
    if (!deptName) return { success: false, error: '請填寫站點名稱' };

    const deptType = String(deptData.deptType || 'STORE').trim();
    const openStartTime = String(deptData.openStartTime || '09:30').trim();
    const openDeadline = String(deptData.openDeadline || '10:30').trim();
    const closeStartTime = String(deptData.closeStartTime || '16:45').trim();
    const closeDeadline = String(deptData.closeDeadline || '20:00').trim();
    const sortOrder = parseInt(deptData.sortOrder, 10) || 0;
    const isActive = deptData.isActive !== false;

    const sheet = Utils.getSheet('Departments');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    // 取得或動態擴充欄位 index
    let openStartCol = headers.indexOf('Open_Start_Time');
    let closeStartCol = headers.indexOf('Close_Start_Time');

    if (openStartCol === -1) {
      openStartCol = headers.length;
      sheet.getRange(1, openStartCol + 1).setValue('Open_Start_Time');
      headers.push('Open_Start_Time');
    }
    if (closeStartCol === -1) {
      closeStartCol = headers.length;
      sheet.getRange(1, closeStartCol + 1).setValue('Close_Start_Time');
      headers.push('Close_Start_Time');
    }

    const idCol = headers.indexOf('Dept_ID');
    const nameCol = headers.indexOf('Dept_Name');
    const typeCol = headers.indexOf('Dept_Type');
    const openDeadCol = headers.indexOf('Open_Deadline');
    const closeDeadCol = headers.indexOf('Close_Deadline');
    const sortCol = headers.indexOf('Sort_Order');
    const activeCol = headers.indexOf('Is_Active');

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim().toUpperCase() === deptId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow !== -1) {
      // 編輯更新既有站點
      sheet.getRange(targetRow, nameCol + 1).setValue(deptName);
      if (typeCol !== -1) sheet.getRange(targetRow, typeCol + 1).setValue(deptType);
      sheet.getRange(targetRow, openDeadCol + 1).setValue(openDeadline);
      sheet.getRange(targetRow, closeDeadCol + 1).setValue(closeDeadline);
      sheet.getRange(targetRow, openStartCol + 1).setValue(openStartTime);
      sheet.getRange(targetRow, closeStartCol + 1).setValue(closeStartTime);
      if (sortCol !== -1) sheet.getRange(targetRow, sortCol + 1).setValue(sortOrder);
      if (activeCol !== -1) sheet.getRange(targetRow, activeCol + 1).setValue(isActive);

      return {
        success: true,
        isNew: false,
        message: `站點 [${deptId}] ${deptName} 設定已更新`
      };
    } else {
      // 新增站點
      const newRow = new Array(headers.length).fill('');
      newRow[idCol] = deptId;
      newRow[nameCol] = deptName;
      if (typeCol !== -1) newRow[typeCol] = deptType;
      newRow[openDeadCol] = openDeadline;
      newRow[closeDeadCol] = closeDeadline;
      newRow[openStartCol] = openStartTime;
      newRow[closeStartCol] = closeStartTime;
      if (sortCol !== -1) newRow[sortCol] = sortOrder;
      if (activeCol !== -1) newRow[activeCol] = isActive;

      sheet.appendRow(newRow);

      return {
        success: true,
        isNew: true,
        message: `已新增站點 [${deptId}] ${deptName}！請記得配置點檢項目。`
      };
    }
  },

  /**
   * 管理員切換站點啟用/停用狀態 (可一鍵恢復現行營運)
   */
  toggleDepartmentStatus: function(deptId, isActive, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可切換站點狀態' };
    }

    const cleanDept = String(deptId || '').trim().toUpperCase();
    const sheet = Utils.getSheet('Departments');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('Dept_ID');
    const activeCol = headers.indexOf('Is_Active');

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim().toUpperCase() === cleanDept) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: '找不到該站點資料' };
    }

    sheet.getRange(targetRow, activeCol + 1).setValue(Boolean(isActive));

    return {
      success: true,
      deptId: cleanDept,
      isActive: Boolean(isActive),
      message: `站點 [${cleanDept}] 已切換為 ${isActive ? '現行營運' : '停用刪除'}`
    };
  },

  /**
   * 管理員批次更新站點排序順序 (上下移動微調)
   */
  updateDepartmentSort: function(orderedDeptIds, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可更新排序' };
    }

    if (!Array.isArray(orderedDeptIds) || orderedDeptIds.length === 0) {
      return { success: false, error: '缺少排序站點代碼清單' };
    }

    const sheet = Utils.getSheet('Departments');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('Dept_ID');
    const sortCol = headers.indexOf('Sort_Order');

    if (sortCol === -1) {
      return { success: false, error: '試算表中查無 Sort_Order 欄位' };
    }

    orderedDeptIds.forEach((deptId, index) => {
      const cleanDept = String(deptId).trim().toUpperCase();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]).trim().toUpperCase() === cleanDept) {
          sheet.getRange(i + 1, sortCol + 1).setValue((index + 1) * 10);
          break;
        }
      }
    });

    return {
      success: true,
      message: '站點順序已成功更新'
    };
  },

  /**
   * 判斷指定頻率是否應在目標日期執行
   */
  isFrequencyApplicable: function(frequency, dateStr) {
    if (!frequency || frequency === 'DAILY' || frequency === 'CONTINUOUS') {
      return true;
    }

    const d = new Date(dateStr + 'T00:00:00+08:00');
    const dayOfWeek = d.getDay(); // 0(日) ~ 6(六)
    const dayOfMonth = d.getDate();
    const month = d.getMonth() + 1; // 1 ~ 12
    const dayType = Utils.checkDayType(dateStr);

    switch (frequency) {
      case 'HOLIDAY':
        return dayType === 'HOLIDAY' || dayType === 'WEEKEND';
      case 'EVERY_3_DAYS':
        return (dayOfMonth % 3 === 1);
      case 'BIWEEKLY_MON':
        if (dayOfWeek !== 1) return false;
        const weekNum = Math.ceil(dayOfMonth / 7);
        return (weekNum === 1 || weekNum === 3);
      case 'BIMONTHLY':
        return (month % 2 === 0);
      default:
        return true;
    }
  },

  /**
   * 取得特定站點與時段的應點檢項目清單
   */
  getChecklistItems: function(deptId, stage, dateStr) {
    const targetDate = dateStr || Utils.formatDate();
    const cleanDept = String(deptId).trim().toUpperCase();
    const cleanStage = String(stage).trim().toUpperCase();

    const allItems = Utils.sheetToObjects('Check_Items');
    const deptItems = allItems.filter(item => {
      if (!Boolean(item.Is_Active)) return false;
      if (String(item.Dept_ID).trim().toUpperCase() !== cleanDept) return false;
      if (String(item.Stage).trim().toUpperCase() !== cleanStage) return false;

      return this.isFrequencyApplicable(item.Frequency, targetDate);
    });

    deptItems.sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    return deptItems.map(item => ({
      itemId: item.Item_ID,
      deptId: item.Dept_ID,
      stage: item.Stage,
      category: item.Category,
      title: item.Title,
      itemType: item.Item_Type || 'CHECK',
      frequency: item.Frequency,
      sortOrder: item.Sort_Order
    }));
  },

  /**
   * 查詢當日特定站點的點檢完成與送出狀態
   */
  getDepartmentStatus: function(deptId, dateStr) {
    const targetDate = dateStr || Utils.formatDate();
    const cleanDept = String(deptId).trim().toUpperCase();

    const logs = Utils.sheetToObjects('Audit_Logs').filter(l => {
      let bDate = l.Biz_Date;
      if (bDate instanceof Date) bDate = Utils.formatDate(bDate);
      const isTestLog = Boolean(l.Is_Test) || String(l.Client_Key || '').toUpperCase().startsWith('TEST-');
      return String(bDate).trim() === targetDate &&
             String(l.Dept_ID).trim().toUpperCase() === cleanDept &&
             Boolean(l.Is_Current) &&
             !isTestLog; // 排除測試沙盒紀錄
    });

    const openLog = logs.find(l => l.Stage === 'OPEN');
    const closeLog = logs.find(l => l.Stage === 'CLOSE');

    return {
      date: targetDate,
      deptId: cleanDept,
      open: openLog ? {
        isSubmitted: true,
        logId: openLog.Log_ID,
        executorName: openLog.Executor_Name,
        submitTime: Utils.formatTime(openLog.Submit_Time),
        isLate: Boolean(openLog.Is_Late),
        totalCount: openLog.Total_Count,
        okCount: openLog.OK_Count,
        ngCount: openLog.NG_Count,
        naCount: openLog.NA_Count
      } : { isSubmitted: false },
      close: closeLog ? {
        isSubmitted: true,
        logId: closeLog.Log_ID,
        executorName: closeLog.Executor_Name,
        submitTime: Utils.formatTime(closeLog.Submit_Time),
        isLate: Boolean(closeLog.Is_Late),
        totalCount: closeLog.Total_Count,
        okCount: closeLog.OK_Count,
        ngCount: closeLog.NG_Count,
        naCount: closeLog.NA_Count
      } : { isSubmitted: false }
    };
  },

  /**
   * 取得即時巡檢戰情矩陣資料 (如同原始 Excel 矩陣看板，包含各日期打勾、執行人與時間)
   * @param {string} deptId - 站點代碼
   * @param {string} stage - 時段 (OPEN / CLOSE)
   * @param {string} startDate - 起始日期 (YYYY-MM-DD)
   * @param {string} endDate - 結束日期 (YYYY-MM-DD)
   */
  getInspectionMatrix: function(deptId, stage, startDate, endDate) {
    const cleanDept = String(deptId || '1F').trim().toUpperCase();
    const cleanStage = String(stage || 'OPEN').trim().toUpperCase();

    // 預設日期區間：若未指定，則預設取近 15 天至今日
    let endD = endDate ? new Date(endDate + 'T00:00:00+08:00') : new Date();
    let startD = startDate ? new Date(startDate + 'T00:00:00+08:00') : new Date(endD.getTime() - 14 * 24 * 60 * 60 * 1000);

    const dates = [];
    const curr = new Date(startD);
    while (curr <= endD) {
      dates.push(Utils.formatDate(curr));
      curr.setDate(curr.getDate() + 1);
    }

    // 1. 取得該站點與時段之所有點檢範本項目
    const departments = Utils.sheetToObjects('Departments');
    const deptInfo = departments.find(d => String(d.Dept_ID).trim().toUpperCase() === cleanDept);

    const allItems = Utils.sheetToObjects('Check_Items')
      .filter(i => Boolean(i.Is_Active) &&
                   String(i.Dept_ID).trim().toUpperCase() === cleanDept &&
                   String(i.Stage).trim().toUpperCase() === cleanStage)
      .sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    // 2. 取得日期範圍內的 Audit_Logs 與對應的 Audit_Details
    const allLogs = Utils.sheetToObjects('Audit_Logs').filter(l => {
      let bDate = l.Biz_Date;
      if (bDate instanceof Date) bDate = Utils.formatDate(bDate);
      const isTestLog = Boolean(l.Is_Test) || String(l.Client_Key || '').toUpperCase().startsWith('TEST-');
      return String(l.Dept_ID).trim().toUpperCase() === cleanDept &&
             String(l.Stage).trim().toUpperCase() === cleanStage &&
             Boolean(l.Is_Current) &&
             !isTestLog && // 排除測試沙盒紀錄
             dates.includes(String(bDate).trim());
    });

    const logIds = allLogs.map(l => String(l.Log_ID).trim());
    const allDetails = Utils.sheetToObjects('Audit_Details').filter(d => {
      return logIds.includes(String(d.Log_ID).trim());
    });

    // 整理日誌快速對照表：logMap[date] = { logId, executorName, executorId, submitTime, isLate }
    const logMap = {};
    allLogs.forEach(l => {
      let bDate = l.Biz_Date;
      if (bDate instanceof Date) bDate = Utils.formatDate(bDate);
      logMap[String(bDate).trim()] = {
        logId: l.Log_ID,
        executorName: l.Executor_Name,
        executorId: l.Executor_ID,
        submitTime: Utils.formatTime(l.Submit_Time),
        isLate: Boolean(l.Is_Late)
      };
    });

    // 整理明細對照表：detailMap[`${logId}_${itemId}`] = { status, remark }
    const detailMap = {};
    allDetails.forEach(d => {
      const key = `${String(d.Log_ID).trim()}_${String(d.Item_ID).trim()}`;
      detailMap[key] = {
        status: d.Status,
        remark: d.Remark || ''
      };
    });

    // 3. 組裝項目矩陣
    const matrixItems = allItems.map(item => {
      const recordsByDate = {};
      dates.forEach(dateStr => {
        const log = logMap[dateStr];
        if (!log) {
          recordsByDate[dateStr] = {
            executed: false,
            status: 'NONE',
            executor: '',
            submitTime: '',
            remark: ''
          };
        } else {
          const detail = detailMap[`${log.logId}_${item.Item_ID}`];
          if (!detail) {
            // 當天有送出日誌，但此特定項目並無稽核明細（例如頻率不適用或當時未列入），真實標記為未涵蓋
            recordsByDate[dateStr] = {
              executed: false,
              status: 'NA',
              executor: `${log.executorName} (${log.executorId})`,
              executorName: log.executorName,
              submitTime: log.submitTime,
              isLate: log.isLate,
              remark: ''
            };
          } else {
            recordsByDate[dateStr] = {
              executed: true,
              status: detail.status || 'OK',
              executor: `${log.executorName} (${log.executorId})`,
              executorName: log.executorName,
              submitTime: log.submitTime,
              isLate: log.isLate,
              remark: detail.remark || ''
            };
          }
        }
      });

      return {
        itemId: item.Item_ID,
        category: item.Category,
        title: item.Title,
        frequency: item.Frequency,
        records: recordsByDate
      };
    });

    // 讀取 Calendar 中的假日與連假資訊
    const calendarRows = Utils.sheetToObjects('Calendar');
    const holidayMap = {};
    calendarRows.forEach(c => {
      let cDate = c.Date;
      if (cDate instanceof Date) cDate = Utils.formatDate(cDate);
      if (c.Day_Type === 'HOLIDAY' && c.Note) {
        holidayMap[String(cDate).trim()] = String(c.Note).trim();
      }
    });

    return {
      success: true,
      deptId: cleanDept,
      deptName: deptInfo ? deptInfo.Dept_Name : cleanDept,
      stage: cleanStage,
      dates: dates,
      daySummaries: logMap,
      holidays: holidayMap,
      items: matrixItems
    };
  },

  /**
   * 管理員取得特定站點與時段之所有點檢項目 (含啟用與停用中)
   */
  adminGetChecklistItems: function(deptId, stage, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可維護點檢項目' };
    }
    const cleanDept = String(deptId || '1F').trim().toUpperCase();
    const cleanStage = String(stage || 'OPEN').trim().toUpperCase();

    const allItems = Utils.sheetToObjects('Check_Items');
    const items = allItems.filter(item => {
      const matchDept = String(item.Dept_ID).trim().toUpperCase() === cleanDept;
      const matchStage = String(item.Stage).trim().toUpperCase() === cleanStage;
      return matchDept && matchStage;
    });

    items.sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    return {
      success: true,
      deptId: cleanDept,
      stage: cleanStage,
      count: items.length,
      items: items.map(item => ({
        itemId: item.Item_ID,
        deptId: item.Dept_ID,
        stage: item.Stage,
        category: item.Category || '一般項目',
        title: item.Title || '',
        itemType: item.Item_Type || 'CHECK',
        frequency: item.Frequency || 'DAILY',
        sortOrder: parseInt(item.Sort_Order, 10) || 10,
        isActive: Boolean(item.Is_Active === true || String(item.Is_Active).toUpperCase() === 'TRUE')
      }))
    };
  },

  /**
   * 管理員儲存點檢項目 (新增或更新)
   */
  adminSaveChecklistItem: function(payload, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可儲存點檢項目' };
    }
    if (!payload || !payload.deptId || !payload.title) {
      return { success: false, error: '缺少站點或題目名稱' };
    }

    const sheet = Utils.getSheet('Check_Items');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('Item_ID');
    const deptCol = headers.indexOf('Dept_ID');
    const stageCol = headers.indexOf('Stage');
    const catCol = headers.indexOf('Category');
    const titleCol = headers.indexOf('Title');
    const typeCol = headers.indexOf('Item_Type');
    const freqCol = headers.indexOf('Frequency');
    const sortCol = headers.indexOf('Sort_Order');
    const activeCol = headers.indexOf('Is_Active');

    const cleanDept = String(payload.deptId).trim().toUpperCase();
    const cleanStage = String(payload.stage || 'OPEN').trim().toUpperCase();
    const cleanCategory = String(payload.category || '一般項目').trim();
    const cleanTitle = String(payload.title).trim();
    const cleanFreq = String(payload.frequency || 'DAILY').trim().toUpperCase();
    const sortOrder = parseInt(payload.sortOrder, 10) || 10;
    const isActive = payload.isActive !== false;

    // 若有 itemId 則為更新，否則新增
    if (payload.itemId) {
      const cleanItemId = String(payload.itemId).trim();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]).trim() === cleanItemId) {
          if (deptCol !== -1) sheet.getRange(i + 1, deptCol + 1).setValue(cleanDept);
          if (stageCol !== -1) sheet.getRange(i + 1, stageCol + 1).setValue(cleanStage);
          if (catCol !== -1) sheet.getRange(i + 1, catCol + 1).setValue(cleanCategory);
          if (titleCol !== -1) sheet.getRange(i + 1, titleCol + 1).setValue(cleanTitle);
          if (typeCol !== -1) sheet.getRange(i + 1, typeCol + 1).setValue(payload.itemType || 'CHECK');
          if (freqCol !== -1) sheet.getRange(i + 1, freqCol + 1).setValue(cleanFreq);
          if (sortCol !== -1) sheet.getRange(i + 1, sortCol + 1).setValue(sortOrder);
          if (activeCol !== -1) sheet.getRange(i + 1, activeCol + 1).setValue(isActive);

          return { success: true, message: `點檢項目 [${cleanTitle}] 已更新成功` };
        }
      }
    }

    // 新增項目
    const newItemId = `ITM-${Date.now().toString().slice(-6)}`;
    const newRow = new Array(headers.length).fill('');
    if (idCol !== -1) newRow[idCol] = newItemId;
    if (deptCol !== -1) newRow[deptCol] = cleanDept;
    if (stageCol !== -1) newRow[stageCol] = cleanStage;
    if (catCol !== -1) newRow[catCol] = cleanCategory;
    if (titleCol !== -1) newRow[titleCol] = cleanTitle;
    if (typeCol !== -1) newRow[typeCol] = payload.itemType || 'CHECK';
    if (freqCol !== -1) newRow[freqCol] = cleanFreq;
    if (sortCol !== -1) newRow[sortCol] = sortOrder;
    if (activeCol !== -1) newRow[activeCol] = isActive;

    sheet.appendRow(newRow);
    return { success: true, message: `已成功新增點檢項目 [${cleanTitle}]`, itemId: newItemId };
  },

  /**
   * 管理員切換點檢項目啟用/停用
   */
  adminToggleItemStatus: function(itemId, isActive, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可修改項目狀態' };
    }
    const cleanItemId = String(itemId).trim();
    const sheet = Utils.getSheet('Check_Items');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idCol = headers.indexOf('Item_ID');
    const activeCol = headers.indexOf('Is_Active');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === cleanItemId) {
        sheet.getRange(i + 1, activeCol + 1).setValue(Boolean(isActive));
        return { success: true, message: `項目狀態已切換為 ${isActive ? '啟用' : '停用'}` };
      }
    }
    return { success: false, error: '找不到該點檢項目' };
  },

  /**
   * 管理員刪除點檢項目
   */
  adminDeleteItem: function(itemId, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可刪除項目' };
    }
    const cleanItemId = String(itemId).trim();
    const sheet = Utils.getSheet('Check_Items');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idCol = headers.indexOf('Item_ID');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === cleanItemId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: '點檢項目已成功刪除' };
      }
    }
    return { success: false, error: '找不到該點檢項目' };
  },

  /**
   * 管理員更新項目排序
   */
  adminUpdateItemSort: function(orderedItemIds, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可調整排序' };
    }
    if (!Array.isArray(orderedItemIds) || orderedItemIds.length === 0) {
      return { success: false, error: '缺少排序清單' };
    }
    const sheet = Utils.getSheet('Check_Items');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idCol = headers.indexOf('Item_ID');
    const sortCol = headers.indexOf('Sort_Order');

    orderedItemIds.forEach((itemId, idx) => {
      const cleanId = String(itemId).trim();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]).trim() === cleanId) {
          sheet.getRange(i + 1, sortCol + 1).setValue((idx + 1) * 10);
          break;
        }
      }
    });

    return { success: true, message: '項目順序更新成功' };
  },

  /**
   * 管理維護：清除指定誤送或測試日誌 (支援 Audit_Logs、Audit_Details、Handover_Notes 三表連動物理銷毀)
   */
  removeAuditLog: function(logId, currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可操作' };
    }
    const cleanLogId = String(logId).trim();
    if (!cleanLogId) {
      return { success: false, error: '缺少 logId 參數' };
    }

    // 1. 物理刪除 Audit_Logs
    const logsSheet = Utils.getSheet('Audit_Logs');
    const logsData = logsSheet.getDataRange().getValues();
    const logsHeaders = logsData[0].map(h => String(h).trim());
    const logIdCol = logsHeaders.indexOf('Log_ID');

    let deletedLog = false;
    for (let i = logsData.length - 1; i >= 1; i--) {
      if (String(logsData[i][logIdCol]).trim() === cleanLogId) {
        logsSheet.deleteRow(i + 1);
        deletedLog = true;
      }
    }

    // 2. 物理連動刪除 Audit_Details 快照
    const detailsSheet = Utils.getSheet('Audit_Details');
    const detailsData = detailsSheet.getDataRange().getValues();
    const detailsHeaders = detailsData[0].map(h => String(h).trim());
    const detailLogIdCol = detailsHeaders.indexOf('Log_ID');
    let deletedDetailsCount = 0;
    if (detailLogIdCol !== -1) {
      for (let i = detailsData.length - 1; i >= 1; i--) {
        if (String(detailsData[i][detailLogIdCol]).trim() === cleanLogId) {
          detailsSheet.deleteRow(i + 1);
          deletedDetailsCount++;
        }
      }
    }

    // 3. 物理連動刪除 Handover_Notes (若有建立)
    const handoverSheet = Utils.getSheet('Handover_Notes');
    const handoverData = handoverSheet.getDataRange().getValues();
    const handoverHeaders = handoverData[0].map(h => String(h).trim());
    const sourceLogCol = handoverHeaders.indexOf('Source_Log_ID');
    let deletedHandoverCount = 0;
    if (sourceLogCol !== -1) {
      for (let i = handoverData.length - 1; i >= 1; i--) {
        if (String(handoverData[i][sourceLogCol]).trim() === cleanLogId) {
          handoverSheet.deleteRow(i + 1);
          deletedHandoverCount++;
        }
      }
    }

    return {
      success: deletedLog,
      message: deletedLog
        ? `已成功銷毀日誌 [${cleanLogId}]，連帶清除 ${deletedDetailsCount} 筆明細與 ${deletedHandoverCount} 筆交接事項`
        : '查無該日誌',
      deletedDetailsCount: deletedDetailsCount,
      deletedHandoverCount: deletedHandoverCount
    };
  },

  /**
   * 管理維護：全面置換 8F 點檢題目清冊 (OPEN: 20項, CLOSE: 25項含營運中服務處)
   */
  setup8FChecklistItems: function(currentUser) {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: '權限不足，僅系統管理員可配置 8F 點檢項目' };
    }

    const sheet = Utils.getSheet('Check_Items');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    const idCol = headers.indexOf('Item_ID');
    const deptCol = headers.indexOf('Dept_ID');
    const stageCol = headers.indexOf('Stage');
    const catCol = headers.indexOf('Category');
    const titleCol = headers.indexOf('Title');
    const typeCol = headers.indexOf('Item_Type');
    const freqCol = headers.indexOf('Frequency');
    const sortCol = headers.indexOf('Sort_Order');
    const activeCol = headers.indexOf('Is_Active');

    if (idCol === -1 || deptCol === -1 || stageCol === -1 || catCol === -1 || titleCol === -1) {
      return { success: false, error: 'Check_Items 缺少必要標題欄位' };
    }

    // 1. 清理舊有 8F 項目 (自下而上物理刪除)
    let removedCount = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][deptCol]).trim().toUpperCase() === '8F') {
        sheet.deleteRow(i + 1);
        removedCount++;
      }
    }

    // 2. 定義新版 8F 點檢項目清單
    const newItems = [
      // === 8F OPEN (營業前準備) 20 項 ===
      // 場域維護 (4項)
      { stage: 'OPEN', cat: '場域維護', title: '黑龍(DIY、貨梯前)' },
      { stage: 'OPEN', cat: '場域維護', title: '電視、燈箱' },
      { stage: 'OPEN', cat: '場域維護', title: '冷氣' },
      { stage: 'OPEN', cat: '場域維護', title: '環境整潔' },
      // 文化館 (12項)
      { stage: 'OPEN', cat: '文化館', title: '投影機' },
      { stage: 'OPEN', cat: '文化館', title: '電腦主機' },
      { stage: 'OPEN', cat: '文化館', title: '音響設備' },
      { stage: 'OPEN', cat: '文化館', title: '燈光設備' },
      { stage: 'OPEN', cat: '文化館', title: '體驗設備-海洋沉靜互動區' },
      { stage: 'OPEN', cat: '文化館', title: '體驗設備-健身房' },
      { stage: 'OPEN', cat: '文化館', title: '體驗設備-祖靈的祝福' },
      { stage: 'OPEN', cat: '文化館', title: '沙灘燈光' },
      { stage: 'OPEN', cat: '文化館', title: '香氛' },
      { stage: 'OPEN', cat: '文化館', title: '椰樹擺飾' },
      { stage: 'OPEN', cat: '文化館', title: '地毯清潔度' },
      { stage: 'OPEN', cat: '文化館', title: '展示物(要拍照)' },
      // DIY、文化館 POS機 (4項)
      { stage: 'OPEN', cat: 'DIY、文化館 POS機', title: '開機確認結帳日期正確' },
      { stage: 'OPEN', cat: 'DIY、文化館 POS機', title: '發票信用卡紙捲備品檢查' },
      { stage: 'OPEN', cat: 'DIY、文化館 POS機', title: '零用金複點舖錢(每袋6200元)' },
      { stage: 'OPEN', cat: 'DIY、文化館 POS機', title: 'POS正反螢幕正確顯示' },

      // === 8F CLOSE (營業後整理) 25 項 ===
      // DIY、文化館 POS機 (5項)
      { stage: 'CLOSE', cat: 'DIY、文化館 POS機', title: '信用卡簽單清點' },
      { stage: 'CLOSE', cat: 'DIY、文化館 POS機', title: '營收清點' },
      { stage: 'CLOSE', cat: 'DIY、文化館 POS機', title: '零用金清點' },
      { stage: 'CLOSE', cat: 'DIY、文化館 POS機', title: 'POS清機' },
      { stage: 'CLOSE', cat: 'DIY、文化館 POS機', title: '信用卡清機' },
      // 文化館 (9項)
      { stage: 'CLOSE', cat: '文化館', title: '投影機' },
      { stage: 'CLOSE', cat: '文化館', title: '電腦主機' },
      { stage: 'CLOSE', cat: '文化館', title: '音響設備' },
      { stage: 'CLOSE', cat: '文化館', title: '燈光設備' },
      { stage: 'CLOSE', cat: '文化館', title: '沙灘燈光' },
      { stage: 'CLOSE', cat: '文化館', title: '香氛' },
      { stage: 'CLOSE', cat: '文化館', title: '椰樹擺飾' },
      { stage: 'CLOSE', cat: '文化館', title: '地毯清潔度' },
      { stage: 'CLOSE', cat: '文化館', title: '展示物(要拍照)' },
      // 店務回報 (3項)
      { stage: 'CLOSE', cat: '店務回報', title: '業績回報' },
      { stage: 'CLOSE', cat: '店務回報', title: '任務交接' },
      { stage: 'CLOSE', cat: '店務回報', title: '入金+換鈔' },
      // 場域維護 (4項)
      { stage: 'CLOSE', cat: '場域維護', title: '黑龍(DIY、貨梯前)' },
      { stage: 'CLOSE', cat: '場域維護', title: '電視、燈箱' },
      { stage: 'CLOSE', cat: '場域維護', title: '冷氣' },
      { stage: 'CLOSE', cat: '場域維護', title: '環境整潔' },
      // 服務處 (4項，營運中常態歸入 CLOSE)
      { stage: 'CLOSE', cat: '服務處', title: '親切招呼' },
      { stage: 'CLOSE', cat: '服務處', title: '驗票' },
      { stage: 'CLOSE', cat: '服務處', title: '場域動線指引' },
      { stage: 'CLOSE', cat: '服務處', title: '客訴問題處理' }
    ];

    let openOrder = 0;
    let closeOrder = 0;
    let openCount = 0;
    let closeCount = 0;

    const rowsToAppend = [];
    newItems.forEach(item => {
      const isO = item.stage === 'OPEN';
      const seq = isO ? ++openCount : ++closeCount;
      const itemId = `ITM-8F-${isO ? 'O' : 'C'}${String(seq).padStart(2, '0')}`;
      const sortOrder = isO ? (openOrder += 10) : (closeOrder += 10);

      const row = new Array(headers.length).fill('');
      if (idCol !== -1) row[idCol] = itemId;
      if (deptCol !== -1) row[deptCol] = '8F';
      if (stageCol !== -1) row[stageCol] = item.stage;
      if (catCol !== -1) row[catCol] = item.cat;
      if (titleCol !== -1) row[titleCol] = item.title;
      if (typeCol !== -1) row[typeCol] = 'CHECK';
      if (freqCol !== -1) row[freqCol] = 'DAILY';
      if (sortCol !== -1) row[sortCol] = sortOrder;
      if (activeCol !== -1) row[activeCol] = true;

      rowsToAppend.push(row);
    });

    if (rowsToAppend.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    return {
      success: true,
      message: `8F 點檢項目已成功全面重設！舊項目移除 ${removedCount} 筆，全新匯入 ${rowsToAppend.length} 筆（開店 OPEN: ${openCount} 項，閉店 CLOSE: ${closeCount} 項）`,
      openCount: openCount,
      closeCount: closeCount,
      totalCount: rowsToAppend.length
    };
  }
};
