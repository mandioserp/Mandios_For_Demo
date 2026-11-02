export function getTenantId(req) {
  return req?.tenantId ?? null;
}

export function buildTenantQuery(req, query = {}) {
  const tenantId = getTenantId(req);
  if (!tenantId && req?.user?.role === 'super_admin') return { ...query };
  if (!tenantId) return { ...query, tenantId: null };
  return { ...query, tenantId };
}

export function assertTenantOwnership(req, record) {
  if (!record || req?.user?.role === 'super_admin') return true;
  return record.tenantId === getTenantId(req);
}
