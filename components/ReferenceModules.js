'use client';
import {useMemo,useState} from 'react';
import {Bell,Building2,CalendarDays,Check,Clock3,FileText,MapPin,Plus,Search,Users,Wrench,ChevronRight,ShieldCheck} from 'lucide-react';
import {Box,DataTable,Dialog,Field,useOperation,money,stamp} from './OperationUI';

const cap=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const shortDate=v=>v?new Date(v).toLocaleDateString('pt-BR',{timeZone:'America/Bahia'}):'—';
const shortTime=v=>v?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Bahia'}):'';

export function CondominiumsPanel({me,onSelect}){
 const condos=me?.condominios||[];
 const active=condos.filter(c=>c.status==='ativo').length;
 return <>
  <section className="reference-metrics condo-summary">
   <div><Building2/><strong>{condos.length}</strong><span>Condomínios sob sua gestão</span></div>
   <div><ShieldCheck/><strong>{active}</strong><span>Ambientes ativos</span></div>
   <div><Users/><strong>{me?.user?.nome||'Equipe'}</strong><span>Acesso conforme o perfil</span></div>
  </section>
  <section className="section-heading"><div><h2>Seus condomínios</h2><p>Escolha o ambiente que deseja administrar.</p></div></section>
  <section className="condo-grid">{condos.map((c,i)=><article className="condo-card" key={c.condominio_id}>
   <div className={`condo-cover cover-${i%3}`}><Building2/><span>{c.nome}</span></div>
   <div className="condo-card-body"><div className="condo-card-title"><div><h2>{c.nome}</h2><span className={`badge ${c.status==='ativo'?'green':'orange'}`}>{c.status==='ativo'?'Ativo':cap(c.status)}</span></div></div>
    <p><MapPin size={16}/>{c.endereco||'Endereço não informado'}</p>
    <div className="condo-stats"><span><small>Seu perfil</small><strong>{cap(c.perfil)}</strong></span><span><small>Isolamento</small><strong>Dados separados</strong></span></div>
    <button className="btn primary block condo-select" onClick={()=>onSelect(c.condominio_id)}>Acessar condomínio <ChevronRight size={16}/></button>
   </div>
  </article>)}</section>
 </>;
}

export function NotificationsPanel({auth,go}){
 const x=useOperation(auth,'notificacoes'),[filter,setFilter]=useState('todas'),[query,setQuery]=useState('');
 const visible=useMemo(()=>x.items.filter(n=>(filter==='todas'||(filter==='nao_lidas'&&!n.lida))&&(`${n.titulo} ${n.mensagem}`).toLowerCase().includes(query.toLowerCase())),[x.items,filter,query]);
 const unread=x.items.filter(i=>!i.lida).length;
 async function mark(id){await x.send({id});}
 return <>
  <section className="notification-summary"><div><Bell/><span><strong>{unread}</strong><small>Não lidas</small></span></div><div><Check/><span><strong>{x.items.length-unread}</strong><small>Lidas</small></span></div><div><Clock3/><span><strong>{x.items.length}</strong><small>Total de avisos</small></span></div></section>
  <Box title="Central de avisos do seu condomínio" actions={<button className="btn primary" disabled={x.busy||!unread} onClick={()=>mark(null)}><Check size={17}/> Marcar como lidas</button>}>
   <div className="notification-toolbar"><div className="notification-tabs"><button className={filter==='todas'?'active':''} onClick={()=>setFilter('todas')}>Todas</button><button className={filter==='nao_lidas'?'active':''} onClick={()=>setFilter('nao_lidas')}>Não lidas <b>{unread}</b></button></div><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar notificação"/></label></div>
   {x.error&&<p className="errorbox">{x.error}</p>}<div className="notification-list">{visible.map(n=><button className={`notification-row ${n.lida?'read':''}`} key={n.chave} onClick={async()=>{if(!n.lida)await mark(n.chave);if(n.modulo)go(n.modulo,n.entidade_id)}}><span className={`notification-icon ${n.tom||'blue'}`}>{n.icone==='wrench'?<Wrench/>:n.icone==='clock'?<Clock3/>:<Bell/>}</span><span className="notification-copy"><strong>{n.titulo}</strong><span>{n.mensagem}</span></span><span className="notification-meta"><time>{stamp(n.criado_em)}</time>{!n.lida&&<i/>}</span></button>)}</div>{!x.busy&&!visible.length&&<p className="empty">Nenhuma notificação encontrada.</p>}
  </Box>
 </>;
}

