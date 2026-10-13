/**
 * Babbuza Checklist - 送出檢核與稽核歷史模組 (Audit.js)
 */

const Audit = {
  /**
   * 送出點檢結果
   * @param {Object} payload
   * {
   *   deptId: '1F',
   *   stage: 'OPEN',
   *   bizDate: '2026-10-12',
   *   clientKey: 'uuid...',
   *   items: [
   *     { itemId: 'ITM-0001', category: 'POS', title: '開機確認...', status: 'OK', value: '', remark: '' }
   *   ],
   *   handoverNote: '今日備忘事項...'
   * }
   * @param {Object} currentUser - 登入者資訊 { userId, name, role }
   */
  submit: function(payload, currentUser) {
    if (!payload || !payload.deptId || !payload.stage || !payload.items) {
      return { success: false, error: '送出資料不齊全' };
    }

    const deptId = String(payload.deptId).trim().toUpperCase();
    const stage = String(payload.stage).trim().toUpperCase();
    const bizDate = payload.bizDate || Utils.formatDate();
    const clientKey = String(payload.clientKey || '').trim();
    const submitTime = Utils.formatDateTime();

    // 1. 防重複送出檢查 (以 Client_Key 判定冪等性)
    if (clientKey) {
      const existingLogs = Utils.sheetToObjects('Audit_Logs');
      const duplicated = existingLogs.find(l => String(l.Client_Key).trim() === clientKey);
      if (duplicated) {
        return {
          success: true,
          isDuplicate: true,
          message: '該筆檢核已成功送出過，系統已防止重複寫入',
          logId: duplicated.Log_ID
        };
      }
    }

    // 2. 開始時間與截止時間判定 (後端防護)
    const depts = Utils.sheetToObjects('Departments');
    const dept = depts.find(d => String(d.Dept_ID).trim().toUpperCase() === deptId);
    let startTimeStr = stage === 'OPEN' ? (dept ? dept.Open_Start_Time : '09:30') : (dept ? dept.Close_Start_Time : '16:45');
    let deadlineStr = stage === 'OPEN' ? (dept ? dept.Open_Deadline : '10:30') : (dept ? dept.Close_Deadline : '20:00');
    if (startTimeStr instanceof Date) startTimeStr = Utils.formatTime(startTimeStr);
    if (deadlineStr instanceof Date) deadlineStr = Utils.formatTime(deadlineStr);
    startTimeStr = Utils.formatTime(startTimeStr) || (stage === 'OPEN' ? '09:30' : '16:45');
    deadlineStr = Utils.formatTime(deadlineStr) || (stage === 'OPEN' ? '10:30' : '20:00');

    const currentTimeStr = Utils.formatTime();
    if (currentTimeStr < startTimeStr) {
      return {
        success: false,
        error: `尚未到達開放回報時間！${stage === 'OPEN' ? '開店' : '閉店'}開放時間為 ${startTimeStr} ~ ${deadlineStr}`
      };
    }
    const isLate = currentTimeStr > deadlineStr;

    // 3. 處理先前若已有當天同一時段的舊版本 (支援修正補登 Version 演進)
    const logsSheet = Utils.getSheet('Audit_Logs');
    const logsData = logsSheet.getDataRange().getValues();
    const logsHeaders = logsData[0].map(h => String(h).trim());
    const isCurrentCol = logsHeaders.indexOf('Is_Current');

    const allLogs = Utils.sheetToObjects('Audit_Logs');
    const sameStageLogs = allLogs.filter(l => {
      let d = l.Biz_Date;
      if (d instanceof Date) d = Utils.formatDate(d);
      return String(d).trim() === bizDate &&
             String(l.Dept_ID).trim().toUpperCase() === deptId &&
             String(l.Stage).trim().toUpperCase() === stage;
    });

    let version = 1;
    if (sameStageLogs.length > 0) {
      version = sameStageLogs.length + 1;
      // 將舊紀錄的 Is_Current 改為 false (動態欄位定位)
      sameStageLogs.forEach(oldLog => {
        if (isCurrentCol !== -1) {
          logsSheet.getRange(oldLog._rowIndex, isCurrentCol + 1).setValue(false);
        }
      });
    }

    // 4. 計算統計數據
    let totalCount = payload.items.length;
    let okCount = 0;
    let ngCount = 0;
    let naCount = 0;
    const defectItems = [];

    payload.items.forEach(it => {
      const st = String(it.status || 'OK').toUpperCase();
      if (st === 'OK') okCount++;
      else if (st === 'NG') {
        ngCount++;
        defectItems.push(it);
      } else if (st === 'NA') naCount++;
    });

    // 5. 產生 Log_ID
    const logId = `LOG-${bizDate.replace(/-/g, '')}-${deptId}-${stage}-V${version}`;

    // 6. 寫入 Audit_Logs
    // 欄位: Log_ID, Biz_Date, Dept_ID, Stage, Version, Is_Current, Correction_Reason,
    //       Executor_ID, Executor_Name, Submit_Time, Deadline, Is_Late, Total_Count, OK_Count, NG_Count, NA_Count, Client_Key
    const logRow = [
      logId,
      bizDate,
      deptId,
      stage,
      version,
      true, // Is_Current
      payload.correctionReason || '',
      currentUser.userId,
      currentUser.name,
      submitTime,
      deadlineStr,
      isLate,
      totalCount,
      okCount,
      ngCount,
      naCount,
      clientKey
    ];
    logsSheet.appendRow(logRow);

    // 7. 批次寫入 Audit_Details 快照
    // 欄位: Log_ID, Item_ID, Category_Snapshot, Title_Snapshot, Status, Value, Remark
    const detailsSheet = Utils.getSheet('Audit_Details');
    const detailRows = payload.items.map(it => [
      logId,
      it.itemId || '',
      it.category || '',
      it.title || '',
      (it.status || 'OK').toUpperCase(),
      it.value || '',
      it.remark || ''
    ]);
    if (detailRows.length > 0) {
      const startRow = detailsSheet.getLastRow() + 1;
      detailsSheet.getRange(startRow, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
    }

    // 8. 異常項目 (NG) 自動寫入 Handover_Notes
    const handoverSheet = Utils.getSheet('Handover_Notes');
    const handoverRows = [];
    const noteIdPrefix = `NOTE-${bizDate.replace(/-/g, '')}-${deptId}-${stage}`;
    const uniqueSuffix = Date.now().toString().slice(-4);

    defectItems.forEach((defect, idx) => {
      const noteId = `${noteIdPrefix}-NG${idx + 1}-${uniqueSuffix}`;
      const content = `【點檢異常】${defect.category ? '[' + defect.category + '] ' : ''}${defect.title}：${defect.remark || '未填寫異常說明'}`;
      handoverRows.push([
        noteId,
        bizDate,
        deptId,
        'DEFECT',
        logId,
        defect.itemId || '',
        content,
        currentUser.userId,
        '', // Assignee_ID
        'OPEN', // Status
        '', // Resolution
        '', // Resolved_By
        '', // Resolved_At
        submitTime // Created_At
      ]);
    });

    // 若填寫人有手動輸入交接事項，亦寫入 Handover_Notes
    if (payload.handoverNote && String(payload.handoverNote).trim() !== '') {
      const memoNoteId = `${noteIdPrefix}-MEMO-${uniqueSuffix}`;
      handoverRows.push([
        memoNoteId,
        bizDate,
        deptId,
        'HANDOVER',
        logId,
        '',
        String(payload.handoverNote).trim(),
        currentUser.userId,
        '',
        'OPEN',
        '',
        '',
        '',
        submitTime
      ]);
    }

    if (handoverRows.length > 0) {
      const hStartRow = handoverSheet.getLastRow() + 1;
      handoverSheet.getRange(hStartRow, 1, handoverRows.length, handoverRows[0].length).setValues(handoverRows);
    }

    // 9. 格式化 LINE 通報複製文字
    const stageZh = stage === 'OPEN' ? '營業前' : '營業後';
    const deptName = dept ? dept.Dept_Name : deptId;
    let notifyReport = `【Babbuza 巡檢通報】\n` +
      `🏢 站點：${deptName} (${stageZh})\n` +
      `📅 日期：${bizDate} ${currentTimeStr}\n` +
      `👤 檢核人：${currentUser.name}\n` +
      `📊 項目：共 ${totalCount} 項 (正常: ${okCount} | 異常: ${ngCount} | 不適用: ${naCount})\n` +
      `⏰ 狀態：${isLate ? '⚠️ 遲交 (截止 ' + deadlineStr + ')' : '✅ 準時完成'}\n`;

    if (defectItems.length > 0) {
      notifyReport += `\n🚨 異常項目備忘：\n`;
      defectItems.forEach((d, i) => {
        notifyReport += `${i + 1}. [${d.category}] ${d.title}\n   說明：${d.remark || '無備註'}\n`;
      });
    }

    if (payload.handoverNote && String(payload.handoverNote).trim() !== '') {
      notifyReport += `\n📝 交接事項：\n${String(payload.handoverNote).trim()}\n`;
    }

    return {
      success: true,
      logId: logId,
      version: version,
      submitTime: submitTime,
      isLate: isLate,
      stats: {
        total: totalCount,
        ok: okCount,
        ng: ngCount,
        na: naCount
      },
      defectCount: defectItems.length,
      notifyReport: notifyReport
    };
  }
};
