import crypto from 'node:crypto';
import {query} from './db';
import {transaction,fail,uuid} from './operacao';
export const hashToken=t=>crypto.createHash('sha256').update(t).digest('hex');
export async function issueRecovery(u,id){return transaction(async c=>{
 const r=(await c.query('SELECT * FROM recuperacoes_senha WHERE id=$1 AND condominio_id=$2 AND usado_em IS NULL FOR UPDATE',[uuid(id),u.condominio_id])).rows[0];if(!r)fail('Solicitação não encontrada.',404);
 if(r.tipo==='equipe'&&!u.is_superadmin){const target=(await c.query('SELECT is_superadmin,(SELECT count(*) FROM usuario_condominios WHERE usuario_id=$1 AND ativo) acessos FROM usuarios WHERE id=$1',[r.conta_id])).rows[0];if(target?.is_superadmin||Number(target?.acessos)>1)fail('Esta conta precisa ser atendida pelo Super Administrador.',403);}
 const token=crypto.randomBytes(32).toString('hex');await c.query("UPDATE recuperacoes_senha SET token_hash=$1,expira_em=now()+interval '30 minutes',atendido_por=$2 WHERE id=$3",[hashToken(token),u.id,r.id]);
 return {link:`${process.env.APP_URL||'https://www.solucoescondo.com.br'}/recuperar-senha?token=${token}`,email:r.email,expira_minutos:30};
})}
