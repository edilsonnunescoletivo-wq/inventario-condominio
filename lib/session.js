import { verifyToken } from './auth';
import { tokenHash } from './audit';
import { query } from './db';
import { licenseIsActive } from './licensing';
export function tokenFromRequest(request){const v=request.headers.get('authorization')||'';return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():null}
function requestedCondo(request){return (request.headers.get('x-condominio-id')||'').trim()||null}
async function account(id){
 const r=await query(`SELECT id,nome,email,ativo,condominio_id,is_superadmin,senha_alterada_em FROM usuarios WHERE id=$1`,[id]);
 const base=r.rows[0];if(!base)return null;
 try{const x=await query(`SELECT tipo_conta,sindico_id,licenca_status,licenca_inicio,licenca_fim,limite_condominios FROM usuarios WHERE id=$1`,[id]);return {...base,...x.rows[0]}}
 catch{return {...base,tipo_conta:base.is_superadmin?'superadmin':'equipe',sindico_id:null,licenca_status:base.is_superadmin?'ativo':null,licenca_inicio:null,licenca_fim:null,limite_condominios:0}}
}
export async function requireSession(request){
 const token=tokenFromRequest(request);if(!token)throw Object.assign(new Error('Não autenticado'),{status:401});
 let payload;try{payload=await verifyToken(token)}catch{throw Object.assign(new Error('Sessão inválida ou expirada'),{status:401})}
 if(payload.kind==='morador')throw Object.assign(new Error('Acesso restrito à equipe.'),{status:403});
 const ended=await query('SELECT 1 FROM sessoes WHERE token_hash=$1 AND encerrado_em IS NOT NULL',[tokenHash(token)]);if(ended.rowCount)throw Object.assign(new Error('Sessão encerrada.'),{status:401});
 const base=await account(payload.sub);if(!base||!base.ativo)throw Object.assign(new Error('Usuário inativo'),{status:401});
 if(base.senha_alterada_em&&payload.iat<=Math.floor(new Date(base.senha_alterada_em).getTime()/1000))throw Object.assign(new Error('Entre com sua nova senha.'),{status:401});
 if(base.tipo_conta==='sindico'&&!licenseIsActive(base))throw Object.assign(new Error('Licença pendente, suspensa ou vencida. Procure o Super Administrador.'),{status:403});
 if(base.tipo_conta==='equipe'&&base.sindico_id){const sr=await account(base.sindico_id);if(!licenseIsActive(sr))throw Object.assign(new Error('A licença do síndico responsável está inativa ou vencida.'),{status:403})}
 const wanted=requestedCondo(request)||base.condominio_id;let access;
 if(base.is_superadmin){const r=await query(`SELECT c.id condominio_id,'admin'::text perfil,c.nome condominio,c.cnpj,c.ativo condominio_ativo,c.status,c.modulos FROM condominios c WHERE c.id=$1`,[wanted]);access=r.rows[0]}
 else if(base.tipo_conta==='sindico'){const r=await query(`SELECT c.id condominio_id,'admin'::text perfil,c.nome condominio,c.cnpj,c.ativo condominio_ativo,c.status,c.modulos FROM condominios c WHERE c.id=$1 AND c.sindico_id=$2`,[wanted,base.id]);access=r.rows[0]}
 else{const r=await query(`SELECT uc.condominio_id,uc.perfil,c.nome condominio,c.cnpj,c.ativo condominio_ativo,c.status,c.modulos FROM usuario_condominios uc JOIN condominios c ON c.id=uc.condominio_id WHERE uc.usuario_id=$1 AND uc.condominio_id=$2 AND uc.ativo=true`,[base.id,wanted]);access=r.rows[0]}
 if(!access||!access.condominio_ativo||access.status!=='ativo')throw Object.assign(new Error('Sem acesso a este condomínio'),{status:403});
 return {...base,...access,is_superadmin:!!base.is_superadmin};
}
export async function requireAdmin(request){const u=await requireSession(request);if(!u.is_superadmin&&u.tipo_conta!=='sindico'&&u.perfil!=='admin')throw Object.assign(new Error('Acesso restrito ao administrador'),{status:403});return u}
export async function requireSuperAdmin(request){const u=await requireSession(request);if(!u.is_superadmin)throw Object.assign(new Error('Acesso restrito ao Super Administrador'),{status:403});return u}
export function apiError(error){if((error?.status||500)>=500)console.error(error);const status=error?.status||500;return Response.json({error:status===500?'Erro interno do servidor':error.message},{status})}
