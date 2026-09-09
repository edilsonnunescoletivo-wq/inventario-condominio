import { query } from './db';
import { audit } from './audit';
import { normalizeDeviceEvent } from './controlid';
import { localDateTimeToUtc } from './ponto-calculo';
import { deviceCursorUpdate, isIntegrationCredentialValid } from './ponto-policy';

const allowedTypes = new Set(['entrada', 'saida', 'inicio_intervalo', 'fim_intervalo', 'nao_classificada']);
const allowedSituations = new Set(['valida', 'duplicada', 'ignorada', 'ajuste']);
const text = value => String(value ?? '').trim();
const integer = value => value === '' || value == null ? null : Number(value);
const MAX_LOG_TEXT = 240;
const limited = value => text(value).slice(0, MAX_LOG_TEXT);

export function validateTimekeepingPayload(resource, body = {}) {
  if (resource === 'colaboradores' && (!text(body.nome) || !text(body.matricula))) throw Object.assign(new Error('Nome e matrícula são obrigatórios.'), { status: 400 });
  if (resource === 'jornadas' && (!text(body.nome) || !text(body.entrada) || !text(body.saida) || !(Number(body.carga_horaria_min) > 0))) throw Object.assign(new Error('Nome, horários e carga horária positiva são obrigatórios.'), { status: 400 });
  if (resource === 'equipamentos' && !text(body.nome)) throw Object.assign(new Error('Nome do equipamento é obrigatório.'), { status: 400 });
  if (resource === 'equipamentos' && body.credencial_integracao !== undefined && !isIntegrationCredentialValid(body.credencial_integracao)) throw Object.assign(new Error('A credencial de integração deve ter pelo menos 32 caracteres.'), { status: 400 });
  if (resource === 'marcacoes' && (!body.colaborador_id || !body.data_hora)) throw Object.assign(new Error('Colaborador e data/hora são obrigatórios.'), { status: 400 });
  if (body.tipo && !allowedTypes.has(body.tipo)) throw Object.assign(new Error('Tipo de marcação inválido.'), { status: 400 });
  if (body.situacao && !allowedSituations.has(body.situacao)) throw Object.assign(new Error('Situação de marcação inválida.'), { status: 400 });
  if (body.dias_semana && (!Array.isArray(body.dias_semana) || body.dias_semana.some(day => !Number.isInteger(day) || day < 0 || day > 6))) throw Object.assign(new Error('Dias da semana inválidos.'), { status: 400 });
  if (body.tolerancia_entrada_min != null && Number(body.tolerancia_entrada_min) < 0) throw Object.assign(new Error('Tolerância de entrada inválida.'), { status: 400 });
  if (body.tolerancia_saida_min != null && Number(body.tolerancia_saida_min) < 0) throw Object.assign(new Error('Tolerância de saída inválida.'), { status: 400 });
  if (body.tolerancia_intervalo_min != null && Number(body.tolerancia_intervalo_min) < 0) throw Object.assign(new Error('Tolerância de intervalo inválida.'), { status: 400 });
}

export function normalizeManualPunch(body) {
  return { colaboradorId: body.colaborador_id, dataHora: localDateTimeToUtc(body.data_hora), tipo: body.tipo || 'nao_classificada', observacao: text(body.observacao) || null };
}

function maxNumericEventId(events) {
  return events.map(event => String(event.id ?? '').trim()).filter(value => /^\d+$/.test(value)).map(value => BigInt(value)).reduce((max, value) => value > max ? value : max, 0n);
}

export async function ingestDeviceEvents({ request, device, events }) {
  const imported = []; const duplicates = []; const errors = [];
  for (const raw of events) {
    try {
      const event = normalizeDeviceEvent(raw);
      const employee = await query(`SELECT id FROM ponto_colaboradores WHERE condominio_id=$1 AND identificador_controlid=$2 AND ativo=true LIMIT 1`, [device.condominio_id, event.employeeIdentifier]);
      if (!employee.rowCount) throw Object.assign(new Error(`Colaborador não encontrado para o identificador ${event.employeeIdentifier}.`), { status: 422 });
      const result = await query(`INSERT INTO ponto_marcacoes(condominio_id,colaborador_id,equipamento_id,data_hora,tipo,origem,id_externo_evento,situacao) VALUES($1,$2,$3,$4,$5,'agente_local',$6,'valida') ON CONFLICT (equipamento_id,id_externo_evento) DO NOTHING RETURNING id`, [device.condominio_id, employee.rows[0].id, device.id, event.occurredAt, allowedTypes.has(event.eventType) ? event.eventType : 'nao_classificada', event.externalId]);
      if (result.rowCount) imported.push(result.rows[0].id); else duplicates.push(event.externalId);
    } catch (error) {
      const event = raw || {};
      errors.push({ externalId: limited(event.externalId ?? event.id), employeeIdentifier: limited(event.employeeIdentifier ?? event.userId), error: limited(error.message) });
    }
  }
  const maxEventId = maxNumericEventId(events);
  const cursor = deviceCursorUpdate(errors, maxEventId);
  const update = cursor.updateCursor ? 'ultimo_evento_id=GREATEST(COALESCE(ultimo_evento_id,0),$1::bigint),' : '';
  await query(`UPDATE ponto_equipamentos SET ultima_comunicacao_em=now(),${update} atualizado_em=now() WHERE id=$2 AND condominio_id=$3`, [cursor.maxEventId || '0', device.id, device.condominio_id]);
  const status = errors.length && imported.length ? 'parcial' : errors.length ? 'erro' : 'sucesso';
  const sync = await query(`INSERT INTO ponto_sincronizacoes(condominio_id,equipamento_id,finalizado_em,status,quantidade_importada,quantidade_duplicada,erro,log) VALUES($1,$2,now(),$3,$4,$5,$6,$7::jsonb) RETURNING id`, [device.condominio_id, device.id, status, imported.length, duplicates.length, errors.length ? `${errors.length} evento(s) rejeitado(s)` : null, JSON.stringify({ errors })]);
  await audit(request, { condominio_id: device.condominio_id, acao: 'sincronizar', modulo: 'ponto', entidade_id: device.id, descricao: 'Eventos recebidos pelo agente local', detalhes: { sync_id: sync.rows[0].id, imported: imported.length, duplicates: duplicates.length, errors: errors.length } });
  return { syncId: sync.rows[0].id, imported: imported.length, duplicates: duplicates.length, errors };
}

export function parsePeriod(searchParams) {
  const from = searchParams.get('de'); const to = searchParams.get('ate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || from > to) throw Object.assign(new Error('Período inválido.'), { status: 400 });
  return { from, to };
}

export { integer, text };
export { PONTO_TIME_ZONE, localDateTimeToUtc, localDate, minutesBetween, apportionDay, summarizeMirrorRows } from './ponto-calculo';
