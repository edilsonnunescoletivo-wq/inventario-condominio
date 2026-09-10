import crypto from 'node:crypto';

/**
 * Adapter boundary for a future local Control iD/iDFace agent.
 * The web app never opens a connection to the device and this module does not
 * assume undocumented vendor endpoints.
 */

export const CONTROLID_PROVIDER = 'controlid';

const MAX_EXTERNAL_ID = 128;
const MAX_EMPLOYEE_IDENTIFIER = 128;

const allowedEventTypes = new Set([
  'entrada',
  'saida',
  'inicio_intervalo',
  'fim_intervalo',
  'nao_classificada',
]);

const limitedText = (value, max) =>
  String(value ?? '').trim().slice(0, max);

export function normalizeDeviceEvent(event = {}) {
  const externalId = limitedText(
    event.externalId ?? event.id,
    MAX_EXTERNAL_ID
  );

  const employeeIdentifier = limitedText(
    event.employeeIdentifier ?? event.userId,
    MAX_EMPLOYEE_IDENTIFIER
  );

  const occurredAt = String(
    event.occurredAt ?? event.timestamp ?? ''
  ).trim();

  if (
    !externalId ||
    !employeeIdentifier ||
    !occurredAt
  ) {
    throw Object.assign(
      new Error('Evento de ponto incompleto.'),
      { status: 400 }
    );
  }

  if (
    !/(?:Z|[+-]\d{2}:?\d{2})$/.test(
      occurredAt
    )
  ) {
    throw Object.assign(
      new Error(
        'Data/hora do evento deve conter timezone explícito.'
      ),
      { status: 400 }
    );
  }

  const date = new Date(occurredAt);

  if (Number.isNaN(date.getTime())) {
    throw Object.assign(
      new Error(
        'Data/hora do evento inválida.'
      ),
      { status: 400 }
    );
  }

  const rawEventType = String(
    event.eventType ||
    'nao_classificada'
  ).trim();

  const eventType =
    allowedEventTypes.has(rawEventType)
      ? rawEventType
      : 'nao_classificada';

  return {
    externalId,
    employeeIdentifier,
    occurredAt: date.toISOString(),
    eventType,
  };
}

export function hashIntegrationCredential(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

export function integrationCredentialMatches(
  value,
  hash
) {
  const expectedHash =
    String(hash || '').trim();

  /*
   * SHA-256 em hexadecimal deve possuir
   * exatamente 64 caracteres hexadecimais.
   */
  if (
    !/^[a-f0-9]{64}$/i.test(
      expectedHash
    )
  ) {
    return false;
  }

  const actual =
    Buffer.from(
      hashIntegrationCredential(value),
      'hex'
    );

  const expected =
    Buffer.from(
      expectedHash,
      'hex'
    );

  if (
    actual.length !== expected.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    actual,
    expected
  );
}

export function createControlIdAdapter() {
  return {
    provider:
      CONTROLID_PROVIDER,

    async pullEvents() {
      throw Object.assign(
        new Error(
          'A coleta Control iD deve ser executada pelo agente local autorizado.'
        ),
        { status: 501 }
      );
    },

    normalizeEvent:
      normalizeDeviceEvent,
  };
}
