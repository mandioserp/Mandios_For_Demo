import { AuditLog } from '../models/index.js';
import { buildTenantQuery } from '../utils/tenant.js';

export async function getAuditLogs(req, res) {
  try {
    const logs = await AuditLog.find(buildTenantQuery(req));
    // Sort in reverse order (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(logs.slice(0, 100)); // limit to top 100
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
}
