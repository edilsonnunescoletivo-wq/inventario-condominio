import { query } from './db';

export const TEAM_LIMIT_PER_CONDO = 4;
const err=(message,status=403)=>Object.assign(new Error(message),{status});

export function licenseIsActive(user){
 if(user?.is_superadmin||user?.tipo_conta==='superadmin') return true;
 if(user?.tipo_conta!=='sindico') return true;
 if(user.licenca_status!=='ativo') return false;
 if(!user.licenca_inicio||!user.licenca_fim) return false;
 const today=new Date().toISOString().slice(0,10);
 return String(user.licenca_inicio).slice(0,10)<=today && String(user.licenca_fim).slice(0,10)>=today;
}

export async function requireActiveSyndic(userId){
 const r=await query(`SELECT id,nome,email,ativo,is_superadmin,tipo_conta,licenca_status,licenca_inicio,licenca_fim,limite_condominios FROM usuarios WHERE id=$1`,[userId]);
 const u=r.rows[0];
 if(!u||!u.ativo||u.tipo_conta!=='sindico') throw err('Conta de síndico inválida.');
 if(!licenseIsActive(u)) throw err('Licença pendente, suspensa ou vencida. Procure o Super Administrador.');
 return u;
}

export async function assertCondoCapacity(sindicoId){
 const s=await requireActiveSyndic(sindicoId);
 const r=await query(`SELECT count(*)::int total FROM condominios WHERE sindico_id=$1`,[sindicoId]);
 if(r.rows[0].total>=s.limite_condominios) throw err(`Limite de ${s.limite_condominios} condomínio(s) da licença atingido.`,409);
 return s;
}

export async function assertTeamCapacity(condominioId){
 const r=await query(`SELECT count(DISTINCT uc.usuario_id)::int total FROM usuario_condominios uc JOIN usuarios u ON u.id=uc.usuario_id WHERE uc.condominio_id=$1 AND uc.ativo=true AND COALESCE(u.tipo_conta,'equipe')='equipe'`,[condominioId]);
 if(r.rows[0].total>=TEAM_LIMIT_PER_CONDO) throw err(`Limite de ${TEAM_LIMIT_PER_CONDO} membros da equipe atingido para este condomínio.`,409);
}
