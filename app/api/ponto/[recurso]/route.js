import { query } from '@/lib/db';
import { apiError, requireSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { integer, normalizeManualPunch, parsePeriod, summarizeMirrorRows, text, validateTimekeepingPayload } from '@/lib/ponto';
import { hashIntegrationCredential } from '@/lib/controlid';
import { canManagePonto, isIntegrationCredentialValid } from '@/lib/ponto-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const configResources = new Set(['colaboradores', 'equipamentos', 'jornadas']);
const canManage = user => canManagePonto(user);
const canAdjust = user => canManagePonto(user);
const bodyJson = request => request.json().catch(() => ({}));
const publicFields = {
  colaboradores: 'id,nome,cpf,matricula,cargo,departamento,data_admissao,situacao,identificador_controlid,jornada_id',
  equipamentos: 'id,nome,fabricante,modelo,host(ip) ip,porta,firmware,situacao,ultima_comunicacao_em,ultimo_evento_id,criado_em',
  jornadas: 'id,nome,dias_semana,entrada,inicio_intervalo,fim_intervalo,saida,tolerancia_entrada_min,tolerancia_saida_min,tolerancia_intervalo_min,carga_horaria_min,ativo,criado_em,atualizado_em',
  marcacoes: 'id,condominio_id,colaborador_id,equipamento_id,data_hora,tipo,origem,id_externo_evento,situacao,observacao,criado_em',
};

async function tenantRow(resource, id, tenantId) {
  const tables = { colaboradores: 'ponto_colaboradores', equipamentos: 'ponto_equipamentos', jornadas: 'ponto_jornadas' };
  if (!tables[resource]) return null;
  const result = await query(`SELECT id FROM ${tables[resource]} WHERE id=$1 AND condominio_id=$2`, [id, tenantId]);
  return result.rows[0] || null;
}

export async function GET(request, { params }) {
  try {
    const user = await requireSession(request);
    const { recurso } = await params;
    const url = new URL(request.url);
    const tenantId = user.condominio_id;
    let result;
    if (recurso === 'colaboradores') result = await query(`SELECT c.id,c.nome,c.cpf,c.matricula,c.cargo,c.departamento,c.data_admissao,c.situacao,c.identificador_controlid,c.jornada_id,j.nome jornada FROM ponto_colaboradores c LEFT JOIN ponto_jornadas j ON j.id=c.jornada_id AND j.condominio_id=c.condominio_id WHERE c.condominio_id=$1 AND c.ativo=true ORDER BY c.nome`, [tenantId]);
    else if (recurso === 'equipamentos') result = await query(`SELECT id,nome,fabricante,modelo,host(ip) ip,porta,firmware,situacao,ultima_comunicacao_em,ultimo_evento_id,criado_em FROM ponto_equipamentos WHERE condominio_id=$1 ORDER BY nome`, [tenantId]);
    else if (recurso === 'jornadas') result = await query(`SELECT * FROM ponto_jornadas WHERE condominio_id=$1 AND ativo=true ORDER BY nome`, [tenantId]);
    else if (recurso === 'marcacoes') {
      const period = url.searchParams.get('de') || url.searchParams.get('ate') ? parsePeriod(url.searchParams) : null;
      const values = [tenantId]; const filters = ['m.condominio_id=$1'];
      if (url.searchParams.get('colaborador_id')) { values.push(url.searchParams.get('colaborador_id')); filters.push(`m.colaborador_id=$${values.length}`); }
      if (period) { values.push(period.from); filters.push(`(m.data_hora AT TIME ZONE 'America/Bahia')::date >= $${values.length}::date`); values.push(period.to); filters.push(`(m.data_hora AT TIME ZONE 'America/Bahia')::date <= $${values.length}::date`); }
      result = await query(`SELECT m.*,c.nome colaborador,e.nome equipamento FROM ponto_marcacoes m JOIN ponto_colaboradores c ON c.id=m.colaborador_id AND c.condominio_id=m.condominio_id LEFT JOIN ponto_equipamentos e ON e.id=m.equipamento_id AND e.condominio_id=m.condominio_id WHERE ${filters.join(' AND ')} ORDER BY m.data_hora DESC LIMIT 1000`, values);
    } else if (recurso === 'banco') {
      const period = url.searchParams.get('de') || url.searchParams.get('ate') ? parsePeriod(url.searchParams) : null;
      const values = [tenantId]; const filters = ['b.condominio_id=$1'];
      if (url.searchParams.get('colaborador_id')) { values.push(url.searchParams.get('colaborador_id')); filters.push(`b.colaborador_id=$${values.length}`); }
      if (period) { values.push(period.from); filters.push(`b.referencia >= $${values.length}::date`); values.push(period.to); filters.push(`b.referencia <= $${values.length}::date`); }
      result = await query(`SELECT b.*,c.nome colaborador FROM ponto_banco_horas b JOIN ponto_colaboradores c ON c.id=b.colaborador_id AND c.condominio_id=b.condominio_id WHERE ${filters.join(' AND ')} ORDER BY b.referencia DESC,b.criado_em DESC LIMIT 1000`, values);
    } else if (recurso === 'sincronizacoes') result = await query(`SELECT s.*,e.nome equipamento FROM ponto_sincronizacoes s JOIN ponto_equipamentos e ON e.id=s.equipamento_id AND e.condominio_id=s.condominio_id WHERE s.condominio_id=$1 ORDER BY s.iniciado_em DESC LIMIT 200`, [tenantId]);
    else if (recurso === 'espelho') {
      const { from, to } = parsePeriod(url.searchParams);
      const values = [tenantId, from, to]; const filters = ["m.condominio_id=$1", "(m.data_hora AT TIME ZONE 'America/Bahia')::date >= $2::date", "(m.data_hora AT TIME ZONE 'America/Bahia')::date <= $3::date"];
      if (url.searchParams.get('colaborador_id')) { values.push(url.searchParams.get('colaborador_id')); filters.push(`m.colaborador_id=$${values.length}`); }
      result = await query(`SELECT m.colaborador_id,c.nome colaborador,m.data_hora,m.tipo,m.situacao,j.nome jornada,j.entrada jornada_entrada,j.saida jornada_saida,j.carga_horaria_min,j.tolerancia_entrada_min FROM ponto_marcacoes m JOIN ponto_colaboradores c ON c.id=m.colaborador_id AND c.condominio_id=m.condominio_id LEFT JOIN ponto_jornadas j ON j.id=c.jornada_id AND j.condominio_id=c.condominio_id WHERE ${filters.join(' AND ')} ORDER BY c.nome,m.data_hora`, values);
      return Response.json({ items: result.rows, periodo: { from, to }, resumo: summarizeMirrorRows(result.rows) });
    } else return Response.json({ error: 'Recurso de ponto inválido.' }, { status: 404 });
    if (recurso === 'banco') {
      const period = url.searchParams.get('de') || url.searchParams.get('ate') ? parsePeriod(url.searchParams) : null;
      const values = [tenantId]; const filters = ['b.condominio_id=$1'];
      if (url.searchParams.get('colaborador_id')) { values.push(url.searchParams.get('colaborador_id')); filters.push(`b.colaborador_id=$${values.length}`); }
      if (period) { values.push(period.from); filters.push(`b.referencia >= $${values.length}::date`); values.push(period.to); filters.push(`b.referencia <= $${values.length}::date`); }
      const summary = await query(`SELECT b.colaborador_id,c.nome colaborador,COALESCE(SUM(CASE WHEN b.minutos > 0 THEN b.minutos ELSE 0 END),0)::int creditos_min,COALESCE(SUM(CASE WHEN b.minutos < 0 THEN ABS(b.minutos) ELSE 0 END),0)::int debitos_min,COALESCE(SUM(b.minutos),0)::int saldo_min FROM ponto_banco_horas b JOIN ponto_colaboradores c ON c.id=b.colaborador_id AND c.condominio_id=b.condominio_id WHERE ${filters.join(' AND ')} GROUP BY b.colaborador_id,c.nome ORDER BY c.nome`, values);
      return Response.json({ items: result.rows, resumo: summary.rows });
    }
    return Response.json({ items: result.rows });
  } catch (error) { return apiError(error); }
}


export async function POST(request, { params }) {
  try {
    const user = await requireSession(request);
    const { recurso } = await params;
    const body = await bodyJson(request);
    if ((configResources.has(recurso) || recurso === 'marcacoes' || recurso === 'banco') && !canAdjust(user)) return Response.json({ error: 'Acesso restrito à gestão do Controle de Ponto.' }, { status: 403 });
    validateTimekeepingPayload(recurso, body);
    const tenantId = user.condominio_id;
    let result;
    if (recurso === 'jornadas') result = await query(`INSERT INTO ponto_jornadas(condominio_id,nome,dias_semana,entrada,inicio_intervalo,fim_intervalo,saida,tolerancia_entrada_min,tolerancia_saida_min,tolerancia_intervalo_min,carga_horaria_min,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`, [tenantId, text(body.nome), body.dias_semana || [], body.entrada, body.inicio_intervalo || null, body.fim_intervalo || null, body.saida, integer(body.tolerancia_entrada_min) ?? 0, integer(body.tolerancia_saida_min) ?? 0, integer(body.tolerancia_intervalo_min) ?? 0, integer(body.carga_horaria_min) || 0, user.id]);
    else if (recurso === 'colaboradores') result = await query(`INSERT INTO ponto_colaboradores(condominio_id,jornada_id,nome,cpf,matricula,cargo,departamento,data_admissao,situacao,identificador_controlid,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id,nome,cpf,matricula,cargo,departamento,data_admissao,situacao,identificador_controlid,jornada_id`, [tenantId, body.jornada_id || null, text(body.nome), text(body.cpf) || null, text(body.matricula), text(body.cargo) || null, text(body.departamento) || null, body.data_admissao || null, body.situacao || 'ativo', text(body.identificador_controlid) || null, user.id]);
    else if (recurso === 'equipamentos') result = await query(`INSERT INTO ponto_equipamentos(condominio_id,nome,fabricante,modelo,ip,porta,firmware,situacao,credencial_integracao_hash,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id,nome,fabricante,modelo,host(ip) ip,porta,firmware,situacao`, [tenantId, text(body.nome), text(body.fabricante) || 'Control iD', text(body.modelo) || 'iDFace', text(body.ip) || null, integer(body.porta) || 80, text(body.firmware) || null, body.situacao || 'ativo', body.credencial_integracao ? hashIntegrationCredential(body.credencial_integracao) : null, user.id]);
    else if (recurso === 'marcacoes') {
      const punch = normalizeManualPunch(body);
      const collaborator = await tenantRow('colaboradores', punch.colaboradorId, tenantId);
      if (!collaborator) return Response.json({ error: 'Colaborador não encontrado neste condomínio.' }, { status: 404 });
      result = await query(`INSERT INTO ponto_marcacoes(condominio_id,colaborador_id,data_hora,tipo,origem,situacao,observacao,criado_por) VALUES($1,$2,$3,$4,'manual','ajuste',$5,$6) RETURNING *`, [tenantId, punch.colaboradorId, punch.dataHora, punch.tipo, punch.observacao, user.id]);
    } else if (recurso === 'banco') {
      if (!canAdjust(user)) return Response.json({ error: 'Acesso restrito à gestão do banco de horas.' }, { status: 403 });
      const collaborator = await tenantRow('colaboradores', body.colaborador_id, tenantId);
      if (!collaborator || !body.referencia || !Number(body.minutos)) return Response.json({ error: 'Colaborador, referência e minutos são obrigatórios.' }, { status: 400 });
      result = await query(`INSERT INTO ponto_banco_horas(condominio_id,colaborador_id,referencia,tipo,minutos,descricao,origem,criado_por) VALUES($1,$2,$3,$4,$5,$6,'manual',$7) RETURNING *`, [tenantId, body.colaborador_id, body.referencia, body.tipo || (Number(body.minutos) > 0 ? 'credito' : 'debito'), Number(body.minutos), text(body.descricao) || 'Ajuste manual', user.id]);
    } else return Response.json({ error: 'Criação não disponível para este recurso.' }, { status: 405 });
    await audit(request, { condominio_id: tenantId, usuario_id: user.id, acao: recurso === 'marcacoes' ? 'ajuste' : 'criar', modulo: 'ponto', entidade_id: result.rows[0]?.id, descricao: `Registro de ponto criado em ${recurso}` });
    return Response.json({ item: result.rows[0] }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request, { params }) {
  try {
    const user = await requireSession(request);
    if (!canManage(user)) return Response.json({ error: 'Acesso restrito à gestão do Controle de Ponto.' }, { status: 403 });
    const { recurso } = await params; const body = await bodyJson(request); const tenantId = user.condominio_id;
    if (!body.id || !['colaboradores', 'equipamentos', 'jornadas', 'marcacoes'].includes(recurso)) return Response.json({ error: 'Alteração não disponível para este recurso.' }, { status: 400 });
    const table = { colaboradores: 'ponto_colaboradores', equipamentos: 'ponto_equipamentos', jornadas: 'ponto_jornadas', marcacoes: 'ponto_marcacoes' }[recurso];
    const fields = []; const values = []; const add = (column, value) => { fields.push(`${column}=$${values.length + 1}`); values.push(value); };
    if (recurso === 'equipamentos' && body.credencial_integracao !== undefined && !isIntegrationCredentialValid(body.credencial_integracao)) return Response.json({ error: 'A credencial de integração deve ter pelo menos 32 caracteres.' }, { status: 400 });
    if (recurso === 'marcacoes') { add('tipo', body.tipo || 'nao_classificada'); add('situacao', body.situacao || 'ajuste'); add('observacao', text(body.observacao) || null); }
    else {
      const columns = { colaboradores: ['nome','cpf','matricula','cargo','departamento','data_admissao','situacao','jornada_id'], equipamentos: ['nome','fabricante','modelo','ip','porta','firmware','situacao'], jornadas: ['nome','dias_semana','entrada','inicio_intervalo','fim_intervalo','saida','tolerancia_entrada_min','tolerancia_saida_min','tolerancia_intervalo_min','carga_horaria_min'] }[recurso] || [];
      for (const column of columns) if (body[column] !== undefined) add(column, body[column] === '' ? null : body[column]);
    }
    if (!fields.length) return Response.json({ error: 'Nenhum campo para alterar.' }, { status: 400 });
    add('atualizado_por', user.id); fields.push('atualizado_em=now()'); values.push(body.id, tenantId);
    const result = await query(`UPDATE ${table} SET ${fields.join(',')} WHERE id=$${values.length - 1} AND condominio_id=$${values.length} RETURNING ${publicFields[recurso] || 'id'}`, values);
    if (!result.rowCount) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
    await audit(request, { condominio_id: tenantId, usuario_id: user.id, acao: recurso === 'marcacoes' ? 'ajuste' : 'alterar', modulo: 'ponto', entidade_id: body.id, descricao: `Registro de ponto alterado em ${recurso}` });
    return Response.json({ item: result.rows[0] });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireSession(request); if (!canManage(user)) return Response.json({ error: 'Acesso restrito à gestão do Controle de Ponto.' }, { status: 403 });
    const { recurso } = await params; const id = new URL(request.url).searchParams.get('id'); const table = { colaboradores: 'ponto_colaboradores', equipamentos: 'ponto_equipamentos', jornadas: 'ponto_jornadas' }[recurso];
    if (!table || !id) return Response.json({ error: 'Exclusão não disponível.' }, { status: 400 });
    const result = await query(`UPDATE ${table} SET ativo=false,atualizado_por=$1,atualizado_em=now() WHERE id=$2 AND condominio_id=$3 RETURNING id`, [user.id, id, user.condominio_id]);
    if (!result.rowCount) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
    await audit(request, { condominio_id: user.condominio_id, usuario_id: user.id, acao: 'excluir', modulo: 'ponto', entidade_id: id, descricao: `Registro de ponto desativado em ${recurso}` });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
