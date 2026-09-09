import { query } from '@/lib/db';
import { signToken, verifyPassword } from '@/lib/auth';
import { apiError } from '@/lib/session';
import { audit,requestIp,tokenHash } from '@/lib/audit';
export const runtime='nodejs';
export async function POST(request){try{
 const {email,senha}=await request.json();const normalized=String(email||'').trim().toLowerCase();if(!normalized||!senha)return Response.json({error:'Informe e-mail e senha.'},{status:400});
 const r=await query(`SELECT id,nome,email,senha_hash,ativo,condominio_id,is_superadmin FROM usuarios WHERE lower(email)=lower($1) ORDER BY criado_em LIMIT 1`,[normalized]);const u=r.rows[0];
 if(!u||!u.ativo||!(await verifyPassword(senha,u.senha_hash))){await audit(request,{usuario_id:u?.id||null,condominio_id:u?.condominio_id||null,acao:'login_falha',modulo:'auth',descricao:'Tentativa de login sem sucesso',detalhes:{email:normalized}});return Response.json({error:'E-mail ou senha inválidos.'},{status:401});}
 const access=await query(`SELECT uc.condominio_id,uc.perfil,c.nome,c.status FROM usuario_condominios uc JOIN condominios c ON c.id=uc.condominio_id WHERE uc.usuario_id=$1 AND uc.ativo=true AND c.ativo=true AND c.status='ativo' ORDER BY c.nome`,[u.id]);
 if(!u.is_superadmin&&!access.rowCount)return Response.json({error:'Usuário sem condomínio ativo.'},{status:403});
 const token=await signToken(u);await query(`INSERT INTO sessoes(usuario_id,condominio_id,token_hash,expira_em,ip,user_agent,ultimo_acesso_em) VALUES($1,$2,$3,now()+interval '12 hours',$4,$5,now())`,[u.id,u.condominio_id,tokenHash(token),requestIp(request),request.headers.get('user-agent')||null]);await audit(request,{usuario_id:u.id,condominio_id:u.condominio_id,acao:'login_sucesso',modulo:'auth',descricao:'Login realizado'});return Response.json({token,user:{id:u.id,nome:u.nome,email:u.email,is_superadmin:u.is_superadmin},condominios:access.rows});
}catch(e){return apiError(e)}}
