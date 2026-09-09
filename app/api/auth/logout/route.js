import { query } from '@/lib/db';
import { requireSession,apiError,tokenFromRequest } from '@/lib/session';
import { audit,tokenHash } from '@/lib/audit';
export const runtime='nodejs';
export async function POST(request){try{const u=await requireSession(request);const token=tokenFromRequest(request);await query(`UPDATE sessoes SET encerrado_em=now() WHERE token_hash=$1 AND encerrado_em IS NULL`,[tokenHash(token)]);await audit(request,{condominio_id:u.condominio_id,usuario_id:u.id,acao:'logout',modulo:'auth',descricao:'Sessão encerrada'});return Response.json({ok:true})}catch(e){return apiError(e)}}
