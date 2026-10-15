/**
 * Babbuza Checklist - 定時巡檢總結報表引擎 (Report.js)
 * 負責每日 11:00 (營業前) 與 20:00 (營業後) 全商場站點點檢總結、異常彙整與 LINE 通報字串產出
 */

const Report = {
  /**
   * 站點中文名稱對照表
   */
  getDeptName: function(deptId, deptsList) {
    if (!deptId) return '';
    const cleanId = String(deptId).trim().toUpperCase();
    if (Array.isArray(deptsList)) {
      const found = deptsList.find(d => String(d.Dept_ID).trim().toUpperCase() === cleanId);
      if (found && found.Dept_Name) return found.Dept_Name;
    }
    // 若未傳入或找不到，動態自 Departments 資料表讀取
    const allDepts = Utils.sheetToObjects('Departments');
    const matched = allDepts.find(d => String(d.Dept_ID).trim().toUpperCase() === cleanId);
    if (matched && matched.Dept_Name) return matched.Dept_Name;

    if (cleanId === 'BENPU') return '本舖';
    if (cleanId === 'XIAOPU') return '小舖';
    return cleanId;
  },

  /**
   * 產出全商場巡檢總結報表
   * @param {string} stage - 'OPEN' (營業前) 或 'CLOSE' (營業後)
   * @param {string} dateStr - 營業日期 (預設今日 YYYY-MM-DD)
   */
  generateSummaryReport: function(stage = 'OPEN', dateStr = null) {
    const cleanStage = String(stage || 'OPEN').trim().toUpperCase();
    const targetDate = dateStr || Utils.formatDate();
    const stageZh = cleanStage === 'OPEN' ? '營業前 (開站)' : '營業後 (閉站)';
    const scheduledTime = cleanStage === 'OPEN' ? '11:00' : '20:00';

    // 1. 讀取所有啟用的站點
    const allDepts = Utils.sheetToObjects('Departments')
      .filter(d => Boolean(d.Is_Active))
      .sort((a, b) => (parseInt(a.Sort_Order, 10) || 0) - (parseInt(b.Sort_Order, 10) || 0));

    // 2. 讀取當日 Audit_Logs (取最新版本 Is_Current = true)
    const allLogs = Utils.sheetToObjects('Audit_Logs');
    const todayLogs = allLogs.filter(l => {
      let d = l.Biz_Date;
      if (d instanceof Date) d = Utils.formatDate(d);
      const isTestLog = Boolean(l.Is_Test) || String(l.Client_Key || '').toUpperCase().startsWith('TEST-');
      return String(d).trim() === targetDate &&
             String(l.Stage).trim().toUpperCase() === cleanStage &&
             Boolean(l.Is_Current) &&
             !isTestLog; // 排除測試沙盒紀錄
    });

    // 建立 Dept_ID -> Log 對照
    const logMap = {};
    todayLogs.forEach(l => {
      logMap[String(l.Dept_ID).trim().toUpperCase()] = l;
    });

    // 3. 讀取當日異常項目 (Audit_Details 中 NG 者)
    const allDetails = Utils.sheetToObjects('Audit_Details');
    const logIds = new Set(todayLogs.map(l => l.Log_ID));
    const defectDetails = allDetails.filter(dt => logIds.has(dt.Log_ID) && dt.Status === 'NG');

    // 4. 讀取當日 Handover_Notes (交接與異常備忘，強制排除測試沙盒產生的備忘)
    const allNotes = Utils.sheetToObjects('Handover_Notes');
    const todayNotes = allNotes.filter(n => {
      let d = n.Biz_Date;
      if (d instanceof Date) d = Utils.formatDate(d);
      const isTestNote = String(n.Note_ID || '').toUpperCase().startsWith('TEST-') ||
                         String(n.Source_Log_ID || '').toUpperCase().startsWith('TEST-') ||
                         String(n.Note_ID || '').includes('-TEST-');
      return String(d).trim() === targetDate && !isTestNote;
    });

    // 5. 分類統計
    const onTimeList = [];
    const lateList = [];
    const missingList = [];

    allDepts.forEach(dept => {
      const deptId = dept.Dept_ID;
      const deptName = this.getDeptName(deptId, allDepts);
      const log = logMap[deptId];
      // 動態解析各站點截止時間 (透過 Checklist.resolveTime 進行合法範圍驗證，杜絕時差偏差)
      const rawDeadline = cleanStage === 'OPEN' ? dept.Open_Deadline : dept.Close_Deadline;
      const defaultDeadline = cleanStage === 'OPEN' ? '10:30' : '20:00';
      const minValid = cleanStage === 'OPEN' ? '07:00' : '15:00';
      const maxValid = cleanStage === 'OPEN' ? '16:00' : '23:59';
      const deadline = Checklist.resolveTime(rawDeadline, defaultDeadline, minValid, maxValid);

      if (!log) {
        // 尚未繳交 / 缺交
        missingList.push({
          deptId: deptId,
          deptName: deptName,
          deadline: deadline,
          status: 'MISSING'
        });
      } else {
        const submitTime = Utils.formatTime(log.Submit_Time);
        const executor = log.Executor_Name || log.Executor_ID || '同仁';
        const isLate = Boolean(log.Is_Late);
        const ngCount = parseInt(log.NG_Count, 10) || 0;

        const record = {
          deptId: deptId,
          deptName: deptName,
          logId: log.Log_ID,
          submitTime: submitTime,
          deadline: deadline,
          executor: executor,
          isLate: isLate,
          total: log.Total_Count,
          ok: log.OK_Count,
          ng: ngCount,
          na: log.NA_Count
        };

        if (isLate) {
          lateList.push(record);
        } else {
          onTimeList.push(record);
        }
      }
    });

    const totalStations = allDepts.length;
    const submittedCount = onTimeList.length + lateList.length;
    const onTimeCount = onTimeList.length;
    const lateCount = lateList.length;
    const missingCount = missingList.length;
    const completionRate = totalStations > 0 ? Math.round((submittedCount / totalStations) * 100) : 0;

    // 彙整異常項目清冊
    const defectSummaries = [];
    defectDetails.forEach(d => {
      const parentLog = todayLogs.find(l => l.Log_ID === d.Log_ID);
      const dName = parentLog ? this.getDeptName(parentLog.Dept_ID, allDepts) : '未知站點';
      defectSummaries.push({
        deptName: dName,
        category: d.Category_Snapshot || '一般',
        title: d.Title_Snapshot || '',
        remark: d.Remark || '無備註說明'
      });
    });

    // 彙整交接備忘
    const handoverSummaries = [];
    todayNotes.filter(n => n.Type === 'HANDOVER').forEach(n => {
      handoverSummaries.push({
        deptName: this.getDeptName(n.Dept_ID, allDepts),
        content: n.Content
      });
    });

    // 6. 產出標準格式之 LINE / 簡報通報文字
    let reportText = `📋【Babbuza 全商場巡檢總結 - ${stageZh}】\n` +
      `📅 統計日期：${targetDate} ${scheduledTime}\n` +
      `📊 站點繳交率：${submittedCount} / ${totalStations} 站 (${completionRate}%)\n` +
      `🟢 準時：${onTimeCount} 站 | 🟡 遲交：${lateCount} 站 | 🔴 缺交：${missingCount} 站\n`;

    // 準時完成區塊
    if (onTimeList.length > 0) {
      reportText += `\n🟢 準時完成 (${onTimeList.length} 站)：\n`;
      onTimeList.forEach(item => {
        const defectHint = item.ng > 0 ? ` [⚠️${item.ng}項異常]` : ' [全正常]';
        reportText += `  • ${item.deptName} (${item.submitTime}) - ${item.executor}${defectHint}\n`;
      });
    }

    // 遲交完成區塊
    if (lateList.length > 0) {
      reportText += `\n🟡 遲交完成 (${lateList.length} 站)：\n`;
      lateList.forEach(item => {
        const defectHint = item.ng > 0 ? ` [⚠️${item.ng}項異常]` : ' [全正常]';
        reportText += `  • ${item.deptName} (${item.submitTime} 繳交 / 截止 ${item.deadline}) - ${item.executor}${defectHint}\n`;
      });
    }

    // 缺交區塊
    if (missingList.length > 0) {
      reportText += `\n🔴 尚未繳交 (${missingList.length} 站)：\n`;
      missingList.forEach(item => {
        reportText += `  • ${item.deptName} (截止時間 ${item.deadline})\n`;
      });
    } else {
      reportText += `\n🎉 全商場站點已全數完成點檢！\n`;
    }

    // 異常清冊區塊
    if (defectSummaries.length > 0) {
      reportText += `\n🚨 今日異常項目與報修備忘 (共 ${defectSummaries.length} 項)：\n`;
      defectSummaries.forEach((d, idx) => {
        reportText += `  ${idx + 1}. [${d.deptName}] [${d.category}] ${d.title}\n     說明：${d.remark}\n`;
      });
    }

    // 重要交接備忘區塊
    if (handoverSummaries.length > 0) {
      reportText += `\n📝 重要站點交接事項 (共 ${handoverSummaries.length} 則)：\n`;
      handoverSummaries.forEach((h, idx) => {
        reportText += `  • [${h.deptName}] ${h.content}\n`;
      });
    }

    reportText += `\n-----------------------------------\n※ 本報表由 Babbuza 智慧巡檢系統自動彙總`;

    return {
      success: true,
      stage: cleanStage,
      date: targetDate,
      scheduledTime: scheduledTime,
      stats: {
        totalStations: totalStations,
        submittedCount: submittedCount,
        onTimeCount: onTimeCount,
        lateCount: lateCount,
        missingCount: missingCount,
        completionRate: completionRate,
        defectCount: defectSummaries.length,
        handoverCount: handoverSummaries.length
      },
      lists: {
        onTime: onTimeList,
        late: lateList,
        missing: missingList,
        defects: defectSummaries,
        handovers: handoverSummaries
      },
      reportText: reportText
    };
  },

  /**
   * 建立每日定時 Trigger (11:00 與 20:00)
   */
  setupDailyTriggers: function() {
    // 先清理既有相同名稱的 Trigger 避免重複觸發
    const existing = ScriptApp.getProjectTriggers();
    existing.forEach(t => {
      const handler = t.getHandlerFunction();
      if (handler === 'triggerOpenReport' || handler === 'triggerCloseReport') {
        ScriptApp.deleteTrigger(t);
      }
    });

    // 1. 每日 11:00 觸發開店報表 (在 10:45 ~ 11:00 之間)
    ScriptApp.newTrigger('triggerOpenReport')
      .timeBased()
      .atHour(11)
      .everyDays(1)
      .inTimezone('Asia/Taipei')
      .create();

    // 2. 每日 20:00 觸發閉店報表
    ScriptApp.newTrigger('triggerCloseReport')
      .timeBased()
      .atHour(20)
      .everyDays(1)
      .inTimezone('Asia/Taipei')
      .create();

    return {
      success: true,
      message: '已成功建立每日 11:00 開店報表與 20:00 閉店報表排程觸發器！'
    };
  }
};

/**
 * 全域 Trigger 執行函式
 */
function triggerOpenReport() {
  try { Handover.autoArchiveExpiredHandovers(3); } catch (e) {}
  const res = Report.generateSummaryReport('OPEN');
  console.log('【定時排程】開店巡檢總結報表產出完成：\n' + res.reportText);
}

function triggerCloseReport() {
  try { Handover.autoArchiveExpiredHandovers(3); } catch (e) {}
  const res = Report.generateSummaryReport('CLOSE');
  console.log('【定時排程】閉店巡檢總結報表產出完成：\n' + res.reportText);
}
