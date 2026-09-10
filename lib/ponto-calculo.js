export const PONTO_TIME_ZONE = 'America/Bahia';

const text = value => String(value ?? '').trim();

function zonedParts(value, timeZone = PONTO_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function localDateTimeToUtc(value, timeZone = PONTO_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text(value));
  if (!match) throw Object.assign(new Error('Data/hora local inválida.'), { status: 400 });
  const [, year, month, day, hour, minute, second = '00'] = match;
  const asUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const local = zonedParts(new Date(asUtc), timeZone);
  const representedAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
  return new Date(asUtc - (representedAsUtc - asUtc)).toISOString();
}

export function localDate(value, timeZone = PONTO_TIME_ZONE) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function minutesBetween(start, end) {
  const difference = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(difference)) throw Object.assign(new Error('Data/hora inválida.'), { status: 400 });
  return Math.max(0, Math.round(difference / 60000));
}

function localTimeToUtc(date, time, timeZone = PONTO_TIME_ZONE) {
  return localDateTimeToUtc(`${date}T${String(time).slice(0, 5)}`, timeZone);
}

function closeOpenSegment(state, timestamp) {
  if (state.open) { state.workedMin += minutesBetween(state.open, timestamp); state.open = null; }
}

export function apportionDay(rows, jornada = null) {
  const ordered = rows.filter(row => row.situacao !== 'ignorada' && row.situacao !== 'duplicada').sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
  const date = ordered.length ? localDate(ordered[0].data_hora) : null;
  const state = { open: null, intervalOpen: false, workedMin: 0, incomplete: false };
  for (const row of ordered) {
    if (row.tipo === 'entrada') {
      if (state.open) state.incomplete = true;
      state.open = row.data_hora;
    } else if (row.tipo === 'fim_intervalo') {
      if (!state.intervalOpen) state.incomplete = true;
      state.intervalOpen = false;
      state.open = row.data_hora;
    } else if (row.tipo === 'inicio_intervalo' || row.tipo === 'saida') {
      if (row.tipo === 'saida' && state.intervalOpen) state.incomplete = true;
      closeOpenSegment(state, row.data_hora);
      if (row.tipo === 'inicio_intervalo') state.intervalOpen = true;
    } else if (state.open) closeOpenSegment(state, row.data_hora);
    else state.open = row.data_hora;
  }
  if (state.open || state.intervalOpen) state.incomplete = true;
  const plannedMin = Number(jornada?.carga_horaria_min || 0);
  let atrasoMin = 0;
  const firstEntry = ordered.find(row => row.tipo === 'entrada') || ordered[0];
  if (date && jornada?.entrada && firstEntry) {
    const expected = localTimeToUtc(date, jornada.entrada);
    atrasoMin = Math.max(0, minutesBetween(expected, firstEntry.data_hora) - Number(jornada.tolerancia_entrada_min || 0));
  }
  const extraMin = Math.max(0, state.workedMin - plannedMin);
  return { date, marcacoes: ordered, previstoMin: plannedMin, trabalhadoMin: state.workedMin, atrasoMin, extraMin, saldoMin: state.workedMin - plannedMin, incompleto: state.incomplete };
}

export function summarizeMirrorRows(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const date = localDate(row.data_hora);
    const key = `${row.colaborador_id}:${date}`;
    const item = byDay.get(key) || { colaborador_id: row.colaborador_id, colaborador: row.colaborador, data: date, jornada: row.jornada, jornada_entrada: row.jornada_entrada, jornada_saida: row.jornada_saida, jornada_data: [] };
    item.jornada_data.push(row);
    byDay.set(key, item);
  }
  return [...byDay.values()].map(item => {
    const first = item.jornada_data[0];
    const result = apportionDay(item.jornada_data, { entrada: item.jornada_entrada, carga_horaria_min: first.carga_horaria_min, tolerancia_entrada_min: first.tolerancia_entrada_min });
    return { colaborador_id: item.colaborador_id, colaborador: item.colaborador, data: item.data, jornada: item.jornada, previsto_entrada: item.jornada_entrada, previsto_saida: item.jornada_saida, marcacoes: result.marcacoes, previsto_min: result.previstoMin, trabalhado_min: result.trabalhadoMin, atraso_min: result.atrasoMin, extra_min: result.extraMin, saldo_min: result.saldoMin, incompleto: result.incompleto };
  });
}
