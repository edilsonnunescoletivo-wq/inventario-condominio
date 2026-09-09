import PDFDocument from 'pdfkit';
import { query } from '@/lib/db';
import { requireAdmin, apiError } from '@/lib/session';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const dt=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const d=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',dateStyle:'short'}).format(new Date(`${String(v).slice(0,10)}T12:00:00-03:00`)):'—';
const txt=v=>v==null||v===''?'—':String(v);
async function pdfBuffer(draw){
  return new Promise((resolve,reject)=>{const doc=new PDFDocument({size:'A4',margin:36,bufferPages:true});const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);draw(doc);doc.end()})
}
function header(doc,title,condo){doc.fontSize(18).font('Helvetica-Bold').text(title);doc.moveDown(.2).fontSize(10).font('Helvetica').fillColor('#667085').text(`${condo.nome} • CNPJ ${condo.cnpj}`);doc.text(`Emitido em ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}).format(new Date())}`);doc.fillColor('#182230').moveDown(.8);doc.moveTo(36,doc.y).lineTo(559,doc.y).strokeColor('#d0d5dd').stroke();doc.moveDown(.7)}
function line(doc,label,value){doc.font('Helvetica-Bold').fontSize(9).text(`${label}: `,{continued:true});doc.font('Helvetica').text(txt(value));}
function maybePage(doc,need=120){if(doc.y>760-need)doc.addPage()}
export async function GET(request,{params}){try{
  const {type}=await params;const u=await requireAdmin(request);const cid=u.condominio_id;const cr=await query(`SELECT c.nome,c.cnpj,cs.rodape_relatorio FROM condominios c LEFT JOIN configuracoes_sistema cs ON cs.condominio_id=c.id WHERE c.id=$1`,[cid]);const condo=cr.rows[0];let rows,title;
  if(type==='reservas'){
    rows=(await query(`SELECT r.*,a.nome area,u.bloco,u.unidade FROM reservas r JOIN areas_reservaveis a ON a.id=r.area_id LEFT JOIN unidades u ON u.id=r.unidade_id WHERE r.condominio_id=$1 ORDER BY r.inicio DESC`,[cid])).rows;title='Relatório de Reservas';
    const buf=await pdfBuffer(doc=>{header(doc,title,condo);if(!rows.length)doc.text('Nenhuma reserva cadastrada.');rows.forEach((r,ix)=>{maybePage(doc,190);doc.fontSize(11).font('Helvetica-Bold').fillColor('#175cd3').text(`${ix+1}. ${r.area} — ${r.responsavel}`);doc.fillColor('#182230').moveDown(.25);line(doc,'Tipo de evento',r.tipo_evento);line(doc,'E-mail do solicitante',r.email_solicitante);line(doc,'WhatsApp do solicitante',r.whatsapp_solicitante);line(doc,'Unidade',r.unidade?`${r.bloco?`${r.bloco} / `:''}${r.unidade}`:'—');line(doc,'Início',dt(r.inicio));line(doc,'Término',dt(r.fim));line(doc,'Status',String(r.status||'').toUpperCase());line(doc,'Valor total',brl(r.valor_total));line(doc,'Valor pago',brl(r.valor_pago));line(doc,'Valor restante',brl(r.valor_restante));line(doc,'Observações',r.observacoes);line(doc,'Lembrete enviado',r.lembrete_enviado_em?dt(r.lembrete_enviado_em):'Não');doc.moveDown(.45);doc.moveTo(36,doc.y).lineTo(559,doc.y).strokeColor('#e4e7ec').stroke();doc.moveDown(.55)});if(condo.rodape_relatorio){doc.moveDown();doc.fontSize(8).fillColor('#667085').text(condo.rodape_relatorio)}});
    return new Response(buf,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="relatorio-reservas.pdf"','Cache-Control':'no-store'}})
  }
  const configs={
    inventario:{title:'Relatório de Inventário',sql:`SELECT patrimonio,descricao,categoria,quantidade,unidade,localizacao,estado_conservacao,valor_aquisicao,data_aquisicao FROM inventario WHERE condominio_id=$1 AND ativo=true ORDER BY descricao`},
    estoque:{title:'Relatório de Estoque',sql:`SELECT codigo,nome,categoria,unidade,estoque_atual,estoque_minimo,localizacao,fornecedor FROM materiais WHERE condominio_id=$1 AND ativo=true ORDER BY nome`},
    manutencoes:{title:'Relatório de Manutenções',sql:`SELECT titulo,categoria,periodicidade_dias,ultima_execucao,proxima_execucao,custo_estimado FROM manutencoes_planos WHERE condominio_id=$1 AND ativo=true ORDER BY proxima_execucao`},
    os:{title:'Relatório de Ordens de Serviço',sql:`SELECT numero_os,titulo,prioridade,status,responsavel,data_abertura,prazo,data_conclusao,custo_real FROM ordens_servico WHERE condominio_id=$1 ORDER BY data_abertura DESC`},
    ocorrencias:{title:'Relatório de Ocorrências',sql:`SELECT protocolo,titulo,categoria,prioridade,status,unidade,responsavel,criado_em,resolvido_em FROM ocorrencias WHERE condominio_id=$1 ORDER BY criado_em DESC`},
    documentos:{title:'Relatório de Documentos',sql:`SELECT titulo,categoria,numero,emissao,validade,observacoes FROM documentos_condominio WHERE condominio_id=$1 AND ativo=true ORDER BY validade NULLS LAST`},
    fornecedores:{title:'Relatório de Fornecedores',sql:`SELECT razao_social,nome_fantasia,cnpj,contato,telefone,email,categoria,avaliacao FROM fornecedores WHERE condominio_id=$1 AND ativo=true ORDER BY razao_social`},
    itens_qr:{title:'Itens com QR Code',sql:`SELECT 'Inventário' tipo,descricao item,qr_token::text token FROM inventario WHERE condominio_id=$1 AND ativo=true UNION ALL SELECT 'Material',nome,qr_token::text FROM materiais WHERE condominio_id=$1 AND ativo=true UNION ALL SELECT 'Ferramenta',nome,qr_token::text FROM ferramentas WHERE condominio_id=$1 AND ativo=true ORDER BY tipo,item`},
    gestao_mensal:{title:'Livro da Gestão',sql:`SELECT 'OS abertas' indicador,count(*)::text valor FROM ordens_servico WHERE condominio_id=$1 AND status IN ('aberta','em_andamento','aguardando') UNION ALL SELECT 'Ocorrências abertas',count(*)::text FROM ocorrencias WHERE condominio_id=$1 AND status NOT IN ('resolvida','arquivada') UNION ALL SELECT 'Reservas confirmadas',count(*)::text FROM reservas WHERE condominio_id=$1 AND status='confirmada' AND inicio>=date_trunc('month',now()) AND inicio<date_trunc('month',now())+interval '1 month'`}
  };
  const cfg=configs[type];if(!cfg)return Response.json({error:'Relatório inválido.'},{status:404});rows=(await query(cfg.sql,[cid])).rows;title=cfg.title;
  const buf=await pdfBuffer(doc=>{header(doc,title,condo);if(!rows.length){doc.text('Nenhum registro encontrado.');return}rows.forEach((row,ix)=>{maybePage(doc,100);doc.font('Helvetica-Bold').fontSize(10).text(`${ix+1}.`);for(const [k,v] of Object.entries(row)){let val=v;if(/valor|custo/i.test(k)&&v!=null)val=brl(v);else if(/data|emissao|validade|prazo|execucao|criado|resolvido|conclusao/i.test(k)&&v)val=String(v).includes('T')?dt(v):d(v);line(doc,k.replaceAll('_',' '),val)}doc.moveDown(.35);doc.moveTo(36,doc.y).lineTo(559,doc.y).strokeColor('#e4e7ec').stroke();doc.moveDown(.45)});if(condo.rodape_relatorio){doc.moveDown();doc.fontSize(8).fillColor('#667085').text(condo.rodape_relatorio)}});
  return new Response(buf,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${type}.pdf"`,'Cache-Control':'no-store'}})
}catch(e){return apiError(e)}}
