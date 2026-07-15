// Configurable document-template + organisation-profile routes.
// Registered from index.ts. HR configures letterhead / body / signatory / footer
// per document type here; the exit PDF generator (docgen.ts) consumes them.

import type { Application } from 'express';
import { authRequired, requireRole } from './auth';
import { query } from './db';
import { writeAudit } from './audit';
import type { DocTemplate, OrgProfile } from './docgen';

const DOC_TYPES = ['SETTLEMENT_SHEET', 'RELIEVING_LETTER', 'EXPERIENCE_CERTIFICATE', 'REFERENCE_LETTER'];

export async function loadOrgProfile(): Promise<OrgProfile> {
  const rows = await query<{ value: string | null }>("SELECT value FROM app_settings WHERE setting_key = 'org_profile' LIMIT 1");
  try { return rows.length && rows[0].value ? JSON.parse(rows[0].value) : {}; } catch { return {}; }
}

export async function loadTemplate(docType: string): Promise<DocTemplate | null> {
  const rows = await query<DocTemplate>('SELECT * FROM document_templates WHERE doc_type = ? LIMIT 1', [docType]);
  return rows[0] ?? null;
}

export function registerDocumentRoutes(app: Application) {
  // List all templates
  app.get('/api/v1/document-templates', authRequired, async (_req, res, next) => {
    try {
      const rows = await query('SELECT * FROM document_templates ORDER BY doc_type');
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  // Update a template
  app.patch('/api/v1/document-templates/:docType', authRequired, requireRole('HR_ADMIN'), async (req, res, next) => {
    try {
      if (!DOC_TYPES.includes(req.params.docType)) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Unknown document type' } });
      const b = req.body ?? {};
      const allowed: Array<{ key: string; column: string }> = [
        { key: 'title', column: 'title' },
        { key: 'showLetterhead', column: 'show_letterhead' },
        { key: 'letterheadUrl', column: 'letterhead_url' },
        { key: 'bodyTemplate', column: 'body_template' },
        { key: 'signatoryName', column: 'signatory_name' },
        { key: 'signatoryDesignation', column: 'signatory_designation' },
        { key: 'signatureUrl', column: 'signature_url' },
        { key: 'footerText', column: 'footer_text' },
        { key: 'accentColor', column: 'accent_color' },
        { key: 'enabled', column: 'enabled' },
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const f of allowed) {
        if (b[f.key] !== undefined) {
          sets.push(`${f.column} = ?`);
          if (f.key === 'showLetterhead' || f.key === 'enabled') values.push(b[f.key] ? 1 : 0);
          else values.push(b[f.key] === '' ? null : b[f.key]);
        }
      }
      if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      values.push(req.params.docType);
      await query(`UPDATE document_templates SET ${sets.join(', ')} WHERE doc_type = ?`, values);
      writeAudit(req.user!.id, 'update', 'document-template', req.params.docType, null, null).catch(() => {});
      res.json({ data: { docType: req.params.docType } });
    } catch (err) { next(err); }
  });

  // Org profile
  app.get('/api/v1/settings/org-profile', authRequired, async (_req, res, next) => {
    try { res.json({ data: await loadOrgProfile() }); } catch (err) { next(err); }
  });

  app.put('/api/v1/settings/org-profile', authRequired, requireRole('HR_ADMIN'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const profile: OrgProfile = {
        companyName: b.companyName ?? '', addressLine: b.addressLine ?? '', city: b.city ?? '',
        logoUrl: b.logoUrl ?? '', email: b.email ?? '', phone: b.phone ?? '',
      };
      await query(
        "INSERT INTO app_settings (setting_key, value) VALUES ('org_profile', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
        [JSON.stringify(profile)]
      );
      writeAudit(req.user!.id, 'update', 'org-profile', 'org_profile', null, null).catch(() => {});
      res.json({ data: profile });
    } catch (err) { next(err); }
  });
}
