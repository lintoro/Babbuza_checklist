/**
 * Babbuza Checklist - 國定假日與行事曆連假模組 (Holiday.js)
 * 收錄中華民國行政院人事行政總處核定/公告之 2026 年與 2027 年已知國定假日與連續假期
 */

const Holiday = {
  /**
   * 2026 ~ 2027 年中華民國國定假日與連假清冊
   */
  HOLIDAYS_CATALOG: [
    // 2026 年 (民國 115 年)
    { date: '2026-01-01', note: '元旦 (開國紀念日)' },
    { date: '2026-02-14', note: '農曆春節連假' },
    { date: '2026-02-15', note: '農曆除夕' },
    { date: '2026-02-16', note: '春節初一' },
    { date: '2026-02-17', note: '春節初二' },
    { date: '2026-02-18', note: '春節初三' },
    { date: '2026-02-19', note: '春節初四補假' },
    { date: '2026-02-20', note: '春節初五補假' },
    { date: '2026-02-21', note: '春節連假' },
    { date: '2026-02-22', note: '春節連假' },
    { date: '2026-02-27', note: '228和平紀念日補假' },
    { date: '2026-02-28', note: '228和平紀念日' },
    { date: '2026-04-03', note: '兒童節補假' },
    { date: '2026-04-04', note: '兒童節' },
    { date: '2026-04-05', note: '清明節 (民族掃墓節)' },
    { date: '2026-04-06', note: '清明節補假' },
    { date: '2026-05-01', note: '勞動節' },
    { date: '2026-06-19', note: '端午節' },
    { date: '2026-06-20', note: '端午節連假' },
    { date: '2026-06-21', note: '端午節連假' },
    { date: '2026-09-25', note: '中秋節' },
    { date: '2026-09-26', note: '中秋節連假' },
    { date: '2026-09-27', note: '中秋節連假' },
    { date: '2026-10-09', note: '國慶日補假' },
    { date: '2026-10-10', note: '國慶日' },
    { date: '2026-10-11', note: '國慶日連假' },

    // 2027 年 (民國 116 年)
    { date: '2027-01-01', note: '元旦 (開國紀念日)' },
    { date: '2027-01-02', note: '元旦連假' },
    { date: '2027-01-03', note: '元旦連假' },
    { date: '2027-02-05', note: '農曆除夕前一日' },
    { date: '2027-02-06', note: '農曆除夕' },
    { date: '2027-02-07', note: '春節初一' },
    { date: '2027-02-08', note: '春節初二' },
    { date: '2027-02-09', note: '春節初三' },
    { date: '2027-02-10', note: '春節初四補假' },
    { date: '2027-02-11', note: '春節初五補假' },
    { date: '2027-02-12', note: '春節連假' },
    { date: '2027-02-13', note: '春節連假' },
    { date: '2027-02-14', note: '春節連假' },
    { date: '2027-02-26', note: '228和平紀念日補假' },
    { date: '2027-02-27', note: '228連假' },
    { date: '2027-02-28', note: '228和平紀念日' },
    { date: '2027-03-01', note: '228和平紀念日補假' },
    { date: '2027-04-02', note: '兒童節補假' },
    { date: '2027-04-03', note: '清明連假' },
    { date: '2027-04-04', note: '兒童節' },
    { date: '2027-04-05', note: '清明節 (民族掃墓節)' },
    { date: '2027-04-06', note: '清明節補假' },
    { date: '2027-05-01', note: '勞動節' },
    { date: '2027-06-09', note: '端午節' },
    { date: '2027-09-15', note: '中秋節' },
    { date: '2027-10-08', note: '國慶日補假' },
    { date: '2027-10-10', note: '國慶日' },
    { date: '2027-10-11', note: '國慶日補假' }
  ],

  /**
   * 初始化寫入 2026 ~ 2027 年全量國定假日至 Calendar 工作表
   */
  seedAllHolidays: function() {
    const sheet = Utils.getSheet('Calendar');
    const existing = Utils.sheetToObjects('Calendar');
    const existingDates = new Set(existing.map(e => Utils.formatDate(e.Date)));

    const rowsToAdd = [];
    let count = 0;

    this.HOLIDAYS_CATALOG.forEach(item => {
      if (!existingDates.has(item.date)) {
        // Headers: Date, Day_Type, Dept_ID, Note
        rowsToAdd.push([item.date, 'HOLIDAY', '', item.note]);
        count++;
      }
    });

    if (rowsToAdd.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 4).setValues(rowsToAdd);
    }

    return {
      success: true,
      addedCount: count,
      totalCatalogCount: this.HOLIDAYS_CATALOG.length,
      message: `已成功將 2026~2027 年國定假日共 ${count} 筆新連假寫入 Calendar 資料庫`
    };
  },

  /**
   * 檢查當前日期未來 N 個月 (預設 3 個月) 的連假資料
   * @param {string} baseDateStr - 基準日期 (預設今日)
   * @param {number} months - 月數 (預設 3 個月)
   */
  checkUpcomingHolidays: function(baseDateStr, months = 3) {
    const todayStr = baseDateStr || Utils.formatDate();
    const startDate = new Date(todayStr + 'T00:00:00+08:00');
    const endDate = new Date(startDate.getTime());
    endDate.setMonth(endDate.getMonth() + months);

    const endDateStr = Utils.formatDate(endDate);

    // 取得資料庫中已存在的記錄
    const existing = Utils.sheetToObjects('Calendar');
    const existingMap = {};
    existing.forEach(e => {
      const d = Utils.formatDate(e.Date);
      existingMap[d] = e;
    });

    // 篩選目錄中落在區間內的項目
    const upcoming = [];
    this.HOLIDAYS_CATALOG.forEach(item => {
      if (item.date >= todayStr && item.date <= endDateStr) {
        const inDb = Boolean(existingMap[item.date]);
        upcoming.push({
          date: item.date,
          note: item.note,
          dayType: 'HOLIDAY',
          isAlreadyInDb: inDb,
          dbRecord: inDb ? existingMap[item.date] : null
        });
      }
    });

    return {
      success: true,
      baseDate: todayStr,
      endDate: endDateStr,
      months: months,
      count: upcoming.length,
      unwrittenCount: upcoming.filter(u => !u.isAlreadyInDb).length,
      holidays: upcoming
    };
  },

  /**
   * 確認並寫入指定的連假資料至 Calendar 表
   * @param {Array} holidays - 要寫入的清單
   */
  confirmWriteHolidays: function(holidays) {
    if (!Array.isArray(holidays) || holidays.length === 0) {
      return { success: false, error: '未提供欲寫入的連假清單' };
    }

    const sheet = Utils.getSheet('Calendar');
    const existing = Utils.sheetToObjects('Calendar');
    const existingDates = new Set(existing.map(e => Utils.formatDate(e.Date)));

    const rowsToAdd = [];
    holidays.forEach(h => {
      const d = String(h.date || '').trim();
      if (d && !existingDates.has(d)) {
        rowsToAdd.push([d, h.dayType || 'HOLIDAY', h.deptId || '', h.note || '國定假日']);
        existingDates.add(d);
      }
    });

    if (rowsToAdd.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 4).setValues(rowsToAdd);
    }

    return {
      success: true,
      writtenCount: rowsToAdd.length,
      message: `成功將 ${rowsToAdd.length} 筆未來連假確認寫入 Calendar 資料庫！`
    };
  }
};
