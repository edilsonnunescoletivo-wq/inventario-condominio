import { query } from '@/lib/db';
import { requireSession, apiError } from '@/lib/session';
export const runtime='nodejs';
export async function GET(request){try{
  const u=await requireSession(request), id=u.condominio_id;
  const [os,man,est,oco,doc,con,fer,res,alerts]=await Promise.all([
    query(`SELECT count(*)::int n FROM ordens_servico WHERE condominio_id=$1 AND status IN ('aberta','em_andamento','aguardando')`,[id]),
    query(`SELECT count(*)::int n FROM manutencoes_planos WHERE condominio_id=$1 AND ativo=true AND proxima_execucao<current_date`,[id]),
    query(`SELECT count(*)::int n FROM materiais WHERE condominio_id=$1 AND ativo=true AND estoque_atual<=estoque_minimo`,[id]),
    query(`SELECT count(*)::int n FROM ocorrencias WHERE condominio_id=$1 AND status NOT IN ('resolvida','arquivada')`,[id]),
    query(`SELECT count(*)::int n FROM documentos_condominio WHERE condominio_id=$1 AND ativo=true AND validade BETWEEN current_date AND current_date+30`,[id]),
    query(`SELECT count(*)::int n FROM contratos WHERE condominio_id=$1 AND ativo=true AND fim BETWEEN current_date AND current_date+30`,[id]),
    query(`SELECT count(*)::int n FROM emprestimos_ferramentas WHERE condominio_id=$1 AND status='aberto'`,[id]),
    query(`SELECT count(*)::int n FROM reservas WHERE condominio_id=$1 AND status='confirmada' AND inicio>=now() AND inicio<now()+interval '30 days'`,[id]),
    query(`SELECT 'OS' tipo,numero_os ref,titulo,prioridade,status,data_abertura::text data FROM ordens_servico WHERE condominio_id=$1 AND status IN ('aberta','em_andamento','aguardando') AND prioridade IN ('alta','critica')
           UNION ALL SELECT 'Ocorrência',protocolo,titulo,prioridade,status,criado_em::text FROM ocorrencias WHERE condominio_id=$1 AND status NOT IN ('resolvida','arquivada') AND prioridade IN ('alta','critica')
           ORDER BY data DESC LIMIT 8`,[id])
  ]);
  return Response.json({metrics:{os:os.rows[0].n,manutencoes:man.rows[0].n,estoque:est.rows[0].n,ocorrencias:oco.rows[0].n,documentos:doc.rows[0].n,contratos:con.rows[0].n,ferramentas:fer.rows[0].n,reservas:res.rows[0].n},alerts:alerts.rows});
}catch(e){return apiError(e)}}
