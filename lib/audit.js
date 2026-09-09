import crypto from 'node:crypto';
import { query } from './db';
export function requestIp(request){return (request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'').split(',')[0].trim()||null}
export function tokenHash(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex')}
export async function audit(request,{condominio_id=null,usuario_id=null,acao,modulo,entidade_id=null,descricao=null,detalhes={}}){
 try{await query(`INSERT INTO auditoria_atividades(condominio_id,usuario_id,acao,modulo,entidade_id,descricao,detalhes,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,[condominio_id,usuario_id,acao,modulo,entidade_id?String(entidade_id):null,descricao,JSON.stringify(detalhes||{}),requestIp(request),request.headers.get('user-agent')||null])}catch(e){console.error('Falha ao gravar auditoria',e)}
}
