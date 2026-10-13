/**
 * Babbuza Checklist - API 統一路由進入點 (Api.js)
 */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'status';

    switch (action) {
      case 'status':
      case 'ping': {
        const ss = Utils.getSpreadsheet();
        return Utils.jsonResponse({
          status: 'UP',
          appName: 'Babbuza Checklist App',
          spreadsheet: ss.getName(),
          time: Utils.formatDateTime()
        });
      }

      case 'get_user_depts': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        const depts = Checklist.getUserDepartments(auth.user.userId, auth.user.role);
        return Utils.jsonResponse({
          user: auth.user,
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

        return Utils.jsonResponse({
          deptId: deptId,
          stage: stage,
          date: date,
          count: items.length,
          status: status,
          items: items
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

        const res = Handover.getAllOpenIssues();
        return Utils.jsonResponse(res.success ? res.data : null, res.success, res.error);
      }

      case 'get_resolved_history': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }

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

        const deptId = params.deptId || '1F';
        const stage = params.stage || 'OPEN';
        const startDate = params.startDate || '';
        const endDate = params.endDate || '';
        const res = Checklist.getInspectionMatrix(deptId, stage, startDate, endDate);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_get_departments': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        const res = Checklist.getAllDepartments(auth.user);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_get_users': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, auth.error);
        }
        const res = Auth.adminGetUsers(auth.user);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'check_upcoming_holidays': {
        const token = params.token;
        const auth = Utils.validateToken(token);
        if (!auth.valid) {
          return Utils.jsonResponse(null, false, '身分驗證失敗: ' + auth.error);
        }

        const months = parseInt(params.months, 10) || 3;
        const res = Holiday.checkUpcomingHolidays(params.date, months);
        return Utils.jsonResponse(res, res.success, res.error);
      }

      case 'get_all_calendar': {
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

        const stage = params.stage || 'OPEN';
        const date = params.date || Utils.formatDate();
        const res = Report.generateSummaryReport(stage, date);
        return Utils.jsonResponse(res, res.success, res.error);
      }

      default:



        return Utils.jsonResponse(null, false, '不支援的 GET Action: ' + action);
    }
  } catch (err) {
    return Utils.jsonResponse(null, false, err.toString());
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
        const res = Checklist.saveDepartment(body.payload, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_toggle_dept_status': {
        const res = Checklist.toggleDepartmentStatus(body.deptId, body.isActive, currentUser);
        return Utils.jsonResponse(res.success ? res : null, res.success, res.error);
      }

      case 'admin_update_dept_sort': {
        const res = Checklist.updateDepartmentSort(body.orderedDeptIds, currentUser);
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
    return Utils.jsonResponse(null, false, err.toString());
  }
}
