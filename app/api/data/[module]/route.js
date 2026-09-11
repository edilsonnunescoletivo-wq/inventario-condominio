import { saveReservation, saveNotice } from '@/lib/operacao-services';
import { pool, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAdmin, requireSession, apiError } from '@/lib/session';
import { audit } from '@/lib/audit';

export const runtime='nodejs';
const priority=v=>{const s=String(v||'media').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();if(['baixa','media','alta','critica'].includes(s))return s;if(['urgente','emergencia','emergencial'].includes(s))return 'critica';return 'media'};
const n=v=>v===''||v==null?null:Number(v);
const s=v=>String(v??'').trim();
const bool=v=>v===true||v==='true'||v===1||v==='1';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailList(v){const items=s(v).split(';').map(x=>x.trim().toLowerCase()).filter(Boolean);if(!items.length)return null;const unique=[...new Set(items)];const invalid=unique.filter(x=>!EMAIL_RE.test(x));if(invalid.length)throw Object.assign(new Error(`E-mail inválido: ${invalid.join(', ')}. Separe os endereços usando ;`),{status:400});return unique.join('; ')}
function code(prefix){return `${prefix}-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
async function sessionFor(request,module){const u=await (['usuarios','chaves','configuracoes'].includes(module)?requireAdmin(request):requireSession(request));if(request.method!=='GET'&&u.perfil==='consulta'&&!u.is_superadmin)throw Object.assign(new Error('Seu perfil permite apenas consultas.'),{status:403});return u}

export async function GET(request,{params}){
  try{
    const {module}=await params;const u=await sessionFor(request,module);const id=u.condominio_id;let r;
    switch(module){
      case 'inventario': r=await query(`SELECT * FROM inventario WHERE condominio_id=$1 AND ativo=true ORDER BY descricao`,[id]);break;
      case 'materiais': r=await query(`SELECT * FROM materiais WHERE condominio_id=$1 AND ativo=true ORDER BY nome`,[id]);break;
      case 'movimentacoes': r=await query(`SELECT m.*,x.nome material FROM movimentacoes_materiais m JOIN materiais x ON x.id=m.material_id WHERE m.condominio_id=$1 ORDER BY m.criado_em DESC LIMIT 200`,[id]);break;
      case 'ferramentas': r=await query(`SELECT * FROM ferramentas WHERE condominio_id=$1 AND ativo=true ORDER BY nome`,[id]);break;
      case 'emprestimos': r=await query(`SELECT e.*,f.nome ferramenta FROM emprestimos_ferramentas e JOIN ferramentas f ON f.id=e.ferramenta_id WHERE e.condominio_id=$1 ORDER BY e.data_retirada DESC LIMIT 200`,[id]);break;
      case 'fornecedores': r=await query(`SELECT * FROM fornecedores WHERE condominio_id=$1 AND ativo=true ORDER BY COALESCE(nome_fantasia,razao_social)`,[id]);break;
      case 'manutencoes': r=await query(`SELECT m.*,i.descricao inventario,f.razao_social fornecedor FROM manutencoes_planos m LEFT JOIN inventario i ON i.id=m.inventario_id LEFT JOIN fornecedores f ON f.id=m.fornecedor_id WHERE m.condominio_id=$1 AND m.ativo=true ORDER BY m.proxima_execucao`,[id]);break;
      case 'os': r=await query(`SELECT o.*,i.descricao inventario,f.razao_social fornecedor FROM ordens_servico o LEFT JOIN inventario i ON i.id=o.inventario_id LEFT JOIN fornecedores f ON f.id=o.fornecedor_id WHERE o.condominio_id=$1 ORDER BY o.data_abertura DESC LIMIT 300`,[id]);break;
      case 'checklists': r=await query(`SELECT m.*,COALESCE(json_agg(json_build_object('id',i.id,'ordem',i.ordem,'descricao',i.descricao,'exige_foto',i.exige_foto) ORDER BY i.ordem) FILTER(WHERE i.id IS NOT NULL),'[]') itens FROM checklist_modelos m LEFT JOIN checklist_modelo_itens i ON i.modelo_id=m.id WHERE m.condominio_id=$1 AND m.ativo=true GROUP BY m.id ORDER BY m.nome`,[id]);break;
      case 'ocorrencias': r=await query(`SELECT * FROM ocorrencias WHERE condominio_id=$1 ORDER BY criado_em DESC LIMIT 300`,[id]);break;
      case 'documentos': r=await query(`SELECT d.*,f.razao_social fornecedor FROM documentos_condominio d LEFT JOIN fornecedores f ON f.id=d.fornecedor_id WHERE d.condominio_id=$1 AND d.ativo=true ORDER BY d.validade NULLS LAST,d.titulo`,[id]);break;
      case 'contratos': r=await query(`SELECT c.*,f.razao_social fornecedor FROM contratos c LEFT JOIN fornecedores f ON f.id=c.fornecedor_id WHERE c.condominio_id=$1 AND c.ativo=true ORDER BY c.fim NULLS LAST,c.titulo`,[id]);break;
      case 'unidades': r=await query(`SELECT u.*,count(m.id)::int moradores FROM unidades u LEFT JOIN moradores m ON m.unidade_id=u.id AND m.ativo=true WHERE u.condominio_id=$1 AND u.ativo=true GROUP BY u.id ORDER BY u.bloco NULLS FIRST,u.unidade`,[id]);break;
      case 'moradores': r=await query(`SELECT m.*,u.bloco,u.unidade FROM moradores m JOIN unidades u ON u.id=m.unidade_id WHERE m.condominio_id=$1 AND m.ativo=true ORDER BY u.bloco NULLS FIRST,u.unidade,m.nome`,[id]);break;
      case 'areas': r=await query(`SELECT * FROM areas_reservaveis WHERE condominio_id=$1 AND ativo=true ORDER BY nome`,[id]);break;
      case 'reservas': r=await query(`SELECT r.id,r.area_id,r.unidade_id,r.responsavel,r.tipo_evento,r.email_solicitante,r.whatsapp_solicitante,r.status,r.observacoes,r.valor_total,r.valor_pago,r.valor_restante,r.lembrete_enviado_em,r.criado_em,r.atualizado_em,a.nome area,u.bloco,u.unidade,
        to_char(r.inicio AT TIME ZONE 'America/Bahia','YYYY-MM-DD"T"HH24:MI') inicio_local,
        to_char(r.fim AT TIME ZONE 'America/Bahia','YYYY-MM-DD"T"HH24:MI') fim_local,
        to_char(r.inicio AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI') inicio_formatado,
        to_char(r.fim AT TIME ZONE 'America/Bahia','DD/MM/YYYY HH24:MI') fim_formatado
        FROM reservas r JOIN areas_reservaveis a ON a.id=r.area_id LEFT JOIN unidades u ON u.id=r.unidade_id WHERE r.condominio_id=$1 ORDER BY r.inicio DESC LIMIT 400`,[id]);break;
      case 'comunicados': r=await query(`SELECT * FROM comunicados WHERE condominio_id=$1 AND ($2::boolean OR (publicado AND (agendado_em IS NULL OR agendado_em<=now()) AND publico<>'administracao')) ORDER BY criado_em DESC LIMIT 200`,[id,u.is_superadmin||['admin','gerente','supervisor'].includes(u.perfil)]);break;
      case 'cotacoes': r=await query(`SELECT c.*,COALESCE(json_agg(json_build_object('id',i.id,'descricao',i.descricao,'quantidade',i.quantidade,'unidade',i.unidade)) FILTER(WHERE i.id IS NOT NULL),'[]') itens FROM cotacoes c LEFT JOIN cotacao_itens i ON i.cotacao_id=c.id WHERE c.condominio_id=$1 GROUP BY c.id ORDER BY c.criado_em DESC`,[id]);break;
      case 'usuarios': r=await query(`SELECT u.id,u.nome,u.email,uc.perfil,uc.ativo,u.criado_em,u.atualizado_em FROM usuario_condominios uc JOIN usuarios u ON u.id=uc.usuario_id WHERE uc.condominio_id=$1 ORDER BY u.nome`,[id]);break;
      case 'chaves': r=await query(`SELECT id,chave,descricao,max_usuarios,expira_em,ativa,criado_em FROM chaves_ativacao WHERE condominio_id=$1 ORDER BY criado_em DESC`,[id]);break;
      case 'configuracoes': r=await query(`SELECT * FROM configuracoes_sistema WHERE condominio_id=$1 LIMIT 1`,[id]);break;
      default:return Response.json({error:'Módulo inválido.'},{status:404});
    }
    return Response.json({items:r.rows});
  }catch(e){return apiError(e)}
}

export async function POST(request,{params}){
  let client;
  try{
    const {module}=await params;const u=await sessionFor(request,module);const id=u.condominio_id;const b=await request.json();let r;
    switch(module){
      case 'inventario':
        if(!s(b.descricao)) return Response.json({error:'Informe a descrição.'},{status:400});
        r=await query(`INSERT INTO inventario(condominio_id,patrimonio,descricao,categoria,quantidade,unidade,localizacao,estado_conservacao,valor_aquisicao,data_aquisicao,foto_url,observacoes,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING *`,[id,s(b.patrimonio)||null,s(b.descricao),s(b.categoria)||null,n(b.quantidade)??1,s(b.unidade)||'un',s(b.localizacao)||null,s(b.estado_conservacao)||'bom',n(b.valor_aquisicao),b.data_aquisicao||null,b.foto_url||null,s(b.observacoes)||null,u.id]);break;
      case 'materiais':
        if(!s(b.nome)) return Response.json({error:'Informe o material.'},{status:400});
        r=await query(`INSERT INTO materiais(condominio_id,codigo,nome,categoria,unidade,estoque_atual,estoque_minimo,localizacao,fornecedor,observacoes,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,[id,s(b.codigo)||null,s(b.nome),s(b.categoria)||null,s(b.unidade)||'un',n(b.estoque_atual)??0,n(b.estoque_minimo)??0,s(b.localizacao)||null,s(b.fornecedor)||null,s(b.observacoes)||null,u.id]);break;
      case 'movimentacoes':{
        client=await pool.connect();await client.query('BEGIN');
        const mr=await client.query(`SELECT * FROM materiais WHERE id=$1 AND condominio_id=$2 FOR UPDATE`,[b.material_id,id]);const m=mr.rows[0];if(!m) throw Object.assign(new Error('Material não encontrado.'),{status:404});
        const qtd=Number(b.quantidade);if(!qtd||qtd<=0) throw Object.assign(new Error('Quantidade inválida.'),{status:400});const tipo=b.tipo==='saida'?'saida':'entrada';const anterior=Number(m.estoque_atual);const novo=tipo==='saida'?anterior-qtd:anterior+qtd;if(novo<0) throw Object.assign(new Error('Estoque insuficiente.'),{status:400});
        await client.query(`UPDATE materiais SET estoque_atual=$1,atualizado_por=$2,atualizado_em=now() WHERE id=$3`,[novo,u.id,m.id]);
        r=await client.query(`INSERT INTO movimentacoes_materiais(material_id,condominio_id,usuario_id,tipo,quantidade,saldo_anterior,saldo_novo,destino_origem,documento,observacoes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[m.id,id,u.id,tipo,qtd,anterior,novo,s(b.destino_origem)||null,s(b.documento)||null,s(b.observacoes)||null]);
        await client.query('COMMIT');client.release();client=null;break;}
      case 'ferramentas':
        if(!s(b.nome)) return Response.json({error:'Informe a ferramenta.'},{status:400});
        r=await query(`INSERT INTO ferramentas(condominio_id,codigo,nome,categoria,marca,modelo,numero_serie,estado_conservacao,status,localizacao,observacoes,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'disponivel',$9,$10,$11,$11) RETURNING *`,[id,s(b.codigo)||null,s(b.nome),s(b.categoria)||null,s(b.marca)||null,s(b.modelo)||null,s(b.numero_serie)||null,s(b.estado_conservacao)||'bom',s(b.localizacao)||null,s(b.observacoes)||null,u.id]);break;
      case 'emprestimos':{
        client=await pool.connect();await client.query('BEGIN');const fr=await client.query(`SELECT * FROM ferramentas WHERE id=$1 AND condominio_id=$2 FOR UPDATE`,[b.ferramenta_id,id]);const f=fr.rows[0];if(!f||f.status!=='disponivel') throw Object.assign(new Error('Ferramenta indisponível.'),{status:400});
        r=await client.query(`INSERT INTO emprestimos_ferramentas(ferramenta_id,condominio_id,usuario_id,responsavel,setor,previsao_devolucao,observacoes_retirada,status) VALUES($1,$2,$3,$4,$5,$6,$7,'aberto') RETURNING *`,[f.id,id,u.id,s(b.responsavel),s(b.setor)||null,b.previsao_devolucao||null,s(b.observacoes)||null]);await client.query(`UPDATE ferramentas SET status='emprestada',responsavel_atual=$1,atualizado_por=$2,atualizado_em=now() WHERE id=$3`,[s(b.responsavel),u.id,f.id]);await client.query('COMMIT');client.release();client=null;break;}
      case 'fornecedores':
        if(!s(b.razao_social)) return Response.json({error:'Informe a razão social.'},{status:400});
        r=await query(`INSERT INTO fornecedores(condominio_id,razao_social,nome_fantasia,cnpj,contato,telefone,email,categoria,avaliacao,observacoes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,s(b.razao_social),s(b.nome_fantasia)||null,s(b.cnpj)||null,s(b.contato)||null,s(b.telefone)||null,s(b.email)||null,s(b.categoria)||null,n(b.avaliacao),s(b.observacoes)||null]);break;
      case 'manutencoes':
        if(!s(b.titulo)||!b.proxima_execucao) return Response.json({error:'Informe título e próxima execução.'},{status:400});
        r=await query(`INSERT INTO manutencoes_planos(condominio_id,inventario_id,titulo,categoria,periodicidade_dias,ultima_execucao,proxima_execucao,fornecedor_id,custo_estimado,instrucoes,criado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[id,b.inventario_id||null,s(b.titulo),s(b.categoria)||null,n(b.periodicidade_dias)??30,b.ultima_execucao||null,b.proxima_execucao,b.fornecedor_id||null,n(b.custo_estimado),s(b.instrucoes)||null,u.id]);break;
      case 'os':
        if(!s(b.titulo)) return Response.json({error:'Informe o título da OS.'},{status:400});
        r=await query(`INSERT INTO ordens_servico(condominio_id,numero_os,manutencao_plano_id,inventario_id,fornecedor_id,titulo,descricao,prioridade,status,responsavel,prazo,custo_real,materiais_usados,observacoes,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'aberta',$9,$10,$11,$12,$13,$14,$14) RETURNING *`,[id,code('OS'),b.manutencao_plano_id||null,b.inventario_id||null,b.fornecedor_id||null,s(b.titulo),s(b.descricao)||null,priority(b.prioridade),s(b.responsavel)||null,b.prazo||null,n(b.custo_real),s(b.materiais_usados)||null,s(b.observacoes)||null,u.id]);break;
      case 'checklists':{
        client=await pool.connect();await client.query('BEGIN');const mr=await client.query(`INSERT INTO checklist_modelos(condominio_id,nome,area,periodicidade) VALUES($1,$2,$3,$4) RETURNING *`,[id,s(b.nome),s(b.area)||null,s(b.periodicidade)||'diario']);const model=mr.rows[0];for(const [ix,item] of (b.itens||[]).entries()){if(s(item.descricao)) await client.query(`INSERT INTO checklist_modelo_itens(modelo_id,ordem,descricao,exige_foto,condominio_id) VALUES($1,$2,$3,$4,$5)`,[model.id,ix+1,s(item.descricao),bool(item.exige_foto),id])}await client.query('COMMIT');client.release();client=null;r={rows:[model]};break;}
      case 'ocorrencias':
        if(!s(b.titulo)) return Response.json({error:'Informe o título.'},{status:400});
        r=await query(`INSERT INTO ocorrencias(condominio_id,protocolo,titulo,descricao,categoria,prioridade,status,unidade,responsavel,criado_por) VALUES($1,$2,$3,$4,$5,$6,'aberta',$7,$8,$9) RETURNING *`,[id,code('OC'),s(b.titulo),s(b.descricao)||null,s(b.categoria)||null,priority(b.prioridade),s(b.unidade)||null,s(b.responsavel)||null,u.id]);break;
      case 'documentos':
        if(!s(b.titulo)) return Response.json({error:'Informe o título.'},{status:400});
        r=await query(`INSERT INTO documentos_condominio(condominio_id,titulo,categoria,numero,emissao,validade,fornecedor_id,arquivo_data_url,observacoes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,s(b.titulo),s(b.categoria)||null,s(b.numero)||null,b.emissao||null,b.validade||null,b.fornecedor_id||null,b.arquivo_data_url||null,s(b.observacoes)||null]);break;
      case 'contratos':
        if(!s(b.titulo)) return Response.json({error:'Informe o título.'},{status:400});
        r=await query(`INSERT INTO contratos(condominio_id,fornecedor_id,titulo,inicio,fim,valor_mensal,reajuste,arquivo_data_url,observacoes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,b.fornecedor_id||null,s(b.titulo),b.inicio||null,b.fim||null,n(b.valor_mensal),s(b.reajuste)||null,b.arquivo_data_url||null,s(b.observacoes)||null]);break;
      case 'unidades':
        if(!s(b.unidade)) return Response.json({error:'Informe a unidade.'},{status:400});
        r=await query(`INSERT INTO unidades(condominio_id,bloco,unidade,tipo,observacoes) VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,s(b.bloco)||null,s(b.unidade),s(b.tipo)||'apartamento',s(b.observacoes)||null]);break;
      case 'moradores':
        if(!b.unidade_id||!s(b.nome)) return Response.json({error:'Informe unidade e nome.'},{status:400});
        r=await query(`INSERT INTO moradores(condominio_id,unidade_id,nome,tipo,telefone,email,veiculo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,b.unidade_id,s(b.nome),s(b.tipo)||'morador',s(b.telefone)||null,s(b.email)||null,s(b.veiculo)||null]);break;
      case 'areas':
        if(!s(b.nome)) return Response.json({error:'Informe o nome da área.'},{status:400});
        r=await query(`INSERT INTO areas_reservaveis(condominio_id,nome,capacidade,regulamento,valor_taxa) VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,s(b.nome),n(b.capacidade),s(b.regulamento)||null,n(b.valor_taxa)]);break;
      case 'reservas': r={rows:[await saveReservation(u,b)]};break;
      case 'comunicados': r={rows:[await saveNotice(u,{...b,publico:b.publico||'todos'})]};break;
      case 'cotacoes':{
        client=await pool.connect();await client.query('BEGIN');const cr=await client.query(`INSERT INTO cotacoes(condominio_id,numero,titulo,status,criado_por) VALUES($1,$2,$3,'aberta',$4) RETURNING *`,[id,code('COT'),s(b.titulo),u.id]);const cot=cr.rows[0];for(const item of (b.itens||[])){if(s(item.descricao)) await client.query(`INSERT INTO cotacao_itens(cotacao_id,descricao,quantidade,unidade) VALUES($1,$2,$3,$4)`,[cot.id,s(item.descricao),n(item.quantidade)??1,s(item.unidade)||'un'])}await client.query('COMMIT');client.release();client=null;r={rows:[cot]};break;}
      case 'usuarios':{
        const nome=s(b.nome),email=s(b.email).toLowerCase(),senha=String(b.senha||''),perfil=['admin','gerente','supervisor','operacional','consulta'].includes(b.perfil)?b.perfil:'operacional';if(nome.length<2||!email.includes('@')) return Response.json({error:'Nome e e-mail são obrigatórios.'},{status:400});const existsLink=await query(`SELECT 1 FROM usuario_condominios uc JOIN usuarios x ON x.id=uc.usuario_id WHERE uc.condominio_id=$1 AND lower(x.email)=lower($2)`,[id,email]);if(existsLink.rowCount) return Response.json({error:'Este e-mail já está vinculado a este condomínio.'},{status:409});let user=await query(`SELECT id,nome,email FROM usuarios WHERE lower(email)=lower($1) LIMIT 1`,[email]);let uid;if(user.rowCount){uid=user.rows[0].id}else{if(senha.length<6)return Response.json({error:'Para um novo usuário, informe senha inicial com pelo menos 6 caracteres.'},{status:400});const hash=await hashPassword(senha);user=await query(`INSERT INTO usuarios(condominio_id,nome,email,senha_hash,perfil,ativo) VALUES($1,$2,$3,$4,$5,true) RETURNING id,nome,email`,[id,nome,email,hash,perfil==='admin'?'admin':'usuario']);uid=user.rows[0].id}await query(`INSERT INTO usuario_condominios(usuario_id,condominio_id,perfil,ativo) VALUES($1,$2,$3,true)`,[uid,id,perfil]);r=await query(`SELECT u.id,u.nome,u.email,uc.perfil,uc.ativo,u.criado_em FROM usuario_condominios uc JOIN usuarios u ON u.id=uc.usuario_id WHERE uc.usuario_id=$1 AND uc.condominio_id=$2`,[uid,id]);break;}
      case 'chaves':{
        const chave=s(b.chave)||`GC-${Math.random().toString(36).slice(2,10).toUpperCase()}`;r=await query(`INSERT INTO chaves_ativacao(condominio_id,chave,descricao,max_usuarios,expira_em,ativa,criado_por) VALUES($1,$2,$3,$4,$5,true,$6) RETURNING id,chave,descricao,max_usuarios,expira_em,ativa,criado_em`,[id,chave,s(b.descricao)||null,n(b.max_usuarios)??20,b.expira_em||null,u.id]);break;}
      default:return Response.json({error:'Operação não disponível.'},{status:404});
    }
    await audit(request,{condominio_id:id,usuario_id:u.id,acao:'criar',modulo:module,entidade_id:r.rows[0]?.id,descricao:`Registro criado em ${module}`});return Response.json({item:r.rows[0]},{status:201});
  }catch(e){if(client){try{await client.query('ROLLBACK')}catch{};client.release()}return apiError(e)}
}

