/**
 * Babbuza Checklist - 異常追蹤與交接備忘模組 (Handover.js)
 */

const Handover = {
  /**
   * 取得指定站點的交接備忘與異常事項
   * @param {string} deptId - 站點代碼
   */
  getNotes: function(deptId) {
    const cleanDept = String(deptId).trim().toUpperCase();
    const allNotes = Utils.sheetToObjects('Handover_Notes');

    const filtered = allNotes.filter(n => {
      return String(n.Dept_ID).trim().toUpperCase() === cleanDept;
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
   * 結案/處理異常與交接項目
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

    // Headers: Note_ID(1), Biz_Date(2), Dept_ID(3), Type(4), Source_Log_ID(5), Source_Item_ID(6),
    //          Content(7), Reporter_ID(8), Assignee_ID(9), Status(10), Resolution(11), Resolved_By(12), Resolved_At(13), Created_At(14)
    sheet.getRange(rowIndex, 10).setValue('RESOLVED');
    sheet.getRange(rowIndex, 11).setValue(String(resolution || '已確認處理完成').trim());
    sheet.getRange(rowIndex, 12).setValue(currentUser.name || currentUser.userId);
    sheet.getRange(rowIndex, 13).setValue(nowTime);

    return {
      success: true,
      noteId: noteId,
      status: 'RESOLVED',
      resolvedAt: nowTime
    };
  }
};
