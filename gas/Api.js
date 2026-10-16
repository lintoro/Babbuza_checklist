/**
 * Babbuza Checklist - API 統一路由進入點 (Api.js)
 */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'status';

    switch (action) {
      case 'status':
      case 'health':
      case 'ping': {
        const ss = Utils.getSpreadsheet();
        const baseInfo = {
          status: 'UP',
          appName: 'Babbuza Checklist App',
          spreadsheet: ss.getName(),
          time: Utils.formatDateTime(),
          version: '2.5.0-prod'
        };

        if (params.deep === 'true' || params.probe === 'system') {
          // 執行系統級深層探針檢查 (生產安全唯讀自檢)
          const tables = ['Users', 'Departments', 'User_Depts', 'Check_Items', 'Audit_Logs', 'Handover_Notes', 'Calendar'];
          const tableStatus = {};
          tables.forEach(tableName => {
            const sheet = ss.getSheetByName(tableName);
            tableStatus[tableName] = {
              exists: Boolean(sheet),
              rowCount: sheet ? sheet.getLastRow() : 0
            };
          });

          // 站點規格檢查
          const depts = Utils.sheetToObjects('Departments') || [];
          const activeDepts = depts.filter(d => Boolean(d.Is_Active === true || String(d.Is_Active).toUpperCase() === 'TRUE'));
          const diyExcluded = !activeDepts.some(d => String(d.Dept_ID).trim().toUpperCase() === 'DIY');

          // 題目規格檢查
          const items = Utils.sheetToObjects('Check_Items') || [];
          const activeItems = items.filter(i => String(i.Is_Active).toUpperCase() !== 'FALSE');

          // 異常池與交接狀態
          const notes = Utils.sheetToObjects('Handover_Notes') || [];
          const unresolvedNotes = notes.filter(n => String(n.Status).toUpperCase() === 'OPEN');

          baseInfo.deepProbe = {
            tables: tableStatus,
            allTablesHealthy: tables.every(t => tableStatus[t].exists),
            stationCheck: {
              totalStations: depts.length,
              activeStations: activeDepts.length,
              diyExcluded: diyExcluded
            },
            itemCheck: {
              totalItems: items.length,
              activeItems: activeItems.length
            },
            issuePoolCheck: {
              totalIssues: notes.length,
              unresolvedCount: unresolvedNotes.length
            },
            timeFormatCheck: {
              sampleStationTime: activeDepts.length > 0 ? {
                openStart: String(activeDepts[0].Open_Start_Time || ''),
                openEnd: String(activeDepts[0].Open_Deadline || ''),
                closeStart: String(activeDepts[0].Close_Start_Time || ''),
                closeEnd: String(activeDepts[0].Close_Deadline || '')
              } : null
            }
          };
        }

        return Utils.jsonResponse(baseInfo);
      }

      case 'get_user_depts': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        const userObj = Utils.sheetToObjects('Users').find(u => String(u.User_ID).trim().toUpperCase() === auth.user.userId.toUpperCase());
        const depts = Checklist.getUserDepartments(auth.user.userId, auth.user.role);
        return Utils.jsonResponse({
          user: userObj ? {
            userId: userObj.User_ID,
            name: userObj.Name,
            role: userObj.Role,
            mustChangePwd: Boolean(userObj.Must_Change_Pwd === true || String(userObj.Must_Change_Pwd).toUpperCase() === 'TRUE')
          } : auth.user,
          departments: depts
        });
      }

      case 'get_checklist': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }

        const deptId = params.deptId;
        const stage = params.stage || 'OPEN';
        const date = params.date || Utils.formatDate();

        if (!deptId) {
          return Utils.jsonResponse(null, false, '缺少 deptId 參數');
        }

        const items = Checklist.getChecklistItems(deptId, stage, date);
        const status = Checklist.getDepartmentStatus(deptId, date);
        let handoverNotes = [];
        if (params.includeHandover === 'true') {
          handoverNotes = Handover.getNotes(deptId, true);
        }

        return Utils.jsonResponse({
          deptId: deptId,
          stage: stage,
          date: date,
          count: items.length,
          status: status,
          items: items,
          handoverNotes: handoverNotes
        });
      }

      case 'get_dept_status': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }

        const deptId = params.deptId;
        const date = params.date || Utils.formatDate();
        if (!deptId) {
          return Utils.jsonResponse(null, false, '缺少 deptId 參數');
        }
        const status = Checklist.getDepartmentStatus(deptId, date);
        return Utils.jsonResponse(status);
      }

      case 'get_handover': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }

        const deptId = params.deptId;
        if (!deptId) {
          return Utils.jsonResponse(null, false, '缺少 deptId 參數');
        }
        const onlyOpen = params.onlyOpen === 'true' || params.onlyOpen === true;
        const notes = Handover.getNotes(deptId, onlyOpen);
        return Utils.jsonResponse({
          deptId: deptId,
          notes: notes
        });
      }

      case 'get_open_issues': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const res = Handover.getAllOpenIssues();
        return Utils.jsonResponse(res.success ? res.data : null, res.success, res.error);
      }

      case 'get_resolved_history': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const limit = params.limit || 50;
        const res = Handover.getResolvedHistory(limit);
        return Utils.jsonResponse(res.success ? res.data : null, res.success, res.error);
      }

      case 'get_inspection_matrix': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const deptId = params.deptId || '1F';
        const stage = params.stage || 'OPEN';
        const startDate = params.startDate || '';
        const endDate = params.endDate || '';
        const res = Checklist.getInspectionMatrix(deptId, stage, startDate, endDate);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'get_batch_inspection_matrix': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const deptIdsStr = params.deptIds || '';
        const deptIds = deptIdsStr ? deptIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const stagesStr = params.stages || 'OPEN,CLOSE';
        const stages = stagesStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const startDate = params.startDate || '';
        const endDate = params.endDate || '';

        const res = Checklist.getBatchInspectionMatrix(deptIds, stages, startDate, endDate);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_get_departments': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);
        const res = Checklist.getAllDepartments(auth.user);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_get_checklist_items': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);
        const deptId = params.deptId || '1F';
        const stage = params.stage || 'OPEN';
        const res = Checklist.adminGetChecklistItems(deptId, stage, auth.user);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_get_users': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN']);
        const res = Auth.adminGetUsers(auth.user);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'check_upcoming_holidays': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const months = parseInt(params.months, 10) || 3;
        const res = Holiday.checkUpcomingHolidays(params.date, months);
        return Utils.jsonResponse(res, res.success, res.error);
      }

      case 'get_all_calendar': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const rows = Utils.sheetToObjects('Calendar');
        return Utils.jsonResponse({
          count: rows.length,
          calendar: rows
        });
      }

      case 'get_summary_report': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }
        Utils.requireRole(auth.user, ['ADMIN', 'SUPERVISOR']);

        const stage = params.stage || 'OPEN';
        const date = params.date || Utils.formatDate();
        const res = Report.generateSummaryReport(stage, date);
        return Utils.jsonResponse(res, res.success, res.error);
      }

      default:
        return Utils.jsonResponse(null, false, '不支援的 GET Action: ' + action);
    }
  } catch (err) {
    console.error('doGet error:', err);
    return Utils.jsonResponse(null, false, err.message || '伺服器內部錯誤');
  }
}

