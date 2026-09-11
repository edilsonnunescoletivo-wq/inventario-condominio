import {query} from '@/lib/db';
import {hashPassword} from '@/lib/auth';
import {apiError} from '@/lib/session';
import {body,rateLimit,text,fail,transaction} from '@/lib/operacao';
import {hashToken} from '@/lib/recovery';
export const runtime='nodejs';
export async function POST(request){try{
 const b=await body(request);await rateLimit('recovery:'+String(request.headers.get('x-forwarded-for')||'unknown'),30);
 if(b.token){if(!/^[a-f0-9]{64}$/.test(b.token)||typeof b.senha!=='string'||b.senha.length<10||b.senha.length>128)fail('Use o link recebido e uma senha de 10 a 128 caracteres.');const hash=await hashPassword(b.senha);
 await transaction(async c=>{const r=(await c.query('SELECT * FROM recuperacoes_senha WHERE token_hash=$1 AND usado_em IS NULL AND expira_em>now() FOR UPDATE',[hashToken(b.token)])).rows[0];if(!r)fail('Link inválido, expirado ou já utilizado.');const table=r.tipo==='equipe'?'usuarios':'moradores_acessos';await c.query(`UPDATE ${table} SET senha_hash=$1,senha_alterada_em=now() WHERE id=$2 AND ativo=true`,[hash,r.conta_id]);await c.query('UPDATE recuperacoes_senha SET usado_em=now() WHERE conta_id=$1 AND tipo=$2 AND usado_em IS NULL',[r.conta_id,r.tipo]);if(r.tipo==='equipe')await c.query('UPDATE sessoes SET encerrado_em=now() WHERE usuario_id=$1 AND encerrado_em IS NULL',[r.conta_id]);});return Response.json({message:'Senha alterada. Entre com sua nova senha.'});}
 const email=text(b.email,250).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Informe um e-mail válido.');await rateLimit('recovery-email:'+email,3);
 const tipo=b.tipo==='morador'?'morador':'equipe';const accounts=tipo==='equipe'?await query('SELECT id,condominio_id FROM usuarios WHERE lower(email)=$1 AND ativo',[email]):await query('SELECT id,condominio_id FROM moradores_acessos WHERE lower(email)=$1 AND ativo',[email]);
 for(const a of accounts.rows)await query(`INSERT INTO recuperacoes_senha(email,tipo,conta_id,condominio_id) SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM recuperacoes_senha WHERE conta_id=$3 AND tipo=$2 AND usado_em IS NULL AND criado_em>now()-interval '1 hour')`,[email,tipo,a.id,a.condominio_id]);
 return Response.json({message:'Se o e-mail estiver cadastrado, a solicitação ficará disponível para o administrador. Entre em contato com a administração para confirmar sua identidade e receber o link de redefinição.'});
 }catch(e){return apiError(e)}}
