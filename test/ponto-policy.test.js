import test from 'node:test';
import assert from 'node:assert/strict';
import { canManagePonto, deviceCursorUpdate, eventIdempotencyKey, isIntegrationCredentialValid, tenantMatches } from '../lib/ponto-policy.js';

test('autoriza somente perfis de gestao para ajustes', () => {
  assert.equal(canManagePonto({ perfil: 'admin' }), true);
  assert.equal(canManagePonto({ perfil: 'gerente' }), true);
  assert.equal(canManagePonto({ perfil: 'supervisor' }), true);
  assert.equal(canManagePonto({ perfil: 'operacional' }), false);
  assert.equal(canManagePonto({ perfil: 'consulta' }), false);
  assert.equal(canManagePonto({ is_superadmin: true, perfil: 'consulta' }), true);
});

test('escopo tenant rejeita registro de outro condominio', () => {
  assert.equal(tenantMatches({ condominio_id: 'a' }, 'a'), true);
  assert.equal(tenantMatches({ condominio_id: 'b' }, 'a'), false);
  assert.equal(tenantMatches(null, 'a'), false);
});

test('chave de idempotencia distingue equipamento e evento', () => {
  assert.equal(eventIdempotencyKey('device-a', '42'), 'device-a:42');
  assert.notEqual(eventIdempotencyKey('device-a', '42'), eventIdempotencyKey('device-b', '42'));
  assert.throws(() => eventIdempotencyKey('device-a', ''), /obrigatórios/);
});

test('credencial curta e rejeitada', () => {
  assert.equal(isIntegrationCredentialValid('curta'), false);
  assert.equal(isIntegrationCredentialValid('x'.repeat(32)), true);
});

test('cursor so avanca sem erros no lote', () => {
  assert.deepEqual(deviceCursorUpdate([{ externalId: '101', employeeIdentifier: 'u1', error: 'rejeitado' }], 102n), { updateCursor: false, maxEventId: null });
  assert.deepEqual(deviceCursorUpdate([], 102n), { updateCursor: true, maxEventId: '102' });
});
