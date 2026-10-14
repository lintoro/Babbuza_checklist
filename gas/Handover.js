/**
 * Babbuza Checklist - 異常追蹤與交接備忘模組 (Handover.js)
 */

const Handover = {
  /**
   * 取得指定站點的交接備忘與異常事項
   * @param {string} deptId - 站點代碼
   * @param {boolean} onlyOpen - 是否僅回傳未結案 (OPEN) 項目
   */
  getNotes: function(deptId, onlyOpen) {
    const cleanDept = String(deptId).trim().toUpperCase();
    const allNotes = Utils.sheetToObjects('Handover_Notes');

    const filtered = allNotes.filter(n => {
      const matchDept = String(n.Dept_ID).trim().toUpperCase() === cleanDept;
      if (!matchDept) return false;
      if (onlyOpen) {
        return String(n.Status).trim().toUpperCase() === 'OPEN';
      }
      return true;
    });

    // 依建立時間倒序
    filtered.sort((a, b) => {
      const ta = new Date(a.Created_At).getTime() || 0;
      const tb = new Date(b.Created_At).getTime() || 0;
      return tb - ta;
    });

    return filtered.map(n => ({
      noteId: n.Note_ID,
      bizDate: n.Biz_Date instanceof Date ? Utils.formatDate(n.Biz_Date) : n.Biz_Date,
      deptId: n.Dept_ID,
      type: n.Type, // DEFECT 或 HANDOVER
      sourceLogId: n.Source_Log_ID,
      content: n.Content,
      reporterId: n.Reporter_ID,
      status: n.Status, // OPEN 或 RESOLVED
      resolution: n.Resolution,
      resolvedBy: n.Resolved_By,
      resolvedAt: n.Resolved_At instanceof Date ? Utils.formatDateTime(n.Resolved_At) : n.Resolved_At,
      createdAt: n.Created_At instanceof Date ? Utils.formatDateTime(n.Created_At) : n.Created_At
    }));
  },

  /**
   * 手動新增一筆交接備忘
   */
  createNote: function(payload, currentUser) {
    if (!payload || !payload.deptId || !payload.content) {
      return { success: false, error: '缺少站點或備忘內容' };
    }

    const deptId = String(payload.deptId).trim().toUpperCase();
    const bizDate = payload.bizDate || Utils.formatDate();
    const submitTime = Utils.formatDateTime();
    const noteId = `NOTE-${bizDate.replace(/-/g, '')}-${deptId}-${Date.now().toString().slice(-4)}`;

    const sheet = Utils.getSheet('Handover_Notes');
    const row = [
      noteId,
      bizDate,
      deptId,
      payload.type || 'HANDOVER',
      '', // Source_Log_ID
      '', // Source_Item_ID
      String(payload.content).trim(),
      currentUser.userId,
      '', // Assignee_ID
      'OPEN',
      '', // Resolution
      '', // Resolved_By
      '', // Resolved_At
      submitTime
    ];

    sheet.appendRow(row);

    return {
      success: true,
      noteId: noteId,
      createdAt: submitTime
    };
  },

  /**
   * 結案/核銷異常與交接項目 (全員皆可核銷確認，記錄工號與時間)
   */
  resolveNote: function(noteId, resolution, currentUser) {
    if (!noteId) {
      return { success: false, error: '缺少 Note_ID' };
    }

    const sheet = Utils.getSheet('Handover_Notes');
    const allNotes = Utils.sheetToObjects('Handover_Notes');
    const note = allNotes.find(n => String(n.Note_ID).trim() === String(noteId).trim());

    if (!note) {
      return { success: false, error: '找不到該筆交接備忘' };
    }

    const rowIndex = note._rowIndex;
    const nowTime = Utils.formatDateTime();

    // 格式化結案人：姓名 (工號)
    const resolverInfo = currentUser?.name
      ? `${currentUser.name} (${currentUser.userId})`
      : (currentUser?.userId || '現場同仁');

    // Headers: Note_ID(1), Biz_Date(2), Dept_ID(3), Type(4), Source_Log_ID(5), Source_Item_ID(6),
    //          Content(7), Reporter_ID(8), Assignee_ID(9), Status(10), Resolution(11), Resolved_By(12), Resolved_At(13), Created_At(14)
    sheet.getRange(rowIndex, 10).setValue('RESOLVED');
    sheet.getRange(rowIndex, 11).setValue(String(resolution || '已確認處理完成').trim());
    sheet.getRange(rowIndex, 12).setValue(resolverInfo);
    sheet.getRange(rowIndex, 13).setValue(nowTime);

    return {
      success: true,
      noteId: noteId,
      status: 'RESOLVED',
      resolvedBy: resolverInfo,
      resolvedAt: nowTime
    };
  },

  /**
   * 自動核銷逾期交接備忘 (超過指定天數，預設 3 天未結案之交接項目自動結案)
   * @param {number} days - 逾期天數，預設 3
   */
  autoArchiveExpiredHandovers: function(days) {
    try {
      const expireDays = typeof days === 'number' ? days : 3;
      const sheet = Utils.getSheet('Handover_Notes');
      const allNotes = Utils.sheetToObjects('Handover_Notes');
      const now = Date.now();
      const expireMs = expireDays * 24 * 60 * 60 * 1000;
      const nowTime = Utils.formatDateTime();
      let archivedCount = 0;

      allNotes.forEach(note => {
        const isHandover = String(note.Type).trim().toUpperCase() === 'HANDOVER';
        const isOpen = String(note.Status).trim().toUpperCase() === 'OPEN';
        if (!isHandover || !isOpen) return;

        const createTime = new Date(note.Created_At).getTime();
        if (!createTime || isNaN(createTime)) return;

        if (now - createTime >= expireMs) {
          const rowIndex = note._rowIndex;
          sheet.getRange(rowIndex, 10).setValue('RESOLVED');
          sheet.getRange(rowIndex, 11).setValue('系統自動核銷（交接逾3日無異常）');
          sheet.getRange(rowIndex, 12).setValue('系統自動核銷');
          sheet.getRange(rowIndex, 13).setValue(nowTime);
          archivedCount++;
        }
      });
      return archivedCount;
    } catch (e) {
      console.warn('autoArchiveExpiredHandovers error:', e);
      return 0;
    }
  },

  /**
   * 取得全商場所有未結案異常與備忘 (供戰情報表集中看板使用，直到被解決才移除)
   */
  getAllOpenIssues: function() {
    // 查詢前先自動歸檔超過 3 日未核銷之交接備忘
    this.autoArchiveExpiredHandovers(3);

    const allNotes = Utils.sheetToObjects('Handover_Notes');
    const allDepts = Utils.sheetToObjects('Departments');
    const allUsers = Utils.sheetToObjects('Users');

    const deptMap = {};
    allDepts.forEach(d => {
      deptMap[d.Dept_ID] = d.Dept_Name;
    });

    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.User_ID] = u.Name;
    });

    const now = new Date().getTime();
    const openNotes = allNotes
      .filter(n => String(n.Status).trim().toUpperCase() === 'OPEN')
      .map(n => {
        const createTime = new Date(n.Created_At).getTime() || now;
        const diffDays = Math.floor((now - createTime) / (1000 * 60 * 60 * 24));

        return {
          noteId: n.Note_ID,
          bizDate: n.Biz_Date instanceof Date ? Utils.formatDate(n.Biz_Date) : n.Biz_Date,
          deptId: n.Dept_ID,
          deptName: deptMap[n.Dept_ID] || n.Dept_ID,
          type: n.Type, // DEFECT 或 HANDOVER
          content: n.Content,
          reporterId: n.Reporter_ID,
          reporterName: userMap[n.Reporter_ID] || n.Reporter_ID,
          status: 'OPEN',
          pendingDays: Math.max(0, diffDays),
          createdAt: n.Created_At instanceof Date ? Utils.formatDateTime(n.Created_At) : n.Created_At
        };
      });

    // 依建立時間倒序
    openNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      data: {
        totalOpen: openNotes.length,
        defectCount: openNotes.filter(n => n.type === 'DEFECT').length,
        handoverCount: openNotes.filter(n => n.type === 'HANDOVER').length,
        issues: openNotes
      }
    };
  },

  /**
   * 取得已結案歷史紀錄清單 (任何人都可以點開查看誰在何時核銷了什麼)
   */
  getResolvedHistory: function(limit) {
    const maxItems = parseInt(limit, 10) || 50;
    const allNotes = Utils.sheetToObjects('Handover_Notes');
    const allDepts = Utils.sheetToObjects('Departments');
    const allUsers = Utils.sheetToObjects('Users');

    const deptMap = {};
    allDepts.forEach(d => {
      deptMap[d.Dept_ID] = d.Dept_Name;
    });

    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.User_ID] = u.Name;
    });

    const resolvedNotes = allNotes
      .filter(n => String(n.Status).trim().toUpperCase() === 'RESOLVED')
      .map(n => ({
        noteId: n.Note_ID,
        bizDate: n.Biz_Date instanceof Date ? Utils.formatDate(n.Biz_Date) : n.Biz_Date,
        deptId: n.Dept_ID,
        deptName: deptMap[n.Dept_ID] || n.Dept_ID,
        type: n.Type,
        content: n.Content,
        reporterId: n.Reporter_ID,
        reporterName: userMap[n.Reporter_ID] || n.Reporter_ID,
        status: 'RESOLVED',
        resolution: n.Resolution || '已確認處理完成',
        resolvedBy: n.Resolved_By || '現場人員',
        resolvedAt: n.Resolved_At instanceof Date ? Utils.formatDateTime(n.Resolved_At) : n.Resolved_At,
        createdAt: n.Created_At instanceof Date ? Utils.formatDateTime(n.Created_At) : n.Created_At
      }));

    // 依結案時間倒序
    resolvedNotes.sort((a, b) => new Date(b.resolvedAt || 0).getTime() - new Date(a.resolvedAt || 0).getTime());

    return {
      success: true,
      data: {
        totalResolved: resolvedNotes.length,
        records: resolvedNotes.slice(0, maxItems)
      }
    };
  }
};
