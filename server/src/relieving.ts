// Phase 3 — Relieving (Exit) domain routes.
//
// One `exit_cases` entity flows through six stages; child tables hold the
// list-type data per stage. Registered from index.ts as registerRelievingRoutes(app),
// after global middleware, mirroring registerMasterRoutes. Response envelope and
// conventions match the rest of the API ({ data } / { error }, ULIDs, writeAudit).

import type { Application } from 'express';
import { ulid } from 'ulid';
import { authRequired, requireRole } from './auth';
import { query } from './db';
import { writeAudit } from './audit';
import { uploadToCloudinary } from './upload';
import { generateDocumentPdf, type DocContext, type SettlementData } from './docgen';
import { loadTemplate, loadOrgProfile } from './documents';

const DOC_GEN_TYPES = ['SETTLEMENT_SHEET', 'RELIEVING_LETTER', 'EXPERIENCE_CERTIFICATE', 'REFERENCE_LETTER'];
function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VALIDATION = (message: string) => ({ error: { code: 'VALIDATION', message } });
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Not found' } };

// Default checklist rows seeded when an exit case is created.
const DEFAULT_NDCS = ['HR', 'IT', 'Finance', 'Admin'];
const DEFAULT_ACCESS = ['Email Account', 'ERP Access', 'Biometric / Attendance', 'ID Card', 'System / VPN Login'];

async function nextExitCode(): Promise<string> {
  const rows = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)), 0) AS n FROM exit_cases WHERE code LIKE 'EX%'"
  );
  return `EX${String(Number(rows[0]?.n ?? 0) + 1).padStart(4, '0')}`;
}

// Build "SET col = ?" from a whitelist of {key, column} — same idea as masters.updateSets.
function updateSets(body: Record<string, unknown>, allowed: Array<{ key: string; column: string }>) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of allowed) {
    if (body[f.key] !== undefined) {
      sets.push(`${f.column} = ?`);
      values.push(body[f.key] === '' ? null : body[f.key]);
    }
  }
  return { sets, values };
}

async function recomputeSettlement(settlementId: string): Promise<void> {
  const lines = await query<{ kind: string; amount: string | number }>(
    'SELECT kind, amount FROM exit_settlement_lines WHERE settlement_id = ?',
    [settlementId]
  );
  let earn = 0, ded = 0;
  for (const l of lines) {
    const amt = Number(l.amount) || 0;
    if (l.kind === 'EARNING') earn += amt; else ded += amt;
  }
  await query(
    'UPDATE exit_settlements SET gross_earnings = ?, total_deductions = ?, net_payable = ? WHERE id = ?',
    [earn.toFixed(2), ded.toFixed(2), (earn - ded).toFixed(2), settlementId]
  );
}

