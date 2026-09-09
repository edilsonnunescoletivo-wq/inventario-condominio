import crypto from 'node:crypto';

/**
 * Adapter boundary for a future local Control iD/iDFace agent.
 * The web app never opens a connection to the device and this module does not
 * assume undocumented vendor endpoints.
 */
export const CONTROLID_PROVIDER = 'controlid';

export function normalizeDeviceEvent(event = {}) {
  const externalId = String(event.externalId ?? event.id ?? '').trim();
  const employeeIdentifier = String(event.employeeIdentifier ?? event.userId ?? '').trim();
  const occurredAt = String(event.occurredAt ?? event.timestamp ?? '').trim();
  if (!externalId || !employeeIdentifier || !occurredAt) {
    throw Object.assign(new Error('Evento de ponto incompleto.'), { status: 400 });
  }
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(occurredAt)) {
    throw Object.assign(new Error('Data/hora do evento deve conter timezone explícito.'), { status: 400 });
  }
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Data/hora do evento inválida.'), { status: 400 });
  }
  return { externalId, employeeIdentifier, occurredAt: date.toISOString(), eventType: String(event.eventType || 'nao_classificada') };
}

export function hashIntegrationCredential(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

export function integrationCredentialMatches(value, hash) {
  const actual = Buffer.from(hashIntegrationCredential(value), 'hex');
  const expected = Buffer.from(String(hash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function createControlIdAdapter() {
  return {
    provider: CONTROLID_PROVIDER,
    async pullEvents() {
      throw Object.assign(new Error('A coleta Control iD deve ser executada pelo agente local autorizado.'), { status: 501 });
    },
    normalizeEvent: normalizeDeviceEvent,
  };
}
