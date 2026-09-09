import { verifyToken } from './auth';
import { query } from './db';
import { tokenHash } from './audit';
export function tokenFromRequest(request){const v=request.headers.get('authorization')||'';return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():null}
function requestedCondo(request){return (request.headers.get('x-condominio-id')||'').trim()||null}
export async function requireSession(request){
 const token=tokenFromRequest(request);if(!token)throw Object.assign(new Error('Não autenticado'),{status:401});
 let payload;try{payload=await verifyToken(token)}catch{throw Object.assign(new Error('Sessão inválida ou expirada'),{status:401})}
 const ur=await query(`SELECT id,nome,email,ativo,condominio_id,is_superadmin FROM usuarios WHERE id=$1`,[payload.sub]);
 const base=ur.rows[0];if(!base||!base.ativo)throw Object.assign(new Error('Usuário inativo'),{status:401});
 const sr=await query(`SELECT 1 FROM sessoes WHERE usuario_id=$1 AND token_hash=$2 AND encerrado_em IS NULL AND expira_em>now() LIMIT 1`,[base.id,tokenHash(token)]);
 if(!sr.rowCount)throw Object.assign(new Error('Sessão encerrada ou expirada'),{status:401});
 const wanted=requestedCondo(request)||base.condominio_id;
 let access;
 if(base.is_superadmin){
   const r=await query(`SELECT c.id condominio_id,'admin'::text perfil,c.nome condominio,c.cnpj,c.ativo condominio_ativo,c.status,c.modulos FROM condominios c WHERE c.id=$1`,[wanted]);access=r.rows[0];
 }else{
   const r=await query(`SELECT uc.condominio_id,uc.perfil,c.nome condominio,c.cnpj,c.ativo condominio_ativo,c.status,c.modulos FROM usuario_condominios uc JOIN condominios c ON c.id=uc.condominio_id WHERE uc.usuario_id=$1 AND uc.condominio_id=$2 AND uc.ativo=true`,[base.id,wanted]);access=r.rows[0];
 }
 if(!access||!access.condominio_ativo||access.status!=='ativo')throw Object.assign(new Error('Sem acesso a este condomínio'),{status:403});
 return {...base,...access,is_superadmin:!!base.is_superadmin};
}
export async function requireAdmin(request){const u=await requireSession(request);if(!u.is_superadmin&&u.perfil!=='admin')throw Object.assign(new Error('Acesso restrito ao administrador'),{status:403});return u}
export async function requireSuperAdmin(request){const u=await requireSession(request);if(!u.is_superadmin)throw Object.assign(new Error('Acesso restrito ao Super Administrador'),{status:403});return u}
export function apiError(error){console.error(error);const status=error?.status||500;return Response.json({error:status===500?'Erro interno do servidor':error.message},{status})}