export function registerRelievingRoutes(app: Application) {
  const audit = (req: { user?: { id: string } }, action: string, id: string) =>
    writeAudit(req.user?.id ?? 'system', action, 'exit', id, null, null).catch(() => {});

  // ── List exit cases ───────────────────────────────────────────────────────
  app.get('/api/v1/exits', authRequired, async (req, res, next) => {
    try {
      const where: string[] = [];
      const params: unknown[] = [];
      if (typeof req.query.stage === 'string' && req.query.stage) { where.push('x.stage = ?'); params.push(req.query.stage); }
      if (typeof req.query.status === 'string' && req.query.status) { where.push('x.status = ?'); params.push(req.query.status); }
      if (typeof req.query.q === 'string' && req.query.q) {
        where.push("(CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.code LIKE ? OR x.code LIKE ?)");
        const like = `%${req.query.q}%`;
        params.push(like, like, like);
      }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

      const rows = await query(
        `SELECT x.id, x.code, x.exit_type, x.reason, x.stage, x.status,
                x.proposed_last_working_day, x.actual_last_working_day, x.notice_period_type,
                x.created_at, x.updated_at,
                e.id AS employee_id, e.code AS employee_code,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                e.designation, d.name AS department_name
         FROM exit_cases x
         JOIN employees e ON e.id = x.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         ${whereSql}
         ORDER BY x.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
      );
      const [cnt] = await query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM exit_cases x JOIN employees e ON e.id = x.employee_id ${whereSql}`,
        params
      );
      res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
    } catch (err) { next(err); }
  });

  // ── Create an exit case (Stage 1: Initiation) ─────────────────────────────
  app.post('/api/v1/exits', authRequired, requireRole('HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      if (!b.employeeId || !b.exitType) return res.status(400).json(VALIDATION('employeeId and exitType are required'));
      if (!['RESIGNATION', 'TERMINATION'].includes(b.exitType)) return res.status(400).json(VALIDATION('invalid exitType'));

      const emp = await query<{ id: string }>('SELECT id FROM employees WHERE id = ? LIMIT 1', [b.employeeId]);
      if (!emp.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });

      const open = await query<{ id: string }>(
        "SELECT id FROM exit_cases WHERE employee_id = ? AND status NOT IN ('COMPLETED','CANCELLED','REJECTED') LIMIT 1",
        [b.employeeId]
      );
      if (open.length) return res.status(409).json({ error: { code: 'CONFLICT', message: 'This employee already has an active exit case' } });

      const id = ulid();
      const code = await nextExitCode();
      await query(
        `INSERT INTO exit_cases
          (id, code, employee_id, exit_type, reason, reason_detail, initiated_by,
           proposed_last_working_day, notice_period_type, resignation_doc_url, stage, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INITIATION', 'DRAFT')`,
        [id, code, b.employeeId, b.exitType, b.reason || null, b.reasonDetail || null,
         req.user?.id ?? null, b.proposedLastWorkingDay || null, b.noticePeriodType || null,
         b.resignationDocUrl || null]
      );

      // Seed the stage checklists + singleton rows so the UI has structure immediately.
      for (const dept of DEFAULT_NDCS) {
        await query(
          "INSERT INTO exit_clearance_items (id, exit_case_id, kind, department, label) VALUES (?, ?, 'NDC', ?, ?)",
          [ulid(), id, dept, `${dept} No-Dues Certificate`]
        );
      }
      for (const sys of DEFAULT_ACCESS) {
        await query(
          'INSERT INTO exit_access_items (id, exit_case_id, system_name) VALUES (?, ?, ?)',
          [ulid(), id, sys]
        );
      }
      await query('INSERT INTO exit_interviews (id, exit_case_id) VALUES (?, ?)', [ulid(), id]);
      await query('INSERT INTO exit_settlements (id, exit_case_id) VALUES (?, ?)', [ulid(), id]);

      audit(req, 'create', id);
      res.status(201).json({ data: { id, code } });
    } catch (err) { next(err); }
  });

  // ── Full case detail (with all children) ──────────────────────────────────
  app.get('/api/v1/exits/:id', authRequired, async (req, res, next) => {
    try {
      const cases = await query(
        `SELECT x.*, e.code AS employee_code,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                e.designation, e.email AS employee_email, e.joining_date, e.status AS employee_status,
                d.name AS department_name, b.name AS branch_name
         FROM exit_cases x
         JOIN employees e ON e.id = x.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE x.id = ? LIMIT 1`,
        [req.params.id]
      );
      if (!cases.length) return res.status(404).json(NOT_FOUND);
      const exitCase = cases[0] as Record<string, unknown>;

      const [approvals, clearance, interviews, settlements, documents, access] = await Promise.all([
        query('SELECT * FROM exit_approvals WHERE exit_case_id = ? ORDER BY created_at DESC', [req.params.id]),
        query('SELECT * FROM exit_clearance_items WHERE exit_case_id = ? ORDER BY kind, created_at', [req.params.id]),
        query('SELECT * FROM exit_interviews WHERE exit_case_id = ? LIMIT 1', [req.params.id]),
        query('SELECT * FROM exit_settlements WHERE exit_case_id = ? LIMIT 1', [req.params.id]),
        query('SELECT * FROM exit_documents WHERE exit_case_id = ? ORDER BY created_at DESC', [req.params.id]),
        query('SELECT * FROM exit_access_items WHERE exit_case_id = ? ORDER BY created_at', [req.params.id]),
      ]);

      const settlement = (settlements as Record<string, unknown>[])[0] ?? null;
      let settlementLines: unknown[] = [];
      if (settlement) {
        settlementLines = await query(
          'SELECT * FROM exit_settlement_lines WHERE settlement_id = ? ORDER BY kind, sort_order, created_at',
          [settlement.id]
        );
      }

      res.json({
        data: {
          ...exitCase,
          approvals,
          clearance,
          interview: (interviews as Record<string, unknown>[])[0] ?? null,
          settlement: settlement ? { ...settlement, lines: settlementLines } : null,
          documents,
          access,
        },
      });
    } catch (err) { next(err); }
  });

  // ── Update initiation fields ──────────────────────────────────────────────
  app.patch('/api/v1/exits/:id', authRequired, requireRole('HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'exitType', column: 'exit_type' },
        { key: 'reason', column: 'reason' },
        { key: 'reasonDetail', column: 'reason_detail' },
        { key: 'proposedLastWorkingDay', column: 'proposed_last_working_day' },
        { key: 'actualLastWorkingDay', column: 'actual_last_working_day' },
        { key: 'noticePeriodType', column: 'notice_period_type' },
        { key: 'noticeStartDate', column: 'notice_start_date' },
        { key: 'noticeEndDate', column: 'notice_end_date' },
        { key: 'resignationDocUrl', column: 'resignation_doc_url' },
      ]);
      if (!sets.length) return res.status(400).json(VALIDATION('No valid fields'));
      values.push(req.params.id);
      await query(`UPDATE exit_cases SET ${sets.join(', ')} WHERE id = ?`, values);
      audit(req, 'update', req.params.id);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ── Submit for approval (Stage 1 → 2) ─────────────────────────────────────
  app.post('/api/v1/exits/:id/submit', authRequired, requireRole('HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const rows = await query<{ status: string }>('SELECT status FROM exit_cases WHERE id = ? LIMIT 1', [req.params.id]);
      if (!rows.length) return res.status(404).json(NOT_FOUND);
      if (rows[0].status !== 'DRAFT') return res.status(409).json({ error: { code: 'CONFLICT', message: 'Only draft cases can be submitted' } });
      await query("UPDATE exit_cases SET status = 'PENDING_APPROVAL', stage = 'APPROVAL' WHERE id = ?", [req.params.id]);
      await query(
        "INSERT INTO exit_approvals (id, exit_case_id, action, actor_id, actor_role, note) VALUES (?, ?, 'SUBMIT', ?, ?, ?)",
        [ulid(), req.params.id, req.user?.id ?? null, req.user?.role ?? null, 'Submitted for approval']
      );
      audit(req, 'update', req.params.id);
      res.json({ data: { id: req.params.id, status: 'PENDING_APPROVAL' } });
    } catch (err) { next(err); }
  });

  // ── Approval action (Stage 2) ─────────────────────────────────────────────
  app.post('/api/v1/exits/:id/approvals', authRequired, requireRole('HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const action = String(b.action || '').toUpperCase();
      const allowed = ['ACKNOWLEDGE', 'APPROVE', 'REJECT', 'NOTE', 'REMINDER'];
      if (!allowed.includes(action)) return res.status(400).json(VALIDATION(`action must be one of ${allowed.join(', ')}`));

      const rows = await query<{ status: string }>('SELECT status FROM exit_cases WHERE id = ? LIMIT 1', [req.params.id]);
      if (!rows.length) return res.status(404).json(NOT_FOUND);

      await query(
        'INSERT INTO exit_approvals (id, exit_case_id, action, actor_id, actor_role, note) VALUES (?, ?, ?, ?, ?, ?)',
        [ulid(), req.params.id, action, req.user?.id ?? null, req.user?.role ?? null, b.note || null]
      );

      // State transitions on the case itself.
      if (action === 'ACKNOWLEDGE' && req.user?.role === 'MANAGER') {
        await query('UPDATE exit_cases SET manager_approved_by = ?, manager_approved_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [req.user.id, req.params.id]);
      } else if (action === 'APPROVE') {
        await query(
          "UPDATE exit_cases SET status = 'APPROVED', stage = 'CLEARANCE', hr_approved_by = ?, hr_approved_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
          [req.user?.id ?? null, req.params.id]
        );
      } else if (action === 'REJECT') {
        await query("UPDATE exit_cases SET status = 'REJECTED' WHERE id = ?", [req.params.id]);
      }
      audit(req, action === 'REJECT' ? 'decide' : 'approve', req.params.id);
      res.status(201).json({ data: { id: req.params.id, action } });
    } catch (err) { next(err); }
  });

  // ── Advance stage manually (e.g. Clearance → Interview → Settlement → Access) ─
  app.post('/api/v1/exits/:id/advance', authRequired, requireRole('HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const stage = String(req.body?.stage || '');
      const stages = ['INITIATION', 'APPROVAL', 'CLEARANCE', 'INTERVIEW', 'SETTLEMENT', 'ACCESS_CLOSURE', 'COMPLETED'];
      if (!stages.includes(stage)) return res.status(400).json(VALIDATION('invalid stage'));
      await query("UPDATE exit_cases SET stage = ?, status = IF(status IN ('DRAFT','PENDING_APPROVAL','REJECTED'), status, 'IN_PROGRESS') WHERE id = ?", [stage, req.params.id]);
      audit(req, 'update', req.params.id);
      res.json({ data: { id: req.params.id, stage } });
    } catch (err) { next(err); }
  });

  // ── Clearance items (Stage 3) ─────────────────────────────────────────────
  app.post('/api/v1/exits/:id/clearance', authRequired, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const kind = String(b.kind || '').toUpperCase();
      if (!['NDC', 'ASSET', 'HANDOVER'].includes(kind)) return res.status(400).json(VALIDATION('kind must be NDC, ASSET or HANDOVER'));
      const id = ulid();
      await query(
        'INSERT INTO exit_clearance_items (id, exit_case_id, kind, department, asset_name, label, handover_person_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.params.id, kind, b.department || null, b.assetName || null, b.label || null, b.handoverPersonId || null, b.notes || null]
      );
      audit(req, 'create', req.params.id);
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/exits/clearance/:itemId', authRequired, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const { sets, values } = updateSets(b, [
        { key: 'department', column: 'department' },
        { key: 'assetName', column: 'asset_name' },
        { key: 'label', column: 'label' },
        { key: 'handoverPersonId', column: 'handover_person_id' },
        { key: 'status', column: 'status' },
        { key: 'notes', column: 'notes' },
        { key: 'docUrl', column: 'doc_url' },
      ]);
      if (!sets.length) return res.status(400).json(VALIDATION('No valid fields'));
      // Stamp cleared_by/at when moving to a terminal cleared state.
      if (b.status === 'CLEARED' || b.status === 'RETURNED') {
        sets.push('cleared_by = ?', 'cleared_at = CURRENT_TIMESTAMP(3)');
        values.push(req.user?.id ?? null);
      }
      values.push(req.params.itemId);
      await query(`UPDATE exit_clearance_items SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.itemId } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/exits/clearance/:itemId', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM exit_clearance_items WHERE id = ?', [req.params.itemId]);
      res.json({ data: { id: req.params.itemId } });
    } catch (err) { next(err); }
  });

  // ── Exit interview (Stage 4) ──────────────────────────────────────────────
  app.patch('/api/v1/exits/:id/interview', authRequired, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const body: Record<string, unknown> = { ...b };
      if (b.questionnaire !== undefined && typeof b.questionnaire !== 'string') {
        body.questionnaire = JSON.stringify(b.questionnaire);
      }
      const { sets, values } = updateSets(body, [
        { key: 'scheduledAt', column: 'scheduled_at' },
        { key: 'conductedAt', column: 'conducted_at' },
        { key: 'interviewerId', column: 'interviewer_id' },
        { key: 'questionnaire', column: 'questionnaire' },
        { key: 'hrNotes', column: 'hr_notes' },
        { key: 'grievanceFlag', column: 'grievance_flag' },
        { key: 'overallSentiment', column: 'overall_sentiment' },
        { key: 'status', column: 'status' },
      ]);
      if (!sets.length) return res.status(400).json(VALIDATION('No valid fields'));
      if (b.grievanceFlag !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('grievance_flag'));
        if (idx >= 0) values[idx] = b.grievanceFlag ? 1 : 0;
      }
      values.push(req.params.id);
      await query(`UPDATE exit_interviews SET ${sets.join(', ')} WHERE exit_case_id = ?`, values);
      audit(req, 'update', req.params.id);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ── Settlement (Stage 5) ──────────────────────────────────────────────────
  async function settlementIdFor(exitId: string): Promise<string | null> {
    const rows = await query<{ id: string }>('SELECT id FROM exit_settlements WHERE exit_case_id = ? LIMIT 1', [exitId]);
    return rows[0]?.id ?? null;
  }

  // Prefill standard lines once, using the employee CTC as a best-effort salary base.
  app.post('/api/v1/exits/:id/settlement/prefill', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const sid = await settlementIdFor(req.params.id);
      if (!sid) return res.status(404).json(NOT_FOUND);
      const existing = await query<{ n: number }>('SELECT COUNT(*) AS n FROM exit_settlement_lines WHERE settlement_id = ?', [sid]);
      if (Number(existing[0]?.n ?? 0) > 0) return res.status(409).json({ error: { code: 'CONFLICT', message: 'Settlement already has lines' } });

      const emp = await query<{ ctc: string | number | null }>(
        'SELECT e.ctc FROM exit_cases x JOIN employees e ON e.id = x.employee_id WHERE x.id = ? LIMIT 1', [req.params.id]
      );
      const monthly = emp.length && emp[0].ctc ? Math.round(Number(emp[0].ctc) / 12) : 0;

      const seed: Array<[string, string, number, string]> = [
        ['EARNING', 'Final Month Salary (pro-rata)', monthly, 'PAYROLL'],
        ['EARNING', 'Leave Encashment', 0, 'LEAVE_ENCASHMENT'],
        ['EARNING', 'Gratuity / Bonus', 0, 'MANUAL'],
        ['DEDUCTION', 'Notice Period Recovery', 0, 'NOTICE_RECOVERY'],
        ['DEDUCTION', 'Loan / Advance Recovery', 0, 'MANUAL'],
        ['DEDUCTION', 'Other Deductions', 0, 'MANUAL'],
      ];
      let order = 0;
      for (const [kind, label, amount, source] of seed) {
        await query(
          'INSERT INTO exit_settlement_lines (id, settlement_id, kind, label, amount, source, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [ulid(), sid, kind, label, amount, source, order++]
        );
      }
      await recomputeSettlement(sid);
      audit(req, 'update', req.params.id);
      res.status(201).json({ data: { settlementId: sid } });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/exits/:id/settlement/lines', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const kind = String(b.kind || '').toUpperCase();
      if (!['EARNING', 'DEDUCTION'].includes(kind)) return res.status(400).json(VALIDATION('kind must be EARNING or DEDUCTION'));
      if (!b.label) return res.status(400).json(VALIDATION('label required'));
      const sid = await settlementIdFor(req.params.id);
      if (!sid) return res.status(404).json(NOT_FOUND);
      const id = ulid();
      await query(
        'INSERT INTO exit_settlement_lines (id, settlement_id, kind, label, amount, source) VALUES (?, ?, ?, ?, ?, ?)',
        [id, sid, kind, b.label, Number(b.amount) || 0, b.source || 'MANUAL']
      );
      await recomputeSettlement(sid);
      audit(req, 'update', req.params.id);
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/exits/settlement/lines/:lineId', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const { sets, values } = updateSets(b, [
        { key: 'label', column: 'label' },
        { key: 'amount', column: 'amount' },
        { key: 'kind', column: 'kind' },
      ]);
      if (!sets.length) return res.status(400).json(VALIDATION('No valid fields'));
      values.push(req.params.lineId);
      await query(`UPDATE exit_settlement_lines SET ${sets.join(', ')} WHERE id = ?`, values);
      const row = await query<{ settlement_id: string }>('SELECT settlement_id FROM exit_settlement_lines WHERE id = ? LIMIT 1', [req.params.lineId]);
      if (row.length) await recomputeSettlement(row[0].settlement_id);
      res.json({ data: { id: req.params.lineId } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/exits/settlement/lines/:lineId', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const row = await query<{ settlement_id: string }>('SELECT settlement_id FROM exit_settlement_lines WHERE id = ? LIMIT 1', [req.params.lineId]);
      await query('DELETE FROM exit_settlement_lines WHERE id = ?', [req.params.lineId]);
      if (row.length) await recomputeSettlement(row[0].settlement_id);
      res.json({ data: { id: req.params.lineId } });
    } catch (err) { next(err); }
  });

  // Finance/HR approve the settlement.
  app.post('/api/v1/exits/:id/settlement/approve', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const sid = await settlementIdFor(req.params.id);
      if (!sid) return res.status(404).json(NOT_FOUND);
      await query(
        "UPDATE exit_settlements SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP(3), finance_note = ? WHERE id = ?",
        [req.user?.id ?? null, req.body?.note || null, sid]
      );
      audit(req, 'approve', req.params.id);
      res.json({ data: { settlementId: sid, status: 'APPROVED' } });
    } catch (err) { next(err); }
  });

  // ── Documents (Stage 5) — record a generated/uploaded document ────────────
  app.post('/api/v1/exits/:id/documents', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const type = String(b.docType || '').toUpperCase();
      const types = ['SETTLEMENT_SHEET', 'RELIEVING_LETTER', 'EXPERIENCE_CERTIFICATE', 'REFERENCE_LETTER', 'OTHER'];
      if (!types.includes(type)) return res.status(400).json(VALIDATION(`docType must be one of ${types.join(', ')}`));
      const id = ulid();
      await query(
        'INSERT INTO exit_documents (id, exit_case_id, doc_type, title, url, generated_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, req.params.id, type, b.title || null, b.url || null, req.user?.id ?? null]
      );
      audit(req, 'create', req.params.id);
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  // Generate a document PDF from the configured template + org profile, upload
  // it to Cloudinary and record it against the case.
  app.post('/api/v1/exits/:id/documents/generate', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      const docType = String(req.body?.docType || '').toUpperCase();
      if (!DOC_GEN_TYPES.includes(docType)) return res.status(400).json(VALIDATION(`docType must be one of ${DOC_GEN_TYPES.join(', ')}`));

      const template = await loadTemplate(docType);
      if (!template) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      const org = await loadOrgProfile();

      const rows = await query<Record<string, unknown>>(
        `SELECT x.exit_type, x.reason, x.proposed_last_working_day, x.actual_last_working_day,
                e.code AS employee_code, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                e.designation, e.joining_date, d.name AS department_name, b.name AS branch_name
         FROM exit_cases x
         JOIN employees e ON e.id = x.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE x.id = ? LIMIT 1`, [req.params.id]
      );
      if (!rows.length) return res.status(404).json(NOT_FOUND);
      const c = rows[0];

      const ctx: DocContext = {
        employee_name: String(c.employee_name ?? ''),
        employee_code: String(c.employee_code ?? ''),
        designation: String(c.designation ?? ''),
        department: String(c.department_name ?? ''),
        branch: String(c.branch_name ?? ''),
        joining_date: fmtDate(c.joining_date),
        last_working_day: fmtDate(c.actual_last_working_day ?? c.proposed_last_working_day),
        exit_type: c.exit_type === 'TERMINATION' ? 'Termination' : 'Resignation',
        reason: String(c.reason ?? ''),
        company_name: org.companyName || '',
        company_address: [org.addressLine, org.city].filter(Boolean).join(', '),
        today: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      };

      let settlement: SettlementData | undefined;
      if (docType === 'SETTLEMENT_SHEET') {
        const sRows = await query<{ id: string; gross_earnings: string; total_deductions: string; net_payable: string }>(
          'SELECT id, gross_earnings, total_deductions, net_payable FROM exit_settlements WHERE exit_case_id = ? LIMIT 1', [req.params.id]
        );
        const s = sRows[0];
        const lines = s ? await query<{ kind: string; label: string; amount: string }>(
          'SELECT kind, label, amount FROM exit_settlement_lines WHERE settlement_id = ? ORDER BY kind, sort_order', [s.id]
        ) : [];
        settlement = {
          earnings: lines.filter((l) => l.kind === 'EARNING').map((l) => ({ label: l.label, amount: Number(l.amount) })),
          deductions: lines.filter((l) => l.kind === 'DEDUCTION').map((l) => ({ label: l.label, amount: Number(l.amount) })),
          gross: Number(s?.gross_earnings ?? 0),
          deductionsTotal: Number(s?.total_deductions ?? 0),
          net: Number(s?.net_payable ?? 0),
        };
        ctx.gross_earnings = `Rs. ${settlement.gross.toLocaleString('en-IN')}`;
        ctx.total_deductions = `Rs. ${settlement.deductionsTotal.toLocaleString('en-IN')}`;
        ctx.net_payable = `Rs. ${settlement.net.toLocaleString('en-IN')}`;
      }

      const pdfBytes = await generateDocumentPdf({ template, org, ctx, settlement });
      const uploaded = await uploadToCloudinary(Buffer.from(pdfBytes), 'raw');

      const id = ulid();
      await query(
        'INSERT INTO exit_documents (id, exit_case_id, doc_type, title, url, generated_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, req.params.id, docType, template.title, uploaded.url, req.user?.id ?? null]
      );
      audit(req, 'create', req.params.id);
      res.status(201).json({ data: { id, url: uploaded.url } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/exits/documents/:docId', authRequired, requireRole('HR_ADMIN', 'FINANCE'), async (req, res, next) => {
    try {
      await query('DELETE FROM exit_documents WHERE id = ?', [req.params.docId]);
      res.json({ data: { id: req.params.docId } });
    } catch (err) { next(err); }
  });

  // ── Access-closure items (Stage 6) ────────────────────────────────────────
  app.post('/api/v1/exits/:id/access', authRequired, async (req, res, next) => {
    try {
      if (!req.body?.systemName) return res.status(400).json(VALIDATION('systemName required'));
      const id = ulid();
      await query('INSERT INTO exit_access_items (id, exit_case_id, system_name, notes) VALUES (?, ?, ?, ?)', [id, req.params.id, req.body.systemName, req.body.notes || null]);
      audit(req, 'create', req.params.id);
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/exits/access/:itemId', authRequired, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const { sets, values } = updateSets(b, [
        { key: 'systemName', column: 'system_name' },
        { key: 'status', column: 'status' },
        { key: 'notes', column: 'notes' },
      ]);
      if (!sets.length) return res.status(400).json(VALIDATION('No valid fields'));
      if (b.status === 'REVOKED') {
        sets.push('revoked_by = ?', 'revoked_at = CURRENT_TIMESTAMP(3)');
        values.push(req.user?.id ?? null);
      }
      values.push(req.params.itemId);
      await query(`UPDATE exit_access_items SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.itemId } });
    } catch (err) { next(err); }
  });

  // ── Complete the exit — mark employee EXITED (Stage 6 → Completed) ─────────
  app.post('/api/v1/exits/:id/complete', authRequired, requireRole('HR_ADMIN'), async (req, res, next) => {
    try {
      const rows = await query<{ employee_id: string; actual_last_working_day: string | null; proposed_last_working_day: string | null }>(
        'SELECT employee_id, actual_last_working_day, proposed_last_working_day FROM exit_cases WHERE id = ? LIMIT 1',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json(NOT_FOUND);
      const lwd = rows[0].actual_last_working_day ?? rows[0].proposed_last_working_day;
      await query("UPDATE exit_cases SET stage = 'COMPLETED', status = 'COMPLETED' WHERE id = ?", [req.params.id]);
      await query("UPDATE employees SET status = 'EXITED', exit_date = ? WHERE id = ?", [lwd, rows[0].employee_id]);
      audit(req, 'exit', req.params.id);
      res.json({ data: { id: req.params.id, status: 'COMPLETED' } });
    } catch (err) { next(err); }
  });
}
