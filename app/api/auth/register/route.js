import { pool, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { apiError } from '@/lib/session';

export const runtime='nodejs';
export async function POST(request){
  const client=await pool.connect();
  try{
    const {nome,email,senha,chave}=await request.json();
    const n=String(nome||'').trim(), em=String(email||'').trim().toLowerCase(), key=String(chave||'').trim().toUpperCase();
    if(n.length<2||!em.includes('@')||String(senha||'').length<6||!key) return Response.json({error:'Preencha os dados corretamente.'},{status:400});
    await client.query('BEGIN');
    const kr=await client.query(`SELECT k.*,c.ativo AS condominio_ativo FROM chaves_ativacao k JOIN condominios c ON c.id=k.condominio_id WHERE upper(k.chave)=upper($1) FOR UPDATE`,[key]);
    const k=kr.rows[0];
    if(!k||!k.ativa||!k.condominio_ativo) throw Object.assign(new Error('Chave de ativação inválida ou inativa.'),{status:400});
    if(k.expira_em&&new Date(k.expira_em)<new Date()) throw Object.assign(new Error('Chave de ativação expirada.'),{status:400});
    const count=await client.query('SELECT count(*)::int AS total FROM usuarios WHERE condominio_id=$1',[k.condominio_id]);
    if(count.rows[0].total>=k.max_usuarios) throw Object.assign(new Error('Limite de usuários desta chave atingido.'),{status:400});
    const dupe=await client.query('SELECT 1 FROM usuarios WHERE condominio_id=$1 AND lower(email)=lower($2)',[k.condominio_id,em]);
    if(dupe.rowCount) throw Object.assign(new Error('Este e-mail já está cadastrado.'),{status:409});
    const hash=await hashPassword(senha);
    await client.query(`INSERT INTO usuarios(condominio_id,nome,email,senha_hash,perfil,ativo) VALUES($1,$2,$3,$4,'usuario',true)`,[k.condominio_id,n,em,hash]);
    await client.query('COMMIT');
    return Response.json({ok:true},{status:201});
  }catch(e){try{await client.query('ROLLBACK')}catch{};return apiError(e)}finally{client.release()}
}
