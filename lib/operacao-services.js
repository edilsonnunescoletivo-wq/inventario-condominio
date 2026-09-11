import {query} from './db';
import {fail,text,uuid,amount,files,transaction,own,event,numberCode,localDate} from './operacao';

export async function executeChecklist(u,b){return transaction(async c=>{
 const model=await own(c,'checklist_modelos',b.modelo_id,u.condominio_id);
 const items=(await c.query('SELECT * FROM checklist_modelo_itens WHERE modelo_id=$1 ORDER BY ordem',[model.id])).rows;
 if(!items.length)fail('Este modelo não possui itens.');
 if(!Array.isArray(b.respostas)||b.respostas.length!==items.length)fail('Responda todos os itens.');
 const seen=new Set();for(const item of items){const a=b.respostas.find(x=>String(x.item_id)===String(item.id));if(!a||seen.has(String(a.item_id))||!['ok','nao_ok','na'].includes(a.resposta))fail('Responda cada item uma vez.');seen.add(String(a.item_id));a.fotos=files(a.fotos,true);if(a.fotos.length>1)fail('Use uma foto por item do checklist.');if(item.exige_foto&&!a.fotos.length)fail(`Anexe uma foto: ${item.descricao}`);if(a.resposta==='nao_ok'&&!text(a.observacao))fail('Descreva cada irregularidade encontrada.');}
 if(b.inventario_id)await own(c,'inventario',b.inventario_id,u.condominio_id);
 const e=(await c.query('INSERT INTO checklist_execucoes(condominio_id,modelo_id,executado_por,observacoes) VALUES($1,$2,$3,$4) RETURNING *',[u.condominio_id,model.id,u.id,text(b.observacoes)])).rows[0];
 const os=[];for(const item of items){const a=b.respostas.find(x=>String(x.item_id)===String(item.id));await c.query('INSERT INTO checklist_respostas(execucao_id,item_id,resposta,observacao,foto_data_url,condominio_id) VALUES($1,$2,$3,$4,$5,$6)',[e.id,item.id,a.resposta,text(a.observacao),a.fotos[0]?.data||null,u.condominio_id]);
 if(a.resposta==='nao_ok'&&b.gerar_os){const o=(await c.query(`INSERT INTO ordens_servico(condominio_id,numero_os,titulo,descricao,prioridade,status,responsavel,inventario_id,fotos_antes,criado_por,atualizado_por,checklist_execucao_id) VALUES($1,$2,$3,$4,'media','aberta',$5,$6,$7,$8,$8,$9) RETURNING id,numero_os`,[u.condominio_id,numberCode('OS'),text(`${model.nome}: ${item.descricao}`,200),text(a.observacao),text(b.responsavel,200)||null,b.inventario_id||null,JSON.stringify(a.fotos),u.id,e.id])).rows[0];os.push(o);await event(c,u,'os',o.id,'abertura_checklist',{execucao_id:e.id});}}
 await event(c,u,'checklists',e.id,'executado',{modelo:model.nome,ordens:os});return {...e,ordens:os};
})}