export async function PATCH(request,{params}){
  let client;
  try{
    const {module}=await params;const u=await sessionFor(request,module);const cid=u.condominio_id;const b=await request.json();if(!b.id&&module!=='configuracoes') return Response.json({error:'ID obrigatório.'},{status:400});let r;
    switch(module){
      case 'os':{
        if(b.status==='concluida'||b.custo_real!==undefined||b.materiais_usados!==undefined) return Response.json({error:'Use os detalhes da OS para registrar a execução e solicitar validação.'},{status:400});
        const existing=await query('SELECT revisao,status FROM ordens_servico WHERE id=$1 AND condominio_id=$2',[b.id,cid]);if(existing.rows[0]?.revisao?.situacao==='pendente'||existing.rows[0]?.status==='concluida')return Response.json({error:'Use o fluxo de revisão nos detalhes da OS.'},{status:409});
        const fields=[],vals=[];let i=1;const add=(col,val)=>{fields.push(`${col}=$${i++}`);vals.push(val)};
        if(b.status!==undefined){const st=['aberta','em_andamento','aguardando','concluida','cancelada'].includes(b.status)?b.status:'aberta';add('status',st);if(st==='concluida')fields.push('data_conclusao=now()');else if(st!=='concluida')fields.push('data_conclusao=NULL')}
        if(b.titulo!==undefined)add('titulo',s(b.titulo));if(b.descricao!==undefined)add('descricao',s(b.descricao)||null);if(b.prioridade!==undefined)add('prioridade',priority(b.prioridade));if(b.responsavel!==undefined)add('responsavel',s(b.responsavel)||null);if(b.prazo!==undefined)add('prazo',b.prazo||null);if(b.custo_real!==undefined)add('custo_real',n(b.custo_real));if(b.materiais_usados!==undefined)add('materiais_usados',s(b.materiais_usados)||null);if(b.observacoes!==undefined)add('observacoes',s(b.observacoes)||null);add('atualizado_por',u.id);vals.push(b.id,cid);r=await query(`UPDATE ordens_servico SET ${fields.join(',')} WHERE id=$${i++} AND condominio_id=$${i} RETURNING *`,vals);break;}
      case 'ocorrencias':{
        const st=['aberta','em_analise','em_atendimento','resolvida','arquivada'].includes(b.status)?b.status:null;r=await query(`UPDATE ocorrencias SET status=COALESCE($1,status),responsavel=COALESCE($2,responsavel),prioridade=COALESCE($3,prioridade),resolvido_em=CASE WHEN $1='resolvida' THEN now() WHEN $1 IS NOT NULL AND $1<>'resolvida' THEN NULL ELSE resolvido_em END WHERE id=$4 AND condominio_id=$5 RETURNING *`,[st,s(b.responsavel)||null,b.prioridade?priority(b.prioridade):null,b.id,cid]);break;}
      case 'reservas': r={rows:[await saveReservation(u,b)],rowCount:1};break;
      case 'emprestimos':{
        client=await pool.connect();await client.query('BEGIN');const er=await client.query(`SELECT * FROM emprestimos_ferramentas WHERE id=$1 AND condominio_id=$2 FOR UPDATE`,[b.id,cid]);const e=er.rows[0];if(!e) throw Object.assign(new Error('Empréstimo não encontrado.'),{status:404});r=await client.query(`UPDATE emprestimos_ferramentas SET data_devolucao=now(),observacoes_devolucao=$1,status='devolvido' WHERE id=$2 RETURNING *`,[s(b.observacoes_devolucao)||null,b.id]);await client.query(`UPDATE ferramentas SET status='disponivel',responsavel_atual=NULL,atualizado_por=$1,atualizado_em=now() WHERE id=$2`,[u.id,e.ferramenta_id]);await client.query('COMMIT');client.release();client=null;break;}
      case 'usuarios':{const perfil=['admin','gerente','supervisor','operacional','consulta'].includes(b.perfil)?b.perfil:null;await query(`UPDATE usuarios SET nome=COALESCE($1,nome),atualizado_em=now() WHERE id=$2`,[s(b.nome)||null,b.id]);r=await query(`UPDATE usuario_condominios SET ativo=COALESCE($1,ativo),perfil=COALESCE($2,perfil),atualizado_em=now() WHERE usuario_id=$3 AND condominio_id=$4 RETURNING usuario_id id,perfil,ativo`,[b.ativo===undefined?null:bool(b.ativo),perfil,b.id,cid]);break;}
      case 'configuracoes':{
        const current=await query(`SELECT id FROM configuracoes_sistema WHERE condominio_id=$1`,[cid]);if(current.rowCount){r=await query(`UPDATE configuracoes_sistema SET nome_sistema=COALESCE($1,nome_sistema),cor_primaria=COALESCE($2,cor_primaria),endereco=$3,telefone=$4,email=$5,rodape_relatorio=$6,mensagem_pedido=$7,logo_data_url=COALESCE($8,logo_data_url),atualizado_em=now() WHERE condominio_id=$9 RETURNING *`,[s(b.nome_sistema)||null,s(b.cor_primaria)||null,s(b.endereco)||null,s(b.telefone)||null,s(b.email)||null,s(b.rodape_relatorio)||null,s(b.mensagem_pedido)||null,b.logo_data_url||null,cid])}else{r=await query(`INSERT INTO configuracoes_sistema(condominio_id,nome_sistema,cor_primaria,endereco,telefone,email,rodape_relatorio,mensagem_pedido,logo_data_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[cid,s(b.nome_sistema)||'Gestão Operacional de Condomínios',s(b.cor_primaria)||'#2563eb',s(b.endereco)||null,s(b.telefone)||null,s(b.email)||null,s(b.rodape_relatorio)||null,s(b.mensagem_pedido)||null,b.logo_data_url||null])}break;}
      case 'chaves': r=await query(`UPDATE chaves_ativacao SET ativa=COALESCE($1,ativa),descricao=COALESCE($2,descricao),expira_em=COALESCE($3,expira_em),max_usuarios=COALESCE($4,max_usuarios) WHERE id=$5 AND condominio_id=$6 RETURNING *`,[b.ativa===undefined?null:bool(b.ativa),s(b.descricao)||null,b.expira_em||null,n(b.max_usuarios),b.id,cid]);break;
      default:return Response.json({error:'Alteração não disponível.'},{status:404});
    }
    if(!r.rowCount) return Response.json({error:'Registro não encontrado.'},{status:404});await audit(request,{condominio_id:cid,usuario_id:u.id,acao:'alterar',modulo:module,entidade_id:b.id,descricao:`Registro alterado em ${module}`});return Response.json({item:r.rows[0]});
  }catch(e){if(client){try{await client.query('ROLLBACK')}catch{};client.release()}return apiError(e)}
}
