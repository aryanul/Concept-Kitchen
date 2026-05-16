import bcrypt from 'bcryptjs';
import type { Application } from 'express';
import { ulid } from 'ulid';
import { authRequired, type Role } from './auth';
import { query } from './db';

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

export function registerMasterRoutes(app: Application) {
  // Branches
  app.post('/api/v1/branches', authRequired, async (req, res, next) => {
    try {
      const { name, city, kind, code } = req.body ?? {};
      if (!name || !city || !kind) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'name, city and kind required' } });
      }
      const id = ulid();
      const branchCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('branches', 'code', 'BR');
      await query('INSERT INTO branches (id, code, name, city, kind) VALUES (?, ?, ?, ?, ?)', [id, branchCode, name, city, kind]);
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
      const rows = await query('SELECT * FROM divisions ORDER BY name');
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/divisions', authRequired, async (req, res, next) => {
    try {
      const { code, name, description, isActive } = req.body ?? {};
      if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
      const id = ulid();
      const divisionCode = typeof code === 'string' && code.trim() ? code.trim() : await nextCode('divisions', 'code', 'DIV');
      await query('INSERT INTO divisions (id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?)', [
        id,
        divisionCode,
        name,
        description || null,
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

  // Interview templates
  app.patch('/api/v1/hiring/interview-templates/:id', authRequired, async (req, res, next) => {
    try {
      const { title, description, imageUrl, isDefault } = req.body ?? {};
      const { sets, values } = updateSets(req.body ?? {}, [
        { key: 'title', column: 'title' },
        { key: 'description', column: 'description' },
        { key: 'imageUrl', column: 'image_url' },
        { key: 'isDefault', column: 'is_default' },
      ]);
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      if (req.body?.isDefault !== undefined) values[values.length - 1] = parseBool(req.body.isDefault);
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
}
