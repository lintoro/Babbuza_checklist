/**
 * Babbuza Checklist - 點檢項目與站點模組 (Checklist.js)
 */

const Checklist = {
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
      return allDepts.map(d => ({
        deptId: d.Dept_ID,
        deptName: d.Dept_Name,
        deptType: d.Dept_Type,
        openDeadline: Utils.formatTime(d.Open_Deadline),
        closeDeadline: Utils.formatTime(d.Close_Deadline),
        isPrimary: d.Dept_ID === '1F'
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
        openDeadline: Utils.formatTime(d.Open_Deadline),
        closeDeadline: Utils.formatTime(d.Close_Deadline),
        isPrimary: d.Dept_ID === primaryDeptId
      }));
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
        // 假日或週末
        return dayType === 'HOLIDAY' || dayType === 'WEEKEND';

      case 'EVERY_3_DAYS':
        // 每3天執行一次 (以日期 mod 3 === 1 觸發，例 1, 4, 7, 10, 13, 16, 19, 22, 25, 28)
        return (dayOfMonth % 3 === 1);

      case 'BIWEEKLY_MON':
        // 雙週一 (星期一且為當月第1或第3週)
        if (dayOfWeek !== 1) return false;
        const weekNum = Math.ceil(dayOfMonth / 7);
        return (weekNum === 1 || weekNum === 3);

      case 'BIMONTHLY':
        // 雙月份 (2, 4, 6, 8, 10, 12 月的月初 1~3 號執行)
        return (month % 2 === 0);

      default:
        return true;
    }
  },

  /**
   * 取得特定站點與時段的應點檢項目清單
   * @param {string} deptId - 站點代碼 (例: 1F, MSS1)
   * @param {string} stage - 時段 (OPEN / CLOSE)
   * @param {string} dateStr - 營業日期 (YYYY-MM-DD)，若無則預設今天
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

      // 頻率過濾
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
   * @param {string} deptId - 站點代碼
   * @param {string} dateStr - 營業日期 (YYYY-MM-DD)
   */
  getDepartmentStatus: function(deptId, dateStr) {
    const targetDate = dateStr || Utils.formatDate();
    const cleanDept = String(deptId).trim().toUpperCase();

    const logs = Utils.sheetToObjects('Audit_Logs').filter(l => {
      let bDate = l.Biz_Date;
      if (bDate instanceof Date) bDate = Utils.formatDate(bDate);
      return String(bDate).trim() === targetDate &&
             String(l.Dept_ID).trim().toUpperCase() === cleanDept &&
             Boolean(l.Is_Current);
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
        submitTime: openLog.Submit_Time,
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
        submitTime: closeLog.Submit_Time,
        isLate: Boolean(closeLog.Is_Late),
        totalCount: closeLog.Total_Count,
        okCount: closeLog.OK_Count,
        ngCount: closeLog.NG_Count,
        naCount: closeLog.NA_Count
      } : { isSubmitted: false }
    };
  }
};
