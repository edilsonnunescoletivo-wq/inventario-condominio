import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDeviceEvent } from '../lib/controlid.js';

test('rejeita evento sem timezone explícito', () => {
  assert.throws(() => normalizeDeviceEvent({ id: '100', userId: 'u1', timestamp: '2026-09-09T08:00:00' }), /timezone explícito/);
});

test('aceita Z e offset e normaliza para UTC', () => {
  assert.equal(normalizeDeviceEvent({ id: '101', userId: 'u1', timestamp: '2026-09-09T11:00:00Z' }).occurredAt, '2026-09-09T11:00:00.000Z');
  assert.equal(normalizeDeviceEvent({ id: '102', userId: 'u1', timestamp: '2026-09-09T08:00:00-03:00' }).occurredAt, '2026-09-09T11:00:00.000Z');
});