export async function updateWorkOrder(u,b){return transaction(async c=>{
 const o=await own(c,'ordens_servico',b.id,u.condominio_id,true),manager=u.is_superadmin||['admin','gerente','supervisor'].includes(u.perfil);
 if(['aprovar','devolver'].includes(b.acao)){
  if(!manager)fail('Somente a gestão pode validar a execução.',403);
  if(o.revisao?.situacao!=='pendente')fail('Esta OS não está aguardando validação.',409);
  if(!text(b.parecer))fail('Registre o parecer da revisão.');
  if(b.acao==='aprovar'){
   if(o.estoque_baixado_em)fail('O estoque desta OS já foi movimentado.',409);
   for(const item of [...(o.consumo_itens||[])].sort((a,b)=>a.material_id.localeCompare(b.material_id))){const m=await own(c,'materiais',item.material_id,u.condominio_id,true);const qtd=amount(item.quantidade);if(qtd<=0||Number(m.estoque_atual)<qtd)fail(`Estoque insuficiente: ${m.nome}.`);const novo=Number(m.estoque_atual)-qtd;
    await c.query('UPDATE materiais SET estoque_atual=$1,atualizado_por=$2,atualizado_em=now() WHERE id=$3 AND condominio_id=$4',[novo,u.id,m.id,u.condominio_id]);
    await c.query(`INSERT INTO movimentacoes_materiais(material_id,condominio_id,usuario_id,tipo,quantidade,saldo_anterior,saldo_novo,destino_origem,observacoes) VALUES($1,$2,$3,'saida',$4,$5,$6,$7,$8)`,[m.id,u.condominio_id,u.id,qtd,m.estoque_atual,novo,o.numero_os,'Consumo confirmado na aprovação da OS']);
   }
  }
  const revisao={...o.revisao,situacao:b.acao==='aprovar'?'aprovada':'devolvida',parecer:text(b.parecer),revisor:u.nome,revisado_em:new Date().toISOString()};
  await c.query(`UPDATE ordens_servico SET status=$1,revisao=$2,data_conclusao=CASE WHEN $1='concluida' THEN now() ELSE NULL END,estoque_baixado_em=CASE WHEN $1='concluida' THEN now() ELSE estoque_baixado_em END,atualizado_por=$3 WHERE id=$4 AND condominio_id=$5`,[b.acao==='aprovar'?'concluida':'em_andamento',JSON.stringify(revisao),u.id,o.id,u.condominio_id]);
  if(b.acao==='aprovar'&&o.manutencao_plano_id)await c.query(`UPDATE manutencoes_planos SET ultima_execucao=current_date,proxima_execucao=current_date+periodicidade_dias,atualizado_em=now() WHERE id=$1 AND condominio_id=$2`,[o.manutencao_plano_id,u.condominio_id]);
  await event(c,u,'os',o.id,b.acao,{parecer:text(b.parecer),custo_real:o.custo_real});return {id:o.id};
 }
 if(!['salvar','executar'].includes(b.acao))fail('Ação inválida.');
 if(o.status==='concluida'||o.status==='cancelada'||o.revisao?.situacao==='pendente')fail('Esta OS não permite alteração nesta etapa.',409);
 const antes=files(b.fotos_antes,true),depois=files(b.fotos_depois,true),custo=amount(b.custo_real||0),relato=text(b.relato);
 if(b.acao==='executar'&&!relato)fail('Descreva o serviço realizado.');
 const consumo=b.consumo_itens||[];if(!Array.isArray(consumo)||consumo.length>50)fail('Lista de materiais inválida.');const ids=new Set();for(const item of consumo){await own(c,'materiais',item.material_id,u.condominio_id);if(ids.has(item.material_id)||amount(item.quantidade)<=0)fail('Use cada material uma vez e informe quantidade positiva.');ids.add(item.material_id)}
 const revisao={situacao:b.acao==='executar'?'pendente':'rascunho',relato,executor:u.nome,registrado_em:new Date().toISOString()};
 await c.query(`UPDATE ordens_servico SET fotos_antes=$1,fotos_depois=$2,custo_real=$3,consumo_itens=$4,revisao=$5,status=$6,atualizado_por=$7 WHERE id=$8 AND condominio_id=$9`,[JSON.stringify(antes),JSON.stringify(depois),custo,JSON.stringify(consumo.map(i=>({material_id:i.material_id,quantidade:Number(i.quantidade)}))),JSON.stringify(revisao),b.acao==='executar'?'aguardando':'em_andamento',u.id,o.id,u.condominio_id]);
 await event(c,u,'os',o.id,b.acao,{relato,custo_real:custo,materiais:consumo.length});return {id:o.id};
})}

