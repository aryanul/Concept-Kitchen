import bcrypt from 'bcryptjs';
import type { Application } from 'express';
import { ulid } from 'ulid';
import { authRequired, type Role } from './auth';
import { query } from './db';
import { writeAudit } from './audit';

function parseBool(value: unknown): number {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

async function nextCode(table: string, column: string, prefix: string, digits = 3): Promise<string> {
  // CAST AS UNSIGNED returns a string from the mysql2 driver — explicit Number()
  // coerce, or `(string) + 1` becomes string concatenation (e.g. "73"+1 = "731").
  const rows = await query<{ n: number | string | null }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${column}, ?) AS UNSIGNED)), 0) AS n
     FROM ${table}
     WHERE ${column} LIKE ?`,
    [prefix.length + 1, `${prefix}%`]
  );
  return `${prefix}${String(Number(rows[0]?.n ?? 0) + 1).padStart(digits, '0')}`;
}

function updateSets(body: Record<string, unknown>, allowed: Array<{ key: string; column: string }>) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (body[field.key] !== undefined) {
      sets.push(`${field.column} = ?`);
      values.push(body[field.key]);
    }
  }
  return { sets, values };
}

// Top-level segments owned exclusively by masters routes (not in index.ts domain routes)
const MASTER_SEGMENTS = new Set([
  'atm-tasks', 'attendance-rules', 'branches', 'departments', 'designations',
  'divisions', 'holidays', 'induction-templates', 'locations', 'lookups',
  'onboarding-templates', 'salary-grades', 'shifts', 'skills', 'tags',
  'training-modules', 'users',
]);

export function registerMasterRoutes(app: Application) {
  // Auto-audit every successful mutation across all ~84 master routes.
  // We intercept res.json to capture the new ID (for POST), then write
  // the audit entry on 'finish' so it never blocks the response.
  app.use('/api/v1', (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();

    // req.path has the '/api/v1' prefix stripped by Express
    const parts = req.path.split('/').filter(Boolean);
    const first = parts[0] ?? '';

    const isMasterRoute =
      MASTER_SEGMENTS.has(first) || first === 'hiring' || first === 'onboarding';
    if (!isMasterRoute) return next();

    // For nested paths like /hiring/companies or /onboarding/giveaways,
    // combine first two segments as the resource name; otherwise use first.
    const resource =
      first === 'hiring' || first === 'onboarding'
        ? `${first}/${parts[1] ?? ''}`
        : first;

    // URL-level resource ID (present on PATCH/PUT/DELETE)
    const urlId = first === 'hiring' || first === 'onboarding' ? parts[2] : parts[1];

    // Intercept res.json so we can capture the ID returned by POST handlers
    let capturedId: string | undefined;
    const origJson = res.json.bind(res);
    (res as unknown as { json: typeof res.json }).json = function (body: unknown) {
      capturedId = (body as Record<string, Record<string, string>>)?.data?.id;
      return origJson(body);
    };

    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user?.id) return;
      const resourceId = capturedId ?? urlId ?? ulid();
      const action =
        req.method === 'POST'   ? 'create' :
        req.method === 'DELETE' ? 'delete' : 'update';
      writeAudit(req.user.id, action, resource, resourceId, null, null).catch(() => {});
    });

    next();
  });

  // Branches
  app.post('/api/v1/branches', authRequired, async (req, res, next) => {
    try {
      const { name, city, kind, code, companyId } = req.body ?? {};
      if (!name || !city || !kind) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'name, city and kind required' } });
      }
      const id = ulid();
      const branchCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('branches', 'code', 'BR');
      await query(
        'INSERT INTO branches (id, code, name, city, kind, company_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, branchCode, name, city, kind, companyId || null]
      );
      res.status(201).json({ data: { id, code: branchCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/branches/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'city', column: 'city' },
        { key: 'kind', column: 'kind' },
        { key: 'companyId', column: 'company_id' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE branches SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/branches/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM branches WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Departments
  app.post('/api/v1/departments', authRequired, async (req, res, next) => {
    try {
      const { name } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      await query('INSERT INTO departments (id, name) VALUES (?, ?)', [id, name]);
      res.status(201).json({ data: { id } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/departments/:id', authRequired, async (req, res, next) => {
    try {
      const { name } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      await query('UPDATE departments SET name = ? WHERE id = ?', [name, req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/departments/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM departments WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Shifts
  type BreakInput = {
    name?: string;
    startOffsetMin?: number | string;
    durationMin?: number | string;
    isPaid?: unknown;
    isMandatory?: unknown;
  };

  async function replaceShiftBreaks(shiftId: string, breaks: BreakInput[]): Promise<void> {
    await query('DELETE FROM shift_breaks WHERE shift_id = ?', [shiftId]);
    let order = 0;
    for (const br of breaks) {
      const breakName = String(br?.name ?? '').trim();
      if (!breakName) continue;
      await query(
        `INSERT INTO shift_breaks (id, shift_id, name, start_offset_min, duration_min, is_paid, is_mandatory, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ulid(),
          shiftId,
          breakName,
          Number(br?.startOffsetMin) || 0,
          Number(br?.durationMin) || 0,
          parseBool(br?.isPaid),
          parseBool(br?.isMandatory),
          order++,
        ]
      );
    }
  }

  app.post('/api/v1/shifts', authRequired, async (req, res, next) => {
    try {
      const {
        code, name, description,
        company, branchId, location, status,
        startTime, endTime, totalHours,
        kind, breakMin,
        graceArrivalMin, graceExitMin,
        otAfterMin, otMultiplier,
        breaks,
      } = req.body ?? {};
      if (!name || !startTime || !endTime || !kind) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'name, startTime, endTime and kind required' } });
      }
      const id = ulid();
      const shiftCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('shifts', 'code', 'SH');
      const normalizedStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await query(
        `INSERT INTO shifts (
            id, code, name, description, company, branch_id, location, status,
            start_time, end_time, total_hours, kind, break_min,
            grace_arrival_min, grace_exit_min, ot_after_min, ot_multiplier
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, shiftCode, name, description || null,
          company || null, branchId || null, location || null, normalizedStatus,
          startTime, endTime, Number(totalHours) || 8,
          kind, Number(breakMin) || 0,
          Number(graceArrivalMin) || 0, Number(graceExitMin) || 0,
          Number(otAfterMin) || 0, Number(otMultiplier) || 1,
        ]
      );
      if (Array.isArray(breaks)) await replaceShiftBreaks(id, breaks as BreakInput[]);
      res.status(201).json({ data: { id, code: shiftCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/shifts/:id', authRequired, async (req, res, next) => {
    try {
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      if (body.branchId === '') body.branchId = null;
      if (body.company === '') body.company = null;
      if (body.location === '') body.location = null;
      if (body.description === '') body.description = null;
      const { sets, values } = updateSets(body, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'company', column: 'company' },
        { key: 'branchId', column: 'branch_id' },
        { key: 'location', column: 'location' },
        { key: 'status', column: 'status' },
        { key: 'startTime', column: 'start_time' },
        { key: 'endTime', column: 'end_time' },
        { key: 'totalHours', column: 'total_hours' },
        { key: 'kind', column: 'kind' },
        { key: 'breakMin', column: 'break_min' },
        { key: 'graceArrivalMin', column: 'grace_arrival_min' },
        { key: 'graceExitMin', column: 'grace_exit_min' },
        { key: 'otAfterMin', column: 'ot_after_min' },
        { key: 'otMultiplier', column: 'ot_multiplier' },
      ]);
      if (sets.length) {
        values.push(req.params.id);
        await query(`UPDATE shifts SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      if (Array.isArray(body.breaks)) {
        await replaceShiftBreaks(req.params.id, body.breaks as BreakInput[]);
      }
      if (!sets.length && !Array.isArray(body.breaks)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      }
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/shifts/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM shifts WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Salary grades
  app.post('/api/v1/salary-grades', authRequired, async (req, res, next) => {
    try {
      const { code, kind, minGross, maxGross } = req.body ?? {};
      if (!kind || minGross === undefined || maxGross === undefined) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'kind, minGross and maxGross required' } });
      }
      const id = ulid();
      const gradeCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('salary_grades', 'code', 'SG');
      await query('INSERT INTO salary_grades (id, code, kind, min_gross, max_gross) VALUES (?, ?, ?, ?, ?)', [
        id,
        gradeCode,
        kind,
        Math.round(Number(minGross) * 100),
        Math.round(Number(maxGross) * 100),
      ]);
      res.status(201).json({ data: { id, code: gradeCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/salary-grades/:id', authRequired, async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const sets: string[] = [];
      const values: unknown[] = [];
      if (payload.code !== undefined) { sets.push('code = ?'); values.push(payload.code); }
      if (payload.kind !== undefined) { sets.push('kind = ?'); values.push(payload.kind); }
      if (payload.minGross !== undefined) { sets.push('min_gross = ?'); values.push(Math.round(Number(payload.minGross) * 100)); }
      if (payload.maxGross !== undefined) { sets.push('max_gross = ?'); values.push(Math.round(Number(payload.maxGross) * 100)); }
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE salary_grades SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/salary-grades/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM salary_grades WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // DDD masters
  app.get('/api/v1/divisions', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT d.*, dept.name AS department_name
         FROM divisions d
         LEFT JOIN departments dept ON dept.id = d.department_id
         ORDER BY d.name`
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/divisions', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, departmentId, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const divisionCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('divisions', 'code', 'DIV');
      await query('INSERT INTO divisions (id, code, name, description, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?)', [
        id,
        divisionCode,
        name,
        description || null,
        departmentId || null,
        parseBool(isActive),
      ]);
      res.status(201).json({ data: { id, code: divisionCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/divisions/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'departmentId', column: 'department_id' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) values[values.length - 1] = parseBool(req.body.isActive);
      values.push(req.params.id);
      await query(`UPDATE divisions SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/divisions/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM divisions WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/locations', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT l.*, b.name AS branch_name
         FROM locations l
         LEFT JOIN branches b ON b.id = l.branch_id
         ORDER BY l.name`
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/locations', authRequired, async (req, res, next) => {
    try {
      const { code, name, city, state, branchId, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const locationCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('locations', 'code', 'LOC');
      await query('INSERT INTO locations (id, code, name, city, state, branch_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        id,
        locationCode,
        name,
        city || null,
        state || null,
        branchId || null,
        parseBool(isActive),
      ]);
      res.status(201).json({ data: { id, code: locationCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/locations/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'city', column: 'city' },
        { key: 'state', column: 'state' },
        { key: 'branchId', column: 'branch_id' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) values[values.length - 1] = parseBool(req.body.isActive);
      values.push(req.params.id);
      await query(`UPDATE locations SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/locations/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM locations WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/designations', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT d.*, dept.name AS department_name, divs.name AS division_name, parent.name AS parent_designation_name
         FROM designations d
         LEFT JOIN departments dept ON dept.id = d.department_id
         LEFT JOIN divisions divs ON divs.id = d.division_id
         LEFT JOIN designations parent ON parent.id = d.parent_designation_id
         ORDER BY d.name`
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/designations', authRequired, async (req, res, next) => {
    try {
      const { code, name, departmentId, divisionId, parentDesignationId, hierarchyLevel, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const designationCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('designations', 'code', 'DES');
      await query(
        `INSERT INTO designations (id, code, name, department_id, division_id, parent_designation_id, hierarchy_level, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          designationCode,
          name,
          departmentId || null,
          divisionId || null,
          parentDesignationId || null,
          Number(hierarchyLevel) || 0,
          parseBool(isActive),
        ]
      );
      res.status(201).json({ data: { id, code: designationCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/designations/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'departmentId', column: 'department_id' },
        { key: 'divisionId', column: 'division_id' },
        { key: 'parentDesignationId', column: 'parent_designation_id' },
        { key: 'hierarchyLevel', column: 'hierarchy_level' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) values[values.length - 1] = parseBool(req.body.isActive);
      values.push(req.params.id);
      await query(`UPDATE designations SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/designations/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM designations WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/skills', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM skills ORDER BY name');
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/skills', authRequired, async (req, res, next) => {
    try {
      const { code, name, category, description, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const skillCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('skills', 'code', 'SK');
      await query('INSERT INTO skills (id, code, name, category, description, is_active) VALUES (?, ?, ?, ?, ?, ?)', [
        id,
        skillCode,
        name,
        category || null,
        description || null,
        parseBool(isActive),
      ]);
      res.status(201).json({ data: { id, code: skillCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/skills/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'category', column: 'category' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) values[values.length - 1] = parseBool(req.body.isActive);
      values.push(req.params.id);
      await query(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/skills/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM skills WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Training Modules
  app.get('/api/v1/training-modules', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM training_modules ORDER BY name');
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/training-modules', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, coverImageUrl, chapterCount, durationHours, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const tmCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('training_modules', 'code', 'TM');
      await query(
        `INSERT INTO training_modules (id, code, name, description, cover_image_url, chapter_count, duration_hours, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tmCode, name, description || null, coverImageUrl || null,
         Math.max(0, Number(chapterCount) || 0),
         durationHours != null && durationHours !== '' ? Number(durationHours) : null,
         parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id, code: tmCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/training-modules/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'coverImageUrl', column: 'cover_image_url' },
        { key: 'chapterCount', column: 'chapter_count' },
        { key: 'durationHours', column: 'duration_hours' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE training_modules SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/training-modules/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM training_modules WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // ATM Task Catalogue (Auto Task Mapping)
  app.get('/api/v1/atm-tasks', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM atm_task_catalogue ORDER BY category, sort_order, task');
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/atm-tasks', authRequired, async (req, res, next) => {
    try {
      const { code, task, description, category, sortOrder, isActive } = req.body ?? {};
      if (!task) return res.status(400).json({ error: { code: 'VALIDATION', message: 'task required' } });
      const id = ulid();
      const taskCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('atm_task_catalogue', 'code', 'ATM');
      await query(
        `INSERT INTO atm_task_catalogue (id, code, task, description, category, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, taskCode, task, description || null, category || null,
         Number(sortOrder) || 0, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id, code: taskCode } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/atm-tasks/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'task', column: 'task' },
        { key: 'description', column: 'description' },
        { key: 'category', column: 'category' },
        { key: 'sortOrder', column: 'sort_order' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE atm_task_catalogue SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/atm-tasks/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM atm_task_catalogue WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Holidays delete
  app.delete('/api/v1/holidays/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM holiday_branches WHERE holiday_id = ?', [req.params.id]);
      await query('DELETE FROM holidays WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Hiring companies
  app.patch('/api/v1/hiring/companies/:id', authRequired, async (req, res, next) => {
    try {
      const { lcNo, name, branch, city, location } = req.body ?? {};
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'lcNo', column: 'lc_no' },
        { key: 'name', column: 'name' },
        { key: 'branch', column: 'branch' },
        { key: 'city', column: 'city' },
        { key: 'location', column: 'location' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE hiring_companies SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/hiring/companies/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM hiring_companies WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Interview templates (extended with fields_json for scorecard schema)
  app.patch('/api/v1/hiring/interview-templates/:id', authRequired, async (req, res, next) => {
    try {
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      if (body.fieldsJson !== undefined && body.fieldsJson !== null && typeof body.fieldsJson !== 'string') {
        body.fieldsJson = JSON.stringify(body.fieldsJson);
      }
      const { sets, values } = updateSets(body, [
        { key: 'title', column: 'title' },
        { key: 'description', column: 'description' },
        { key: 'fieldsJson', column: 'fields_json' },
        { key: 'imageUrl', column: 'image_url' },
        { key: 'isDefault', column: 'is_default' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (body.isDefault !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_default'));
        if (idx >= 0) values[idx] = parseBool(body.isDefault);
      }
      values.push(req.params.id);
      await query(`UPDATE interview_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/hiring/interview-templates/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM interview_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Giveaway templates
  app.patch('/api/v1/onboarding/giveaways/:id', authRequired, async (req, res, next) => {
    try {
      const { name, isDefault } = req.body ?? {};
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'name', column: 'name' },
        { key: 'isDefault', column: 'is_default' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isDefault !== undefined) values[values.length - 1] = parseBool(req.body.isDefault);
      values.push(req.params.id);
      await query(`UPDATE onboarding_giveaway_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/onboarding/giveaways/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM onboarding_giveaway_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // Users console
  app.get('/api/v1/users', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT u.id, u.email, u.role, u.employee_id, u.created_at, u.updated_at,
                e.code AS employee_code, e.first_name, e.last_name
         FROM users u
         LEFT JOIN employees e ON e.id = u.employee_id
         ORDER BY u.created_at DESC`
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/users', authRequired, async (req, res, next) => {
    try {
      const { email, password, role, employeeId } = req.body ?? {};
      if (!email || !password || !role) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'email, password and role required' } });
      }
      const id = ulid();
      const hash = await bcrypt.hash(password, 10);
      await query('INSERT INTO users (id, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)', [
        id,
        email,
        hash,
        role as Role,
        employeeId || null,
      ]);
      res.status(201).json({ data: { id } });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/v1/users/:id', authRequired, async (req, res, next) => {
    try {
      const { email, password, role, employeeId } = req.body ?? {};
      const sets: string[] = [];
      const values: unknown[] = [];
      if (email !== undefined) { sets.push('email = ?'); values.push(email); }
      if (role !== undefined) { sets.push('role = ?'); values.push(role as Role); }
      if (employeeId !== undefined) { sets.push('employee_id = ?'); values.push(employeeId || null); }
      if (password) {
        const hash = await bcrypt.hash(password, 10);
        sets.push('password_hash = ?');
        values.push(hash);
      }
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/v1/users/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM users WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      next(err);
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Lookup categories + lookups (generic enum master used by Vacancy/Listing
  // module — listing_status, hiring_status, applicant_source, etc.)
  // ────────────────────────────────────────────────────────────────────────

  // List categories (with their values inlined for one-shot client fetches).
  app.get('/api/v1/lookup-categories', authRequired, async (req, res, next) => {
    try {
      const cats = await query(
        'SELECT id, code, name, description, is_system FROM lookup_categories ORDER BY name'
      );
      const includeValues = String(req.query.includeValues ?? '') === '1';
      if (!includeValues) return res.json({ data: cats });
      const values = await query<{
        id: string; category_id: string; code: string; label: string;
        color: string | null; sort_order: number | string; is_default: number | string; is_active: number | string;
      }>(
        'SELECT id, category_id, code, label, color, sort_order, is_default, is_active FROM lookups ORDER BY category_id, sort_order, label'
      );
      const byCat = new Map<string, typeof values>();
      for (const v of values) {
        const list = byCat.get(v.category_id) ?? [];
        list.push(v);
        byCat.set(v.category_id, list);
      }
      const data = (cats as Array<Record<string, unknown>>).map((c) => ({
        ...c, values: byCat.get(c.id as string) ?? [],
      }));
      res.json({ data });
    } catch (err) { next(err); }
  });

  // Look up values for a single category (by code OR id).
  // GET /lookups?category=listing_status  -> values for listing_status
  app.get('/api/v1/lookups', authRequired, async (req, res, next) => {
    try {
      const cat = typeof req.query.category === 'string' ? req.query.category : '';
      const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
      const params: unknown[] = [];
      let where = '';
      if (categoryId) { where = 'WHERE c.id = ?'; params.push(categoryId); }
      else if (cat)   { where = 'WHERE c.code = ?'; params.push(cat); }
      const rows = await query(
        `SELECT l.id, l.category_id, c.code AS category_code, l.code, l.label, l.color,
                l.sort_order, l.is_default, l.is_active
         FROM lookups l
         JOIN lookup_categories c ON c.id = l.category_id
         ${where}
         ORDER BY c.code, l.sort_order, l.label`,
        params
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/lookups', authRequired, async (req, res, next) => {
    try {
      const { categoryId, categoryCode, code, label, color, sortOrder, isDefault, isActive } = req.body ?? {};
      if (!code || !label) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'code and label required' } });
      }
      let resolvedCatId = typeof categoryId === 'string' ? categoryId : '';
      if (!resolvedCatId && typeof categoryCode === 'string' && categoryCode) {
        const r = await query<{ id: string }>('SELECT id FROM lookup_categories WHERE code = ? LIMIT 1', [categoryCode]);
        if (!r.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'category not found' } });
        resolvedCatId = r[0].id;
      }
      if (!resolvedCatId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'categoryId or categoryCode required' } });
      const id = ulid();
      await query(
        'INSERT INTO lookups (id, category_id, code, label, color, sort_order, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, resolvedCatId, code, label, color || null, Number(sortOrder) || 0, parseBool(isDefault), parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/lookups/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'label', column: 'label' },
        { key: 'color', column: 'color' },
        { key: 'sortOrder', column: 'sort_order' },
        { key: 'isDefault', column: 'is_default' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isDefault !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_default'));
        if (idx >= 0) values[idx] = parseBool(req.body.isDefault);
      }
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE lookups SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/lookups/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM lookups WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tags master (applicant tagging)
  // ────────────────────────────────────────────────────────────────────────
  app.get('/api/v1/tags', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM tags ORDER BY name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/tags', authRequired, async (req, res, next) => {
    try {
      const { name, color, description, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      await query(
        'INSERT INTO tags (id, name, color, description, is_active) VALUES (?, ?, ?, ?, ?)',
        [id, name, color || null, description || null, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/tags/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'name', column: 'name' },
        { key: 'color', column: 'color' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/tags/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM tags WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Onboarding masters (Phase 0 of Induction & Onboarding rebuild)
  // ────────────────────────────────────────────────────────────────────────

  // Phone number pool
  app.get('/api/v1/onboarding/phone-pool', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT p.*, CONCAT_WS(' ', e.first_name, e.last_name) AS assigned_employee_name
         FROM phone_number_pool p
         LEFT JOIN employees e ON e.id = p.assigned_employee_id
         ORDER BY p.number`
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/phone-pool', authRequired, async (req, res, next) => {
    try {
      const { number, carrier, status, notes } = req.body ?? {};
      if (!number) return res.status(400).json({ error: { code: 'VALIDATION', message: 'number required' } });
      const id = ulid();
      await query(
        'INSERT INTO phone_number_pool (id, number, carrier, status, notes) VALUES (?, ?, ?, ?, ?)',
        [id, number, carrier || null, status || 'available', notes || null]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/phone-pool/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'number', column: 'number' },
        { key: 'carrier', column: 'carrier' },
        { key: 'status', column: 'status' },
        { key: 'assignedEmployeeId', column: 'assigned_employee_id' },
        { key: 'notes', column: 'notes' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE phone_number_pool SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/phone-pool/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM phone_number_pool WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ERP modules
  app.get('/api/v1/onboarding/erp-modules', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM erp_modules ORDER BY sort_order, name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/erp-modules', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, icon, sortOrder, isActive } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'code and name required' } });
      const id = ulid();
      await query(
        'INSERT INTO erp_modules (id, code, name, description, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, code, name, description || null, icon || null, Number(sortOrder) || 0, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/erp-modules/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'icon', column: 'icon' },
        { key: 'sortOrder', column: 'sort_order' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE erp_modules SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/erp-modules/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM erp_modules WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Designation ↔ ERP module defaults (used to pre-populate ERP grid)
  app.get('/api/v1/designations/:id/erp-modules', authRequired, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT m.id, m.code, m.name, m.description, m.icon, dem.default_status
         FROM designation_erp_modules dem
         JOIN erp_modules m ON m.id = dem.erp_module_id
         WHERE dem.designation_id = ? ORDER BY m.sort_order, m.name`,
        [req.params.id]
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.put('/api/v1/designations/:id/erp-modules', authRequired, async (req, res, next) => {
    try {
      const items = Array.isArray(req.body?.modules) ? req.body.modules as Array<{ erpModuleId: string; defaultStatus?: string }> : [];
      await query('DELETE FROM designation_erp_modules WHERE designation_id = ?', [req.params.id]);
      for (const m of items) {
        if (!m?.erpModuleId) continue;
        await query(
          'INSERT INTO designation_erp_modules (designation_id, erp_module_id, default_status) VALUES (?, ?, ?)',
          [req.params.id, m.erpModuleId, m.defaultStatus || 'active']
        );
      }
      res.json({ data: { id: req.params.id, count: items.length } });
    } catch (err) { next(err); }
  });

  // Asset categories
  app.get('/api/v1/onboarding/asset-categories', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM asset_categories ORDER BY name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/asset-categories', authRequired, async (req, res, next) => {
    try {
      const { name, description, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      await query(
        'INSERT INTO asset_categories (id, name, description, is_active) VALUES (?, ?, ?, ?)',
        [id, name, description || null, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/asset-categories/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE asset_categories SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/asset-categories/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM asset_categories WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Assets
  app.get('/api/v1/onboarding/assets', authRequired, async (req, res, next) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : '';
      const where = status ? 'WHERE a.status = ?' : '';
      const params = status ? [status] : [];
      const rows = await query(
        `SELECT a.*, c.name AS category_name,
                CONCAT_WS(' ', e.first_name, e.last_name) AS current_employee_name
         FROM assets a
         LEFT JOIN asset_categories c ON c.id = a.category_id
         LEFT JOIN employees e ON e.id = a.current_employee_id
         ${where} ORDER BY a.asset_tag`,
        params
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/assets', authRequired, async (req, res, next) => {
    try {
      const { assetTag, name, categoryId, subCategory, serialNo, description, status, purchaseDate, purchaseCost, thumbnailUrl } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const tag = typeof assetTag === 'string' && assetTag.trim() ? assetTag.trim() : await nextCode('assets', 'asset_tag', 'AST');
      const id = ulid();
      await query(
        `INSERT INTO assets (id, asset_tag, name, category_id, sub_category, serial_no, description, status, purchase_date, purchase_cost, thumbnail_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tag, name, categoryId || null, subCategory || null, serialNo || null, description || null,
         status || 'available', purchaseDate || null, purchaseCost != null && purchaseCost !== '' ? Number(purchaseCost) : null, thumbnailUrl || null]
      );
      res.status(201).json({ data: { id, asset_tag: tag } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/assets/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'assetTag', column: 'asset_tag' },
        { key: 'name', column: 'name' },
        { key: 'categoryId', column: 'category_id' },
        { key: 'subCategory', column: 'sub_category' },
        { key: 'serialNo', column: 'serial_no' },
        { key: 'description', column: 'description' },
        { key: 'status', column: 'status' },
        { key: 'currentEmployeeId', column: 'current_employee_id' },
        { key: 'purchaseDate', column: 'purchase_date' },
        { key: 'purchaseCost', column: 'purchase_cost' },
        { key: 'thumbnailUrl', column: 'thumbnail_url' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.id);
      await query(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/assets/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM assets WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Presentations
  app.get('/api/v1/onboarding/presentations', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM presentations ORDER BY category, title');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/presentations', authRequired, async (req, res, next) => {
    try {
      const { category, subCategory, title, description, fileUrl, thumbnailUrl, durationMinutes, isActive } = req.body ?? {};
      if (!title) return res.status(400).json({ error: { code: 'VALIDATION', message: 'title required' } });
      const id = ulid();
      await query(
        `INSERT INTO presentations (id, category, sub_category, title, description, file_url, thumbnail_url, duration_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, category || null, subCategory || null, title, description || null, fileUrl || null, thumbnailUrl || null,
         durationMinutes != null && durationMinutes !== '' ? Number(durationMinutes) : null, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/presentations/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'category', column: 'category' },
        { key: 'subCategory', column: 'sub_category' },
        { key: 'title', column: 'title' },
        { key: 'description', column: 'description' },
        { key: 'fileUrl', column: 'file_url' },
        { key: 'thumbnailUrl', column: 'thumbnail_url' },
        { key: 'durationMinutes', column: 'duration_minutes' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE presentations SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/presentations/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM presentations WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Onboarding documents
  app.get('/api/v1/onboarding/docs', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM onboarding_docs ORDER BY category, title');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/docs', authRequired, async (req, res, next) => {
    try {
      const { category, subCategory, title, description, fileUrl, thumbnailUrl, requiresSignature, isActive } = req.body ?? {};
      if (!title) return res.status(400).json({ error: { code: 'VALIDATION', message: 'title required' } });
      const id = ulid();
      await query(
        `INSERT INTO onboarding_docs (id, category, sub_category, title, description, file_url, thumbnail_url, requires_signature, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, category || null, subCategory || null, title, description || null, fileUrl || null, thumbnailUrl || null,
         parseBool(requiresSignature), parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/docs/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'category', column: 'category' },
        { key: 'subCategory', column: 'sub_category' },
        { key: 'title', column: 'title' },
        { key: 'description', column: 'description' },
        { key: 'fileUrl', column: 'file_url' },
        { key: 'thumbnailUrl', column: 'thumbnail_url' },
        { key: 'requiresSignature', column: 'requires_signature' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.requiresSignature !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('requires_signature'));
        if (idx >= 0) values[idx] = parseBool(req.body.requiresSignature);
      }
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE onboarding_docs SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/docs/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM onboarding_docs WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Onboarding items (programs / tours / activities — one master, kind discriminator)
  app.get('/api/v1/onboarding/items', authRequired, async (req, res, next) => {
    try {
      const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
      const where = kind ? 'WHERE kind = ?' : '';
      const params = kind ? [kind] : [];
      const rows = await query(
        `SELECT * FROM onboarding_items ${where} ORDER BY kind, category, title`,
        params
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding/items', authRequired, async (req, res, next) => {
    try {
      const { kind, category, subCategory, title, description, thumbnailUrl, durationMinutes, isActive } = req.body ?? {};
      if (!kind || !title) return res.status(400).json({ error: { code: 'VALIDATION', message: 'kind and title required' } });
      if (!['program', 'tour', 'activity'].includes(kind)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'kind must be program | tour | activity' } });
      }
      const id = ulid();
      await query(
        `INSERT INTO onboarding_items (id, kind, category, sub_category, title, description, thumbnail_url, duration_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, kind, category || null, subCategory || null, title, description || null, thumbnailUrl || null,
         durationMinutes != null && durationMinutes !== '' ? Number(durationMinutes) : null, parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding/items/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'kind', column: 'kind' },
        { key: 'category', column: 'category' },
        { key: 'subCategory', column: 'sub_category' },
        { key: 'title', column: 'title' },
        { key: 'description', column: 'description' },
        { key: 'thumbnailUrl', column: 'thumbnail_url' },
        { key: 'durationMinutes', column: 'duration_minutes' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE onboarding_items SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding/items/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM onboarding_items WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Hiring funnel templates (screening + offer). Interview template extension
  // for fields_json lives next to the existing routes above.
  // ────────────────────────────────────────────────────────────────────────

  // Screening templates
  app.get('/api/v1/hiring/screening-templates', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM screening_templates ORDER BY name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/hiring/screening-templates', authRequired, async (req, res, next) => {
    try {
      const { name, description, fieldsJson, isDefault, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const fjs = fieldsJson == null ? null : typeof fieldsJson === 'string' ? fieldsJson : JSON.stringify(fieldsJson);
      await query(
        'INSERT INTO screening_templates (id, name, description, fields_json, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description || null, fjs, parseBool(isDefault), parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/hiring/screening-templates/:id', authRequired, async (req, res, next) => {
    try {
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      if (body.fieldsJson !== undefined && body.fieldsJson !== null && typeof body.fieldsJson !== 'string') {
        body.fieldsJson = JSON.stringify(body.fieldsJson);
      }
      const { sets, values } = updateSets(body, [
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'fieldsJson', column: 'fields_json' },
        { key: 'isDefault', column: 'is_default' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (body.isDefault !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_default'));
        if (idx >= 0) values[idx] = parseBool(body.isDefault);
      }
      if (body.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE screening_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/hiring/screening-templates/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM screening_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Offer templates
  app.get('/api/v1/hiring/offer-templates', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM offer_templates ORDER BY name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/hiring/offer-templates', authRequired, async (req, res, next) => {
    try {
      const { name, description, bodyMd, isDefault, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      await query(
        'INSERT INTO offer_templates (id, name, description, body_md, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description || null, bodyMd || null, parseBool(isDefault), parseBool(isActive ?? true)]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/hiring/offer-templates/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'bodyMd', column: 'body_md' },
        { key: 'isDefault', column: 'is_default' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isDefault !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_default'));
        if (idx >= 0) values[idx] = parseBool(req.body.isDefault);
      }
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE offer_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/hiring/offer-templates/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM offer_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Extend giveaway master with the new columns added in migration 0019.
  // (POST/PATCH for the original `name`/`is_default` shape live in index.ts;
  // this PATCH supports the extended fields without breaking existing callers.)
  app.patch('/api/v1/onboarding/giveaways/:id/full', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'name', column: 'name' },
        { key: 'category', column: 'category' },
        { key: 'occasion', column: 'occasion' },
        { key: 'thumbnailUrl', column: 'thumbnail_url' },
        { key: 'description', column: 'description' },
        { key: 'isDefault', column: 'is_default' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isDefault !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_default'));
        if (idx >= 0) values[idx] = parseBool(req.body.isDefault);
      }
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE onboarding_giveaway_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // Attendance Rules master (referenced by Employee Master → Attendance & Leaves tab)
  app.get('/api/v1/attendance-rules', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM attendance_rules ORDER BY name');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/attendance-rules', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const ruleCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('attendance_rules', 'code', 'AR');
      await query(
        'INSERT INTO attendance_rules (id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?)',
        [id, ruleCode, name, description || null, parseBool(isActive)]
      );
      res.status(201).json({ data: { id, code: ruleCode } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/attendance-rules/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      values.push(req.params.id);
      await query(`UPDATE attendance_rules SET ${sets.join(', ')} WHERE id = ?`, values);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/attendance-rules/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM attendance_rules WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ── Induction templates (named bundle of presentations + documents) ────────
  async function replaceInductionItems(templateId: string, presentationIds: unknown, docIds: unknown): Promise<void> {
    await query('DELETE FROM induction_template_items WHERE template_id = ?', [templateId]);
    let order = 0;
    const ins = async (kind: string, ids: unknown) => {
      if (!Array.isArray(ids)) return;
      for (const ref of ids) {
        if (typeof ref === 'string' && ref) {
          await query(
            'INSERT INTO induction_template_items (id, template_id, ref_kind, ref_id, sort_order) VALUES (?, ?, ?, ?, ?)',
            [ulid(), templateId, kind, ref, order++]
          );
        }
      }
    };
    await ins('presentation', presentationIds);
    await ins('doc', docIds);
  }

  app.get('/api/v1/induction-templates', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT t.*, (SELECT COUNT(*) FROM induction_template_items i WHERE i.template_id = t.id) AS item_count
         FROM induction_templates t ORDER BY t.name`
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.get('/api/v1/induction-templates/:id', authRequired, async (req, res, next) => {
    try {
      const rows = await query<Record<string, unknown>>('SELECT * FROM induction_templates WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      const presentations = await query(
        `SELECT p.id, p.title, p.category, p.sub_category
         FROM induction_template_items i JOIN presentations p ON p.id = i.ref_id
         WHERE i.template_id = ? AND i.ref_kind = 'presentation' ORDER BY i.sort_order, p.title`,
        [req.params.id]
      );
      const docs = await query(
        `SELECT d.id, d.title, d.category, d.sub_category, d.requires_signature
         FROM induction_template_items i JOIN onboarding_docs d ON d.id = i.ref_id
         WHERE i.template_id = ? AND i.ref_kind = 'doc' ORDER BY i.sort_order, d.title`,
        [req.params.id]
      );
      res.json({ data: { ...rows[0], presentations, docs } });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/induction-templates', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, isActive, presentationIds, docIds } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const tplCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('induction_templates', 'code', 'IND');
      await query('INSERT INTO induction_templates (id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?)',
        [id, tplCode, name, description || null, parseBool(isActive ?? true)]);
      await replaceInductionItems(id, presentationIds, docIds);
      res.status(201).json({ data: { id, code: tplCode } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/induction-templates/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      if (sets.length) {
        values.push(req.params.id);
        await query(`UPDATE induction_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      if (req.body?.presentationIds !== undefined || req.body?.docIds !== undefined) {
        await replaceInductionItems(req.params.id, req.body?.presentationIds ?? [], req.body?.docIds ?? []);
      }
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/induction-templates/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM induction_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  // ── Onboarding templates (named bundle of programs / tours / activities) ───
  async function replaceOnboardingTemplateItems(templateId: string, itemIds: unknown): Promise<void> {
    await query('DELETE FROM onboarding_template_items WHERE template_id = ?', [templateId]);
    if (!Array.isArray(itemIds)) return;
    let order = 0;
    for (const ref of itemIds) {
      if (typeof ref === 'string' && ref) {
        await query(
          'INSERT INTO onboarding_template_items (id, template_id, item_id, sort_order) VALUES (?, ?, ?, ?)',
          [ulid(), templateId, ref, order++]
        );
      }
    }
  }

  app.get('/api/v1/onboarding-templates', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT t.*, (SELECT COUNT(*) FROM onboarding_template_items i WHERE i.template_id = t.id) AS item_count
         FROM onboarding_templates t ORDER BY t.name`
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.get('/api/v1/onboarding-templates/:id', authRequired, async (req, res, next) => {
    try {
      const rows = await query<Record<string, unknown>>('SELECT * FROM onboarding_templates WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      const items = await query(
        `SELECT it.id, it.kind, it.title, it.category, it.sub_category
         FROM onboarding_template_items oi JOIN onboarding_items it ON it.id = oi.item_id
         WHERE oi.template_id = ? ORDER BY oi.sort_order, it.kind, it.title`,
        [req.params.id]
      );
      res.json({ data: { ...rows[0], items } });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/onboarding-templates', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, isActive, itemIds } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const tplCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('onboarding_templates', 'code', 'OBT');
      await query('INSERT INTO onboarding_templates (id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?)',
        [id, tplCode, name, description || null, parseBool(isActive ?? true)]);
      await replaceOnboardingTemplateItems(id, itemIds);
      res.status(201).json({ data: { id, code: tplCode } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/onboarding-templates/:id', authRequired, async (req, res, next) => {
    try {
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'code', column: 'code' },
        { key: 'name', column: 'name' },
        { key: 'description', column: 'description' },
        { key: 'isActive', column: 'is_active' },
      ]);
      if (req.body?.isActive !== undefined) {
        const idx = sets.findIndex((s) => s.startsWith('is_active'));
        if (idx >= 0) values[idx] = parseBool(req.body.isActive);
      }
      if (sets.length) {
        values.push(req.params.id);
        await query(`UPDATE onboarding_templates SET ${sets.join(', ')} WHERE id = ?`, values);
      }
      if (req.body?.itemIds !== undefined) {
        await replaceOnboardingTemplateItems(req.params.id, req.body.itemIds);
      }
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/onboarding-templates/:id', authRequired, async (req, res, next) => {
    try {
      await query('DELETE FROM onboarding_templates WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });
}
