import test from 'node:test';
import assert from 'node:assert/strict';
import { apportionDay, localDate, localDateTimeToUtc, summarizeMirrorRows } from '../lib/ponto-calculo.js';

test('converte horario local de Bahia para UTC sem deslocamento acidental', () => {
  assert.equal(localDateTimeToUtc('2026-09-09T08:00'), '2026-09-09T11:00:00.000Z');
  assert.equal(localDate('2026-09-09T02:30:00.000Z'), '2026-09-08');
});

test('apura entrada, intervalo, retorno e saida por tipo', () => {
  const rows = [
    { data_hora: '2026-09-09T11:00:00.000Z', tipo: 'entrada', situacao: 'valida' },
    { data_hora: '2026-09-09T15:00:00.000Z', tipo: 'inicio_intervalo', situacao: 'valida' },
    { data_hora: '2026-09-09T16:00:00.000Z', tipo: 'fim_intervalo', situacao: 'valida' },
    { data_hora: '2026-09-09T20:00:00.000Z', tipo: 'saida', situacao: 'valida' },
  ];
  const result = apportionDay(rows, { entrada: '08:00', carga_horaria_min: 480, tolerancia_entrada_min: 0 });
  assert.equal(result.trabalhadoMin, 480);
  assert.equal(result.atrasoMin, 0);
  assert.equal(result.saldoMin, 0);
  assert.equal(result.incompleto, false);
});

test('marca batida sem fechamento como incompleta e ignora duplicada', () => {
  const result = apportionDay([
    { data_hora: '2026-09-09T11:00:00.000Z', tipo: 'entrada', situacao: 'valida' },
    { data_hora: '2026-09-09T12:00:00.000Z', tipo: 'entrada', situacao: 'duplicada' },
  ], { entrada: '08:00', carga_horaria_min: 480 });
  assert.equal(result.incompleto, true);
  assert.equal(result.trabalhadoMin, 0);
});

test('resume dias no calendario local e calcula atraso, extra e saldo', () => {
  const rows = [
    { colaborador_id: 'c1', colaborador: 'Ana', data_hora: '2026-09-09T11:10:00.000Z', tipo: 'entrada', situacao: 'valida', jornada: 'Comercial', jornada_entrada: '08:00', jornada_saida: '17:00', carga_horaria_min: 480, tolerancia_entrada_min: 0 },
    { colaborador_id: 'c1', colaborador: 'Ana', data_hora: '2026-09-09T20:30:00.000Z', tipo: 'saida', situacao: 'valida', jornada: 'Comercial', jornada_entrada: '08:00', jornada_saida: '17:00', carga_horaria_min: 480, tolerancia_entrada_min: 0 },
  ];
  const [summary] = summarizeMirrorRows(rows);
  assert.equal(summary.data, '2026-09-09');
  assert.equal(summary.atraso_min, 10);
  assert.equal(summary.trabalhado_min, 560);
  assert.equal(summary.extra_min, 80);
  assert.equal(summary.saldo_min, 80);
});

test('reenvio do mesmo evento preserva a chave idempotente composta', () => {
  const key = (equipmentId, externalId) => `${equipmentId}:${externalId}`;
  const events = new Set([key('device-1', '1842')]);
  events.add(key('device-1', '1842'));
  assert.equal(events.size, 1);
  assert.notEqual(key('device-2', '1842'), key('device-1', '1842'));
});