export async function saveReservation(u,b,resident=null){return transaction(async c=>{
 await c.query("SELECT set_config('solucoes.reserva_horario_explicito','on',true)");
 let current=null;if(b.id)current=await own(c,'reservas',b.id,u.condominio_id,true);
 if(resident&&current&&current.morador_id!==resident.morador_id)fail('Reserva não encontrada.',404);
 const area=await own(c,'areas_reservaveis',b.area_id||current?.area_id,u.condominio_id,true);const rules=area.regras||{};
 if(resident&&current){if(b.acao!=='cancelar')fail('Somente o cancelamento está disponível.');const hours=(new Date(current.inicio)-Date.now())/3600000;if(hours<Number(rules.cancelamento_horas||0))fail(`Cancelamento permitido até ${rules.cancelamento_horas} horas antes, conforme a regra do espaço.`);if(current.status!=='confirmada')fail('Esta reserva não pode ser cancelada.');await c.query("UPDATE reservas SET status='cancelada',atualizado_em=now() WHERE id=$1 AND condominio_id=$2",[current.id,u.condominio_id]);return current;}
 const start=localDate(b.inicio),end=localDate(b.fim);if(end<=start)fail('O término deve ser posterior ao início.');
 const status=resident?'confirmada':(['confirmada','realizada','cancelada'].includes(b.status)?b.status:'confirmada');
 const rescheduled=!current||current.status!=='confirmada'||current.area_id!==area.id||new Date(current.inicio).getTime()!==start.getTime()||new Date(current.fim).getTime()!==end.getTime();
 const unidade=resident?.unidade_id||b.unidade_id||null;if(unidade)await own(c,'unidades',unidade,u.condominio_id);
 if(status==='confirmada'){
  const conflict=await c.query(`SELECT id FROM reservas WHERE condominio_id=$1 AND area_id=$2 AND status='confirmada' AND inicio<$4 AND fim>$3 AND ($5::uuid IS NULL OR id<>$5) LIMIT 1`,[u.condominio_id,area.id,start,end,b.id||null]);if(conflict.rowCount)fail('Este horário já está reservado. Escolha outro período.',409);
  const block=await c.query('SELECT motivo FROM reservas_bloqueios WHERE condominio_id=$1 AND area_id=$2 AND ativo=true AND inicio<$4 AND fim>$3 LIMIT 1',[u.condominio_id,area.id,start,end]);if(block.rowCount)fail(`Espaço indisponível: ${block.rows[0].motivo}`,409);
  if(rescheduled&&start<=new Date())fail('Escolha uma data futura.');
  if(rescheduled&&(start-Date.now())/3600000<Number(rules.antecedencia_horas||0))fail(`Este espaço exige antecedência mínima de ${rules.antecedencia_horas} horas.`);
  if(rules.duracao_max_horas&&(end-start)/3600000>Number(rules.duracao_max_horas))fail(`Duração máxima permitida: ${rules.duracao_max_horas} horas.`);
  const localStart=new Date(start.getTime()-10800000).toISOString(),localEnd=new Date(end.getTime()-10800000).toISOString();
  if(rules.abertura&&rules.fechamento&&(localStart.slice(0,10)!==localEnd.slice(0,10)||localStart.slice(11,16)<rules.abertura||localEnd.slice(11,16)>rules.fechamento))fail(`Horário permitido: ${rules.abertura} às ${rules.fechamento}, no mesmo dia.`);
  if(rules.limite_mensal&&unidade){const n=await c.query(`SELECT count(*)::int n FROM reservas WHERE condominio_id=$1 AND area_id=$2 AND unidade_id=$3 AND status<>'cancelada' AND date_trunc('month',inicio AT TIME ZONE 'America/Bahia')=date_trunc('month',$4::timestamptz AT TIME ZONE 'America/Bahia') AND ($5::uuid IS NULL OR id<>$5)`,[u.condominio_id,area.id,unidade,start,b.id||null]);if(n.rows[0].n>=Number(rules.limite_mensal))fail(`Limite de ${rules.limite_mensal} reserva(s) por unidade no mês atingido, conforme a regra deste espaço.`);}
  if(area.regulamento&&!b.aceite)fail('Leia e aceite o regulamento do espaço.');
 }
 const total=resident?Number(area.valor_taxa||0):amount(b.valor_total||0),paid=resident?0:amount(b.valor_pago||0);if(paid>total)fail('O valor pago não pode superar o total.');
 const email=resident?.email||text(b.email_solicitante,250);if(!email||email.split(';').some(x=>!/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(x)))fail('Informe um e-mail válido.');
 const who=resident?.nome||text(b.responsavel,200);if(!who||!text(b.tipo_evento,100))fail('Informe o responsável e o tipo de evento.');
 const accepted=b.aceite?{regulamento:area.regulamento||'',regras:rules,em:new Date().toISOString(),nome:who}:current?.aceite_regulamento||null;
 const vals=[u.condominio_id,area.id,unidade,who,start,end,status,text(b.observacoes),text(b.tipo_evento,100),email,text(b.whatsapp_solicitante,20).replace(/\D/g,''),total,paid,JSON.stringify(accepted),resident?.morador_id||current?.morador_id||null];
 if(current)return (await c.query(`UPDATE reservas SET area_id=$2,unidade_id=$3,responsavel=$4,inicio=$5,fim=$6,status=$7,observacoes=$8,tipo_evento=$9,email_solicitante=$10,whatsapp_solicitante=$11,valor_total=$12,valor_pago=$13,aceite_regulamento=$14,morador_id=$15,atualizado_em=now(),lembrete_enviado_em=CASE WHEN inicio<>$5::timestamptz THEN NULL ELSE lembrete_enviado_em END WHERE condominio_id=$1 AND id=$16 RETURNING *`,[...vals,current.id])).rows[0];
 return (await c.query(`INSERT INTO reservas(condominio_id,area_id,unidade_id,responsavel,inicio,fim,status,observacoes,tipo_evento,email_solicitante,whatsapp_solicitante,valor_total,valor_pago,aceite_regulamento,morador_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,vals)).rows[0];
})}

export async function saveNotice(u,b){return transaction(async c=>{
 if(!u.is_superadmin&&!['admin','gerente','supervisor'].includes(u.perfil))fail('Acesso restrito à gestão.',403);
 if(!text(b.titulo,200)||!text(b.mensagem,15000))fail('Informe título e mensagem.');if(!['todos','moradores','equipe','administracao'].includes(b.publico))fail('Público inválido.');
 const scheduled=b.agendado_em?localDate(b.agendado_em):null;const attachments=files(b.anexos);let notice;
 if(b.id){const old=await own(c,'comunicados',b.id,u.condominio_id,true);if(Number(b.versao)!==old.versao)fail('Outra pessoa alterou este comunicado. Atualize a página.',409);await c.query('INSERT INTO comunicados_versoes(condominio_id,comunicado_id,versao,dados,usuario_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[u.condominio_id,old.id,old.versao,JSON.stringify(old),u.id]);notice=(await c.query(`UPDATE comunicados SET titulo=$1,mensagem=$2,publico=$3,publicado=$4,agendado_em=$5,anexos=$6,versao=versao+1,publicado_em=CASE WHEN $4 THEN now() ELSE NULL END WHERE id=$7 AND condominio_id=$8 RETURNING *`,[text(b.titulo,200),text(b.mensagem,15000),b.publico,!!b.publicado,scheduled,JSON.stringify(attachments),old.id,u.condominio_id])).rows[0];}
 else notice=(await c.query(`INSERT INTO comunicados(condominio_id,titulo,mensagem,publico,publicado,agendado_em,anexos,criado_por,publicado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $5 THEN now() ELSE NULL END) RETURNING *`,[u.condominio_id,text(b.titulo,200),text(b.mensagem,15000),b.publico,!!b.publicado,scheduled,JSON.stringify(attachments),u.id])).rows[0];
 await event(c,u,'comunicados',notice.id,'salvar',{versao:notice.versao,titulo:notice.titulo});return notice;
})}
export async function alerts(u){const id=u.condominio_id;const r=await query(`
 SELECT 'os' modulo,id::text id,numero_os||' — '||titulo titulo,prazo vencimento,'Prazo da OS vencido' motivo FROM ordens_servico WHERE condominio_id=$1 AND status NOT IN ('concluida','cancelada') AND prazo<now()
 UNION ALL SELECT 'manutencoes',id::text,titulo,proxima_execucao::timestamptz,'Manutenção vence em até 7 dias' FROM manutencoes_planos WHERE condominio_id=$1 AND ativo AND proxima_execucao<=current_date+7
 UNION ALL SELECT 'documentos',id::text,titulo,validade::timestamptz,'Validade do documento' FROM documentos_condominio WHERE condominio_id=$1 AND ativo AND validade<=current_date+30
 UNION ALL SELECT 'estoque',id::text,nome,now(),'Estoque no mínimo ou abaixo' FROM materiais WHERE condominio_id=$1 AND ativo AND estoque_atual<=estoque_minimo
 UNION ALL SELECT 'ferramentas',e.id::text,f.nome,e.previsao_devolucao,'Devolução atrasada' FROM emprestimos_ferramentas e JOIN ferramentas f ON f.id=e.ferramenta_id AND f.condominio_id=e.condominio_id WHERE e.condominio_id=$1 AND e.status='aberto' AND e.previsao_devolucao<now()
 UNION ALL SELECT 'os',id::text,numero_os||' — '||titulo,data_abertura,'Execução aguardando validação' FROM ordens_servico WHERE condominio_id=$1 AND revisao->>'situacao'='pendente'
 ORDER BY vencimento LIMIT 200`,[id]);const seen=(await query('SELECT * FROM alertas_acompanhamento WHERE condominio_id=$1',[id])).rows;return r.rows.map(x=>({...x,chave:x.modulo+':'+x.id,acompanhamento:seen.find(s=>s.chave===x.modulo+':'+x.id)}));}
