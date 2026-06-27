import { ulid } from 'ulid';
import { query } from './db';

type AuditPayload = unknown | null;

export async function writeAudit(
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
  beforeData: AuditPayload,
  afterData: AuditPayload,
) {
  await query(
    'INSERT INTO audit_logs (id, actor_id, action, resource, resource_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      ulid(),
      actorId,
      action,
      resource,
      resourceId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData  ? JSON.stringify(afterData)  : null,
    ],
  );
}
