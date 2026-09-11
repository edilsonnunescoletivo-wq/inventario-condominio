import {query} from '@/lib/db';
import {verifyPassword,signToken} from '@/lib/auth';
import {apiError} from '@/lib/session';
import {residentSession} from '@/lib/morador-session';
import {body,fail,text,rateLimit,files,numberCode,uuid} from '@/lib/operacao';
import {saveReservation} from '@/lib/operacao-services';
export const runtime='nodejs';
export async function GET(request){try{
 const u=await residentSession(request);const [areas,reservas,agenda,bloqueios,comunicados,pedidos]=await Promise.all([
 query('SELECT id,nome,regulamento,valor_taxa,regras,capacidade FROM areas_reservaveis WHERE condominio_id=$1 AND ativo ORDER BY nome',[u.condominio_id]),
 query('SELECT id,area_id,responsavel,inicio,fim,status,tipo_evento,valor_total,valor_pago,valor_restante FROM reservas WHERE condominio_id=$1 AND morador_id=$2 ORDER BY inicio DESC LIMIT 100',[u.condominio_id,u.morador_id]),
 query("SELECT area_id,inicio,fim FROM reservas WHERE condominio_id=$1 AND status='confirmada' AND fim>=now() ORDER BY inicio LIMIT 2000",[u.condominio_id]),
 query('SELECT area_id,inicio,fim,motivo FROM reservas_bloqueios WHERE condominio_id=$1 AND ativo AND fim>=now() ORDER BY inicio',[u.condominio_id]),
 query(`SELECT c.id,c.titulo,c.mensagem,c.versao,c.anexos,c.publicado_em,EXISTS(SELECT 1 FROM comunicados_leituras l WHERE l.comunicado_id=c.id AND l.leitor_id=$2 AND l.tipo='morador' AND l.versao=c.versao) lido FROM comunicados c WHERE c.condominio_id=$1 AND c.publicado AND (c.agendado_em IS NULL OR c.agendado_em<=now()) AND c.publico IN ('todos','moradores') ORDER BY c.criado_em DESC LIMIT 100`,[u.condominio_id,u.id]),
 query('SELECT id,protocolo,titulo,descricao,status,criado_em,resolvido_em FROM ocorrencias WHERE condominio_id=$1 AND anexos->>\'morador_id\'=$2 ORDER BY criado_em DESC LIMIT 100',[u.condominio_id,u.morador_id])]);
 const {senha_alterada_em,...profile}=u;return Response.json({user:profile,areas:areas.rows,reservas:reservas.rows,agenda:agenda.rows,bloqueios:bloqueios.rows,comunicados:comunicados.rows,pedidos:pedidos.rows});
 }catch(e){return apiError(e)}}
export async function POST(request,{params}){try{
 const {action}=await params;const b=await body(request);
 if(action==='login'){const email=text(b.email,250).toLowerCase();await rateLimit('morador-login:'+email+':'+String(request.headers.get('x-forwarded-for')||'unknown'),20);const cnpj=text(b.cnpj).replace(/\D/g,'');if(cnpj.length!==14)fail('Informe o CNPJ do condomínio.');const a=(await query(`SELECT a.id,a.email,a.senha_hash,m.nome FROM moradores_acessos a JOIN condominios c ON c.id=a.condominio_id JOIN moradores m ON m.id=a.morador_id WHERE lower(a.email)=$1 AND regexp_replace(c.cnpj,'[^0-9]','','g')=$2 AND a.ativo AND m.ativo AND c.ativo AND c.status='ativo'`,[email,cnpj])).rows[0];if(!a||typeof b.senha!=='string'||!(await verifyPassword(b.senha,a.senha_hash)))fail('E-mail, senha ou condomínio inválidos.',401);return Response.json({token:await signToken({...a,kind:'morador'})});}
 const u=await residentSession(request);
 if(action==='reserva'){const item=await saveReservation({condominio_id:u.condominio_id},b,u);return Response.json({item:{id:item.id}});}
 if(action==='pedido'){if(!text(b.titulo)||!text(b.descricao))fail('Informe título e descrição.');const fotos=files(b.fotos,true);const item=(await query(`INSERT INTO ocorrencias(condominio_id,protocolo,titulo,descricao,categoria,prioridade,status,unidade,anexos) VALUES($1,$2,$3,$4,'Morador','media','aberta',$5,$6) RETURNING id,protocolo`,[u.condominio_id,numberCode('OC'),text(b.titulo,200),text(b.descricao),`${u.bloco||''} ${u.unidade}`.trim(),JSON.stringify({morador_id:u.morador_id,fotos})])).rows[0];return Response.json({item});}
 if(action==='leitura'){const n=(await query(`SELECT id,versao FROM comunicados WHERE id=$1 AND condominio_id=$2 AND publicado AND (agendado_em IS NULL OR agendado_em<=now()) AND publico IN ('todos','moradores')`,[uuid(b.id),u.condominio_id])).rows[0];if(!n)fail('Comunicado indisponível.',404);await query("INSERT INTO comunicados_leituras(comunicado_id,condominio_id,leitor_id,tipo,versao) VALUES($1,$2,$3,'morador',$4) ON CONFLICT DO NOTHING",[n.id,u.condominio_id,u.id,n.versao]);return Response.json({ok:true});}
 fail('Operação indisponível.',404);
 }catch(e){return apiError(e)}}
