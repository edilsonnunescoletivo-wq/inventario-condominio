const managedProfiles = new Set([
  'admin',
  'gerente',
  'supervisor',
]);

export function canManagePonto(user = {}) {
  return Boolean(
    user.is_superadmin ||
    managedProfiles.has(user.perfil)
  );
}

export function isIntegrationCredentialValid(value) {
  return (
    String(value ?? '')
      .trim()
      .length >= 32
  );
}

export function deviceCursorUpdate(
  errors = [],
  maxEventId = 0n
) {
  if (
    Array.isArray(errors) &&
    errors.length === 0
  ) {
    return {
      updateCursor: true,
      maxEventId: String(maxEventId ?? 0),
    };
  }

  return {
    updateCursor: false,
    maxEventId: null,
  };
}

export function eventIdempotencyKey(
  equipmentId,
  externalId
) {
  const device =
    String(equipmentId || '').trim();

  const event =
    String(externalId || '').trim();

  if (!device || !event) {
    throw new Error(
      'Equipamento e ID externo são obrigatórios.'
    );
  }

  return `${device}:${event}`;
}

export function tenantMatches(
  record,
  tenantId
) {
  if (
    !record ||
    record.condominio_id == null ||
    tenantId == null
  ) {
    return false;
  }

  return (
    String(record.condominio_id) ===
    String(tenantId)
  );
}