function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (ex) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const action = body.action || '';

    // 1. 公開/無需 Token 的動作 (僅限登入)
    if (action === 'login') {
      const res = Auth.login(body.userId, body.password);
      return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
    }



    // 2. 需要 Token 驗證的動作
    const token = body.token || (e.parameter && e.parameter.token);
    const auth = Utils.validateToken(token);
    if (!auth.valid) {
      return Utils.jsonResponse(null, false, '身份驗證失敗: ' + auth.error);
    }
    const currentUser = auth.user;

    switch (action) {
      case 'change_password': {
        const res = Auth.changePassword(body.userId, body.oldPassword, body.newPassword, token);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'submit_audit': {
        const res = Audit.submit(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'create_handover': {
        const res = Handover.createNote(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'resolve_handover': {
        const res = Handover.resolveNote(body.noteId, body.resolution, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_save_user': {
        const res = Auth.adminSaveUser(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_set_user_status': {
        const res = Auth.adminSetUserStatus(body.targetUserId, body.status, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_reset_user_password': {
        const res = Auth.adminResetUserPassword(body.targetUserId, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_delete_user': {
        const res = Auth.adminDeleteUser(body.targetUserId, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_save_department': {
        Utils.requireRole(currentUser, ['ADMIN']);
        const res = Checklist.saveDepartment(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_toggle_dept_status': {
        Utils.requireRole(currentUser, ['ADMIN']);
        const res = Checklist.toggleDepartmentStatus(body.deptId, body.isActive, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_update_dept_sort': {
        Utils.requireRole(currentUser, ['ADMIN']);
        const res = Checklist.updateDepartmentSort(body.orderedDeptIds, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_save_checklist_item': {
        Utils.requireRole(currentUser, ['ADMIN', 'SUPERVISOR']);
        const res = Checklist.adminSaveChecklistItem(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_toggle_item_status': {
        Utils.requireRole(currentUser, ['ADMIN', 'SUPERVISOR']);
        const res = Checklist.adminToggleItemStatus(body.itemId, body.isActive, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_delete_checklist_item': {
        Utils.requireRole(currentUser, ['ADMIN', 'SUPERVISOR']);
        const res = Checklist.adminDeleteItem(body.itemId, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_update_item_sort': {
        Utils.requireRole(currentUser, ['ADMIN', 'SUPERVISOR']);
        const res = Checklist.adminUpdateItemSort(body.orderedItemIds, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_remove_audit_log': {
        const res = Checklist.removeAuditLog(body.logId, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_remove_handover_note': {
        if (!currentUser || currentUser.role !== 'ADMIN') {
          return Utils.jsonResponse(null, false, '僅系統管理員可操作');
        }
        const noteId = String(body.noteId || '').trim();
        const sheet = Utils.getSheet('Handover_Notes');
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const idCol = headers.indexOf('Note_ID');
        let deleted = false;
        if (idCol !== -1 && noteId) {
          for (let i = data.length - 1; i >= 1; i--) {
            if (String(data[i][idCol]).trim() === noteId) {
              sheet.deleteRow(i + 1);
              deleted = true;
            }
          }
        }
        return Utils.jsonResponse({ success: deleted, message: deleted ? `已成功銷毀交接備忘 [${noteId}]` : '查無該備忘' });
      }

      case 'admin_normalize_times': {
        if (!currentUser || currentUser.role !== 'ADMIN') {
          return Utils.jsonResponse(null, false, '僅系統管理員可執行');
        }
        Utils.normalizeDepartmentTimes();
        Utils.normalizeAuditLogsTimes();

        // 一併物理清除歷史測試殘留備忘單號
        const sheetH = Utils.getSheet('Handover_Notes');
        const dataH = sheetH.getDataRange().getValues();
        const headersH = dataH[0].map(h => String(h).trim());
        const idColH = headersH.indexOf('Note_ID');
        let cleanedNotes = 0;
        if (idColH !== -1) {
          for (let i = dataH.length - 1; i >= 1; i--) {
            const nId = String(dataH[i][idColH]).trim();
            if (nId === 'NOTE-20261015-1F-OPEN-MEMO-1699' || nId === 'NOTE-20261015-1F-OPEN-NG1-1699') {
              sheetH.deleteRow(i + 1);
              cleanedNotes++;
            }
          }
        }

        return Utils.jsonResponse({
          success: true,
          message: `站點營業時間已成功正規化為純字串，並連帶物理清除 ${cleanedNotes} 筆歷史殘留測試備忘`
        });
      }

      case 'admin_setup_8f_items': {
        if (!currentUser || currentUser.role !== 'ADMIN') {
          return Utils.jsonResponse(null, false, '僅系統管理員可執行 8F 點檢題目重設');
        }
        const res = Checklist.setup8FChecklistItems(currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'seed_all_holidays': {
        if (!currentUser || currentUser.role !== 'ADMIN') {
          return Utils.jsonResponse(null, false, '僅系統管理員可初始化連假資料');
        }
        const res = Holiday.seedAllHolidays();
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'confirm_write_holidays': {
        if (!currentUser || currentUser.role !== 'ADMIN') {
          return Utils.jsonResponse(null, false, '僅系統管理員可確認寫入連假');
        }
        const res = Holiday.confirmWriteHolidays(body.holidays);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'setup_daily_triggers': {
        const isAdmin = currentUser && currentUser.role === 'ADMIN';
        const isSecretKey = body.secretKey && body.secretKey === Utils.getSecretKey();
        if (!isAdmin && !isSecretKey) {
          return Utils.jsonResponse(null, false, '僅系統管理員可設定排程觸發器');
        }
        const res = Report.setupDailyTriggers();
        return Utils.jsonResponse(res, res.success, res.error);
      }

      default:




        return Utils.jsonResponse(null, false, '不支援的 POST Action: ' + action);
    }
  } catch (err) {
    console.error('doPost error:', err);
    return Utils.jsonResponse(null, false, err.message || '伺服器內部錯誤');
  }
}
