/**
 * Babbuza Checklist - 資料庫測試資料重置與乾淨範本建立模組 (SeedData.js)
 */

const SeedData = {
  /**
   * 清除雜亂測試資料並建立精簡、代表性之真實情境測試資料
   */
  cleanAndReseed: function() {
    const logsSheet = Utils.getSheet('Audit_Logs');
    const detailsSheet = Utils.getSheet('Audit_Details');
    const handoverSheet = Utils.getSheet('Handover_Notes');

    // 1. 清空 Audit_Logs (保留第 1 列標題)
    if (logsSheet.getLastRow() > 1) {
      logsSheet.getRange(2, 1, logsSheet.getLastRow() - 1, logsSheet.getLastColumn()).clearContent();
    }

    // 2. 清空 Audit_Details (保留第 1 列標題)
    if (detailsSheet.getLastRow() > 1) {
      detailsSheet.getRange(2, 1, detailsSheet.getLastRow() - 1, detailsSheet.getLastColumn()).clearContent();
    }

    // 3. 清空 Handover_Notes (保留第 1 列標題)
    if (handoverSheet.getLastRow() > 1) {
      handoverSheet.getRange(2, 1, handoverSheet.getLastRow() - 1, handoverSheet.getLastColumn()).clearContent();
    }

    // 4. 定義日期 (以當前日期為基準計算前天、昨天、今天)
    const now = new Date();
    const dToday = Utils.formatDate(now);
    const dYesterday = Utils.formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const dBeforeYesterday = Utils.formatDate(new Date(now.getTime() - 48 * 60 * 60 * 1000));

    // 取得 1F, BENPU, MSS1 點檢項目
    const checkItems = Utils.sheetToObjects('Check_Items');
    const getItems = (deptId, stage) => {
      return checkItems.filter(i =>
        Boolean(i.Is_Active) &&
        String(i.Dept_ID).trim().toUpperCase() === deptId &&
        String(i.Stage).trim().toUpperCase() === stage
      );
    };

    const newLogs = [];
    const newDetails = [];
    const newHandovers = [];

    // ==========================================
    // 建立 1F 服務台 (1F) 歷史紀錄
    // ==========================================
    const items1F = getItems('1F', 'OPEN');

    // (1) 前天 1F 營業前 (全數正常，準時完成)
    const logId1 = `LOG-${dBeforeYesterday.replace(/-/g, '')}-1F-OPEN-V1`;
    newLogs.push([
      logId1, dBeforeYesterday, '1F', 'OPEN', 1, true, '',
      'B115050', '李俐旻', `${dBeforeYesterday} 10:15:30`, '10:30', false,
      items1F.length, items1F.length, 0, 0, `SEED-1F-${dBeforeYesterday}`
    ]);
    items1F.forEach(it => {
      newDetails.push([logId1, it.Item_ID, it.Category, it.Title, 'OK', '', '']);
    });

    // (2) 昨天 1F 營業前 (有 1 項異常 NG：A1冷氣電燈)
    const logId2 = `LOG-${dYesterday.replace(/-/g, '')}-1F-OPEN-V1`;
    let okCount1F = 0;
    let ngCount1F = 0;
    items1F.forEach(it => {
      const isDefect = it.Title.includes('A1冷氣') || it.Title.includes('燈具') || it.Item_ID === 'ITM-0010';
      if (isDefect && ngCount1F === 0) {
        ngCount1F++;
        newDetails.push([logId2, it.Item_ID, it.Category, it.Title, 'NG', '', 'A1美術館軌道燈有2盞不亮，已通報總務更換']);
      } else {
        okCount1F++;
        newDetails.push([logId2, it.Item_ID, it.Category, it.Title, 'OK', '', '']);
      }
    });
    newLogs.push([
      logId2, dYesterday, '1F', 'OPEN', 1, true, '',
      'B115050', '李俐旻', `${dYesterday} 10:22:15`, '10:30', false,
      items1F.length, okCount1F, ngCount1F, 0, `SEED-1F-${dYesterday}`
    ]);

    // ==========================================
    // 建立 本鋪 (BENPU) 歷史紀錄
    // ==========================================
    const itemsBenpu = getItems('BENPU', 'OPEN');
    if (itemsBenpu.length > 0) {
      // (1) 前天 本鋪 營業前
      const logIdB1 = `LOG-${dBeforeYesterday.replace(/-/g, '')}-BENPU-OPEN-V1`;
      newLogs.push([
        logIdB1, dBeforeYesterday, 'BENPU', 'OPEN', 1, true, '',
        'B113083', '柯又溱', `${dBeforeYesterday} 10:12:00`, '10:30', false,
        itemsBenpu.length, itemsBenpu.length, 0, 0, `SEED-BENPU-${dBeforeYesterday}`
      ]);
      itemsBenpu.forEach(it => {
        newDetails.push([logIdB1, it.Item_ID, it.Category, it.Title, 'OK', '', '']);
      });

      // (2) 昨天 本鋪 營業前
      const logIdB2 = `LOG-${dYesterday.replace(/-/g, '')}-BENPU-OPEN-V1`;
      newLogs.push([
        logIdB2, dYesterday, 'BENPU', 'OPEN', 1, true, '',
        'B113083', '柯又溱', `${dYesterday} 10:18:40`, '10:30', false,
        itemsBenpu.length, itemsBenpu.length, 0, 0, `SEED-BENPU-${dYesterday}`
      ]);
      itemsBenpu.forEach(it => {
        newDetails.push([logIdB2, it.Item_ID, it.Category, it.Title, 'OK', '', '']);
      });
    }

    // ==========================================
    // 建立 旗艦一店 (MSS1) 歷史紀錄
    // ==========================================
    const itemsMss1 = getItems('MSS1', 'OPEN');
    if (itemsMss1.length > 0) {
      const logIdM1 = `LOG-${dYesterday.replace(/-/g, '')}-MSS1-OPEN-V1`;
      newLogs.push([
        logIdM1, dYesterday, 'MSS1', 'OPEN', 1, true, '',
        'B113014', '陳哲胤', `${dYesterday} 10:28:10`, '10:30', false,
        itemsMss1.length, itemsMss1.length, 0, 0, `SEED-MSS1-${dYesterday}`
      ]);
      itemsMss1.forEach(it => {
        newDetails.push([logIdM1, it.Item_ID, it.Category, it.Title, 'OK', '', '']);
      });
    }

    // 寫入 Audit_Logs
    if (newLogs.length > 0) {
      logsSheet.getRange(2, 1, newLogs.length, newLogs[0].length).setValues(newLogs);
    }

    // 寫入 Audit_Details
    if (newDetails.length > 0) {
      detailsSheet.getRange(2, 1, newDetails.length, newDetails[0].length).setValues(newDetails);
    }

    // ==========================================
    // 建立 精選真實感的 Handover_Notes 備忘與異常
    // ==========================================
    // 1. 1F服務台 - 未結案設備報修 (OPEN)
    newHandovers.push([
      `NOTE-${dYesterday.replace(/-/g, '')}-1F-001`,
      dYesterday,
      '1F',
      'DEFECT',
      logId2,
      'ITM-0010',
      '【點檢異常】[場域維護] A1冷氣、電燈、美術館燈：A1美術館軌道燈有2盞不亮，已通報總務更換',
      'B115050',
      '',
      'OPEN',
      '',
      '',
      '',
      `${dYesterday} 10:22:15`
    ]);

    // 2. 1F服務台 - 未結案現場交接 (OPEN)
    newHandovers.push([
      `NOTE-${dToday.replace(/-/g, '')}-1F-002`,
      dToday,
      '1F',
      'HANDOVER',
      '',
      '',
      '今日 14:00 有南投國小校外教學團體預約導覽 (約 35 人)，請備妥全半票及抵用券',
      'B115050',
      '',
      'OPEN',
      '',
      '',
      '',
      `${dToday} 09:35:00`
    ]);

    // 3. 本鋪 - 未結案現場交接 (OPEN)
    newHandovers.push([
      `NOTE-${dYesterday.replace(/-/g, '')}-BENPU-001`,
      dYesterday,
      'BENPU',
      'HANDOVER',
      '',
      '',
      '零找金 500 元已點收無誤，今日主推新品手作檜木杯墊禮盒，陳列於結帳櫃台前',
      'B113083',
      '',
      'OPEN',
      '',
      '',
      '',
      `${dYesterday} 10:18:40`
    ]);

    // 4. 旗艦一店 - 未結案設備報修 (OPEN)
    newHandovers.push([
      `NOTE-${dYesterday.replace(/-/g, '')}-MSS1-001`,
      dYesterday,
      'MSS1',
      'DEFECT',
      '',
      '',
      '大門感應電動門防夾感應器偶發鈍化，已張貼注意安全標語並已通知維修廠商安排今日複檢',
      'B113014',
      '',
      'OPEN',
      '',
      '',
      '',
      `${dYesterday} 10:28:10`
    ]);

    // 5. 1F服務台 - 已結案歷史紀錄範例 (RESOLVED)
    newHandovers.push([
      `NOTE-${dBeforeYesterday.replace(/-/g, '')}-1F-003`,
      dBeforeYesterday,
      '1F',
      'DEFECT',
      logId1,
      'ITM-0005',
      '【點檢異常】[POS] 發票信用卡紙捲備品檢查：備用發票紙捲剩餘 1 捲不足',
      'B115050',
      '',
      'RESOLVED',
      '已向行政庫房領取 2 箱發票紙捲完成備品補充',
      '李俐旻 (B115050)',
      `${dBeforeYesterday} 11:30:00`,
      `${dBeforeYesterday} 10:15:30`
    ]);

    // 寫入 Handover_Notes
    if (newHandovers.length > 0) {
      handoverSheet.getRange(2, 1, newHandovers.length, newHandovers[0].length).setValues(newHandovers);
    }

    return {
      success: true,
      message: '資料庫測試資料已清空並成功重建！',
      counts: {
        auditLogs: newLogs.length,
        auditDetails: newDetails.length,
        openHandovers: newHandovers.filter(h => h[9] === 'OPEN').length,
        resolvedHandovers: newHandovers.filter(h => h[9] === 'RESOLVED').length
      }
    };
  },

  /**
   * 去掉所有 DIY 相關設定 (DIY 站點併入 8F 服務台)
   */
  decommissionDiyStation: function() {
    let deptsUpdated = 0;
    let itemsUpdated = 0;
    let userDeptsUpdated = 0;

    // 1. Departments 表：將 DIY 標記為 Is_Active = false
    const deptSheet = Utils.getSheet('Departments');
    const deptData = deptSheet.getDataRange().getValues();
    const deptHeaders = deptData[0].map(h => String(h).trim());
    const dIdCol = deptHeaders.indexOf('Dept_ID');
    const dActiveCol = deptHeaders.indexOf('Is_Active');

    for (let i = 1; i < deptData.length; i++) {
      if (String(deptData[i][dIdCol]).trim().toUpperCase() === 'DIY') {
        deptSheet.getRange(i + 1, dActiveCol + 1).setValue(false);
        deptsUpdated++;
      }
    }

    // 2. User_Depts 表：將 DIY 設為 Is_Active = false
    const udSheet = Utils.getSheet('User_Depts');
    const udData = udSheet.getDataRange().getValues();
    const udHeaders = udData[0].map(h => String(h).trim());
    const udDeptCol = udHeaders.indexOf('Dept_ID') !== -1 ? udHeaders.indexOf('Dept_ID') : 1;
    const udActiveCol = udHeaders.indexOf('Is_Active') !== -1 ? udHeaders.indexOf('Is_Active') : 3;

    for (let i = 1; i < udData.length; i++) {
      if (String(udData[i][udDeptCol]).trim().toUpperCase() === 'DIY') {
        udSheet.getRange(i + 1, udActiveCol + 1).setValue(false);
        userDeptsUpdated++;
      }
    }

    // 3. Check_Items 表：將 DIY 相關項目標記為 Is_Active = false
    const itemSheet = Utils.getSheet('Check_Items');
    const itemData = itemSheet.getDataRange().getValues();
    const itemHeaders = itemData[0].map(h => String(h).trim());
    const itmDeptCol = itemHeaders.indexOf('Dept_ID');
    const itmActiveCol = itemHeaders.indexOf('Is_Active');

    for (let i = 1; i < itemData.length; i++) {
      if (String(itemData[i][itmDeptCol]).trim().toUpperCase() === 'DIY') {
        itemSheet.getRange(i + 1, itmActiveCol + 1).setValue(false);
        itemsUpdated++;
      }
    }

    return {
      success: true,
      message: '已成功移除 DIY 站點設定 (併入 8F服務台)',
      details: {
        deptsUpdated: deptsUpdated,
        userDeptsUpdated: userDeptsUpdated,
        itemsUpdated: itemsUpdated
      }
    };
  }
};