export function AgendaPanel({auth}){
 const x=useOperation(auth,'agenda'),[form,setForm]=useState(null);
 const commitments=x.items.filter(i=>i.origem==='agenda'),deadlines=x.items.filter(i=>i.origem!=='agenda');
 const today=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Bahia'});
 const todayCount=commitments.filter(i=>shortDate(i.inicio)===today).length;
 const late=deadlines.filter(i=>i.status==='atrasado').length;
 async function submit(e){e.preventDefault();await x.send(form);setForm(null)}
 return <>
  <section className="reference-metrics four agenda-summary"><div><CalendarDays/><strong>{commitments.length}</strong><span>Compromissos</span></div><div><Clock3/><strong>{todayCount}</strong><span>Para hoje</span></div><div><Wrench/><strong>{deadlines.length}</strong><span>Vencimentos e manutenções</span></div><div><Bell/><strong>{late}</strong><span>Atrasados</span></div></section>
  <div className="agenda-grid"><Box title="Adicionar compromisso"><div className="agenda-create"><CalendarDays/><div><strong>Organize a rotina do condomínio</strong><p>Registre reuniões, assembleias, inspeções e outros compromissos.</p></div><button className="btn primary" onClick={()=>setForm({tipo:'reuniao',titulo:'',inicio:'',fim:'',local:'',responsavel:'',observacoes:''})}><Plus size={16}/> Novo compromisso</button></div></Box><Box title="Próximos compromissos"><div className="appointment-list">{commitments.slice(0,6).map((i,n)=><article key={i.id}><i className={`dot dot-${n%4}`}/><div><strong>{i.titulo}</strong><span>{shortDate(i.inicio)} • {shortTime(i.inicio)}{i.local?` • ${i.local}`:''}</span><small>{i.responsavel||'Responsável não informado'}</small></div></article>)}</div>{!commitments.length&&<p className="empty">Nenhum compromisso cadastrado.</p>}</Box></div>
  <Box title="Vencimentos e manutenções"><DataTable rows={deadlines} columns={[{key:'titulo',label:'Descrição'},{key:'tipo',label:'Tipo',render:r=>cap(r.tipo)},{key:'inicio',label:'Data',render:r=>shortDate(r.inicio)},{key:'local',label:'Local / equipamento'},{key:'responsavel',label:'Responsável'},{key:'status',label:'Status',render:r=><span className={`badge ${r.status==='atrasado'?'red':'orange'}`}>{cap(r.status)}</span>}]}/></Box>
  {form&&<Dialog title="Novo compromisso" onClose={()=>setForm(null)}><form onSubmit={submit}><Field label="Tipo"><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="reuniao">Reunião</option><option value="assembleia">Assembleia</option><option value="inspecao">Inspeção</option><option value="outro">Outro</option></select></Field><Field label="Título"><input required value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></Field><div className="form-grid"><Field label="Início"><input required type="datetime-local" value={form.inicio} onChange={e=>setForm({...form,inicio:e.target.value})}/></Field><Field label="Fim"><input required type="datetime-local" value={form.fim} onChange={e=>setForm({...form,fim:e.target.value})}/></Field><Field label="Local"><input value={form.local} onChange={e=>setForm({...form,local:e.target.value})}/></Field><Field label="Responsável"><input value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}/></Field></div><Field label="Observações"><textarea value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></Field>{x.error&&<p className="errorbox">{x.error}</p>}<button className="btn primary block" disabled={x.busy}>Salvar compromisso</button></form></Dialog>}
 </>;
}

export function ContractsPanel({rows=[],onNew}){
 const active=rows.filter(r=>r.ativo!==false),month=rows.filter(r=>{const d=new Date(r.fim);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}),soon=rows.filter(r=>{const days=(new Date(r.fim)-Date.now())/86400000;return days>=0&&days<=30}),total=rows.reduce((s,r)=>s+Number(r.valor_mensal||0),0);
 return <><section className="reference-metrics four contracts-summary"><div><FileText/><strong>{active.length}</strong><span>Contratos ativos</span></div><div><CalendarDays/><strong>{month.length}</strong><span>Vencem este mês</span></div><div><Clock3/><strong>{soon.length}</strong><span>Vencem em até 30 dias</span></div><div><strong className="metric-money">{money(total)}</strong><span>Valor mensal total</span></div></section><Box title="Lista de contratos" actions={<button className="btn primary" onClick={onNew}><Plus size={16}/> Novo contrato</button>}><DataTable rows={rows} columns={[{key:'titulo',label:'Objeto'},{key:'fornecedor',label:'Fornecedor'},{key:'inicio',label:'Início',render:r=>shortDate(r.inicio)},{key:'fim',label:'Término',render:r=>shortDate(r.fim)},{key:'valor_mensal',label:'Valor',render:r=>money(r.valor_mensal)},{key:'reajuste',label:'Reajuste'},{key:'responsavel',label:'Responsável'},{key:'status',label:'Situação',render:r=><span className={`badge ${new Date(r.fim)<new Date()?'red':soon.some(x=>x.id===r.id)?'orange':'green'}`}>{new Date(r.fim)<new Date()?'Vencido':soon.some(x=>x.id===r.id)?'Vence em breve':'Em dia'}</span>}]}/></Box></>;
}
