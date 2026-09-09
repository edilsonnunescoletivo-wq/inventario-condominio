'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, ClipboardCheck, FileText,
  Gauge, HardHat, LayoutDashboard, MessageSquareText, PackageSearch, QrCode,
  ShieldCheck, Smartphone, Sparkles, UsersRound, Wrench, Menu, X, BarChart3, Clock3
} from 'lucide-react';

const modules = [
  {icon: CalendarDays, title:'Reservas', text:'Controle espaços, eventos, valores, pagamentos e lembretes em um só lugar.'},
  {icon: Wrench, title:'Manutenção e O.S.', text:'Acompanhe solicitações, prioridades, execução e histórico operacional.'},
  {icon: ClipboardCheck, title:'Checklists', text:'Padronize rotinas e registre inspeções das áreas comuns.'},
  {icon: PackageSearch, title:'Estoque e inventário', text:'Tenha visão dos materiais, ferramentas, bens e movimentações.'},
  {icon: MessageSquareText, title:'Ocorrências e comunicação', text:'Centralize registros importantes e mantenha a gestão bem informada.'},
  {icon: FileText, title:'Documentos e relatórios', text:'Organize documentos e gere relatórios para apoiar decisões e prestações de contas.'},
];

const benefits = [
  'Mais controle sobre a rotina operacional',
  'Histórico centralizado de atividades',
  'Redução de controles paralelos e planilhas soltas',
  'Informações acessíveis pelo celular ou computador',
  'Indicadores para acompanhamento da administração',
  'Padronização das rotinas do condomínio',
];

export default function CommercialPage(){
  const [menuOpen,setMenuOpen]=useState(false);
  const [logged,setLogged]=useState(false);
  useEffect(()=>{setLogged(Boolean(localStorage.getItem('token')))},[]);
  const accessHref=logged?'/dashboard':'/login';

  return <main className="landing">
    <header className="landing-nav">
      <div className="landing-container nav-inner">
        <Link href="/" className="landing-brand" aria-label="Soluções Condo">
          <div className="landing-brandmark"><Building2 size={22}/></div>
          <div><strong>Soluções Condo</strong><span>Gestão Operacional</span></div>
        </Link>
        <nav className="desktop-nav">
          <a href="#solucao">A solução</a><a href="#modulos">Módulos</a><a href="#planos">Planos</a><a href="#beneficios">Benefícios</a><a href="#gestao">Para sua gestão</a>
        </nav>
        <div className="nav-cta">
          <Link href={accessHref} className="landing-btn ghost">{logged?'Ir para o painel':'Acessar sistema'}</Link>
          <a href="#contato" className="landing-btn primary">Conhecer a solução <ArrowRight size={17}/></a>
        </div>
        <button className="mobile-menu-btn" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen?<X/>:<Menu/>}</button>
      </div>
      {menuOpen&&<div className="mobile-menu">
        <a href="#solucao" onClick={()=>setMenuOpen(false)}>A solução</a><a href="#modulos" onClick={()=>setMenuOpen(false)}>Módulos</a><a href="#planos" onClick={()=>setMenuOpen(false)}>Planos</a><a href="#beneficios" onClick={()=>setMenuOpen(false)}>Benefícios</a><a href="#gestao" onClick={()=>setMenuOpen(false)}>Para sua gestão</a>
        <Link href={accessHref} className="landing-btn primary" onClick={()=>setMenuOpen(false)}>{logged?'Ir para o painel':'Acessar sistema'}</Link>
      </div>}
    </header>

    <section className="hero" id="solucao">
      <div className="hero-glow one"/><div className="hero-glow two"/>
      <div className="landing-container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={16}/> Gestão operacional mais simples, organizada e inteligente</div>
          <h1>Mais controle para cuidar de tudo o que faz o condomínio funcionar.</h1>
          <p>Uma plataforma criada para centralizar a rotina operacional de condomínios, conectando reservas, manutenção, checklists, inventário, ocorrências, documentos e gestão em um único ambiente.</p>
          <div className="hero-actions">
            <Link href={accessHref} className="landing-btn primary large">{logged?'Abrir meu painel':'Acessar o sistema'} <ArrowRight size={19}/></Link>
            <a href="#modulos" className="landing-btn light large">Ver funcionalidades</a>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2/> Rotina centralizada</span><span><CheckCircle2/> Acesso web</span><span><CheckCircle2/> Informações em tempo real</span>
          </div>
        </div>
        <div className="hero-product" aria-label="Prévia do painel do sistema">
          <div className="product-window">
            <div className="window-bar"><span/><span/><span/><div>Soluções Condo • Painel Operacional</div></div>
            <div className="product-layout">
              <aside className="mock-sidebar">
                <div className="mock-logo"><Building2 size={18}/></div>
                {[LayoutDashboard,CalendarDays,Wrench,ClipboardCheck,PackageSearch,FileText].map((Icon,i)=><div key={i} className={`mock-nav ${i===0?'active':''}`}><Icon size={16}/><span>{['Visão geral','Reservas','Manutenção','Checklists','Inventário','Documentos'][i]}</span></div>)}
              </aside>
              <div className="mock-main">
                <div className="mock-top"><div><small>VISÃO GERAL</small><strong>Bom dia, Administração</strong></div><div className="mock-avatar">AD</div></div>
                <div className="mock-metrics">
                  <div><Gauge/><span>Chamados abertos</span><strong>12</strong></div>
                  <div><CalendarDays/><span>Próximas reservas</span><strong>08</strong></div>
                  <div><ClipboardCheck/><span>Checklists hoje</span><strong>05</strong></div>
                </div>
                <div className="mock-panels">
                  <div className="mock-card large-card"><div className="mock-card-title"><strong>Atividades recentes</strong><span>Hoje</span></div>
                    {[['Manutenção','Portão social','Em andamento'],['Reserva','Salão de festas','Confirmada'],['Checklist','Área da piscina','Concluído']].map((r,i)=><div className="mock-row" key={i}><div className={`mock-dot d${i}`}/><div><strong>{r[0]}</strong><span>{r[1]}</span></div><em>{r[2]}</em></div>)}
                  </div>
                  <div className="mock-card"><div className="mock-card-title"><strong>Operação</strong></div><div className="progress-ring">87<small>%</small></div><p>Rotinas concluídas no período</p></div>
                </div>
              </div>
            </div>
          </div>
          <div className="floating-card fc-one"><ShieldCheck/><div><strong>Gestão organizada</strong><span>Dados centralizados</span></div></div>
          <div className="floating-card fc-two"><Smartphone/><div><strong>Acesse de onde estiver</strong><span>Celular, tablet ou computador</span></div></div>
        </div>
      </div>
    </section>

    <section className="proof-strip">
      <div className="landing-container proof-grid">
        <div><strong>1 plataforma</strong><span>para centralizar a operação</span></div>
        <div><strong>Rotina integrada</strong><span>do registro ao acompanhamento</span></div>
        <div><strong>Visão gerencial</strong><span>para decisões mais rápidas</span></div>
        <div><strong>100% web</strong><span>acesso simples e responsivo</span></div>
      </div>
    </section>

    <section className="landing-section modules-section" id="modulos">
      <div className="landing-container">
        <div className="section-heading centered"><span className="section-kicker">FUNCIONALIDADES</span><h2>Uma visão completa da operação do condomínio</h2><p>Menos informações espalhadas e mais controle para quem administra, supervisiona e executa.</p></div>
        <div className="modules-grid">{modules.map(({icon:Icon,title,text})=><article className="module-card" key={title}><div className="module-icon"><Icon/></div><h3>{title}</h3><p>{text}</p><span>Gestão integrada <ArrowRight size={15}/></span></article>)}</div>
      </div>
    </section>

    <section className="landing-section pricing-section" id="planos">
      <div className="landing-container">
        <div className="section-heading centered"><span className="section-kicker">PLANOS</span><h2>Escolha o nível de gestão ideal para o seu condomínio</h2><p>Comece com o essencial e evolua para uma operação completa, com controle de equipes, ponto, auditoria e automações.</p></div>
        <div className="pricing-grid">
          <article className="pricing-card">
            <div className="plan-name">Básico</div><p className="plan-purpose">Organização essencial para condomínios que querem deixar planilhas e controles dispersos.</p>
            <div className="plan-price"><strong>R$ 99,00</strong><span>/ mês</span></div>
            <div className="plan-users">Até 3 usuários administrativos</div>
            <div className="plan-features">
              {['Dashboard','Inventário','Materiais e estoque','Fornecedores','Unidades e moradores','Documentos','Comunicados','Reservas','Segurança e isolamento dos dados'].map(x=><div key={x}><CheckCircle2/><span>{x}</span></div>)}
            </div><a href="mailto:contato@solucoescondo.com.br?subject=Plano%20B%C3%A1sico%20Solu%C3%A7%C3%B5es%20Condo" className="landing-btn light large plan-btn">Quero o Básico</a>
          </article>
          <article className="pricing-card featured">
            <div className="popular-tag">MAIS COMPLETO PARA A OPERAÇÃO</div><div className="plan-name">Avançado</div><p className="plan-purpose">Gestão operacional completa para administrar equipes, serviços, manutenção e recursos.</p>
            <div className="plan-price"><strong>R$ 149,00</strong><span>/ mês</span></div>
            <div className="plan-users">Até 10 usuários administrativos</div>
            <div className="plan-features">
              {['Tudo do Básico','Controle financeiro de reservas','WhatsApp nas reservas','Cotações','Ferramentas e empréstimos','Manutenções preventivas e O.S.','Ocorrências e checklists','Contratos e relatórios avançados','Gestão de colaboradores','Tratamento de relógio de ponto','Importação e tratamento de marcações','Banco de horas, atrasos e faltas','Escalas, jornadas e frequência','Perfis e permissões'].map(x=><div key={x}><CheckCircle2/><span>{x}</span></div>)}
            </div><a href="mailto:contato@solucoescondo.com.br?subject=Plano%20Avan%C3%A7ado%20Solu%C3%A7%C3%B5es%20Condo" className="landing-btn primary large plan-btn">Quero o Avançado</a>
          </article>
          <article className="pricing-card premium-card">
            <div className="plan-name">Premium</div><p className="plan-purpose">Controle, inteligência e automação para condomínios de maior porte e administradoras.</p>
            <div className="plan-price"><strong>R$ 399,00</strong><span>/ mês</span></div>
            <div className="plan-users">Franquia ampliada de usuários</div>
            <div className="plan-features">
              {['Tudo do Avançado','Auditoria de atividades','Histórico detalhado de alterações','Múltiplos condomínios por usuário','Gestão centralizada','Automações avançadas','Integração automática com relógio de ponto','Comunicação com equipamentos compatíveis','Centralização de vários relógios/condomínios','Relatórios executivos','Suporte prioritário'].map(x=><div key={x}><CheckCircle2/><span>{x}</span></div>)}
            </div><a href="mailto:contato@solucoescondo.com.br?subject=Plano%20Premium%20Solu%C3%A7%C3%B5es%20Condo" className="landing-btn dark large plan-btn">Quero o Premium</a>
          </article>
        </div>
        <div className="point-highlight"><div className="point-highlight-icon"><Clock3/></div><div><strong>Gestão de Ponto integrada à operação</strong><p>No Avançado, trate marcações, jornadas, banco de horas, atrasos e faltas. No Premium, a proposta inclui integração automática com relógios de ponto compatíveis para centralizar equipamentos e condomínios.</p></div></div>
        <p className="pricing-note"><ShieldCheck size={16}/> Segurança, autenticação, isolamento dos dados por condomínio e proteção da plataforma fazem parte de todos os planos.</p>
      </div>
    </section>

    <section className="landing-section alt" id="beneficios">
      <div className="landing-container split-section">
        <div className="visual-stack">
          <div className="visual-card main-visual"><div className="mini-head"><span>Indicadores operacionais</span><BarChart3/></div><div className="bar-chart">{[58,76,48,86,68,94,82].map((h,i)=><div key={i}><span style={{height:`${h}%`}}/><small>{['S','T','Q','Q','S','S','D'][i]}</small></div>)}</div></div>
          <div className="visual-card mini-visual"><QrCode/><div><strong>Registros rastreáveis</strong><span>Organização e histórico</span></div></div>
          <div className="visual-card mini-visual second"><UsersRound/><div><strong>Equipe alinhada</strong><span>Informação no mesmo lugar</span></div></div>
        </div>
        <div className="section-heading"><span className="section-kicker">MAIS EFICIÊNCIA</span><h2>Transforme a rotina operacional em informação para gestão.</h2><p>O sistema ajuda a tirar a operação do improviso, criando processos mais claros, rastreáveis e fáceis de acompanhar.</p><div className="benefit-list">{benefits.map(x=><div key={x}><CheckCircle2/><span>{x}</span></div>)}</div></div>
      </div>
    </section>

    <section className="landing-section" id="gestao">
      <div className="landing-container">
        <div className="section-heading centered"><span className="section-kicker">FEITO PARA CONDOMÍNIOS</span><h2>Da administração à equipe operacional</h2><p>Uma ferramenta pensada para quem precisa acompanhar o dia a dia sem perder a visão do todo.</p></div>
        <div className="audience-grid">
          <article><div><Building2/></div><h3>Administradoras e síndicos</h3><p>Acompanhe indicadores, reservas, ocorrências, documentos e demandas importantes para a gestão.</p></article>
          <article><div><HardHat/></div><h3>Gerentes e supervisores</h3><p>Organize prioridades, acompanhe execução e tenha histórico das rotinas e serviços.</p></article>
          <article><div><UsersRound/></div><h3>Equipes operacionais</h3><p>Rotinas mais claras, checklists padronizados e registros acessíveis de forma simples.</p></article>
        </div>
      </div>
    </section>

    <section className="cta-section" id="contato">
      <div className="landing-container cta-box">
        <div><span className="section-kicker light-kicker">SOLUÇÕES CONDO</span><h2>Sua operação mais organizada começa com uma visão melhor.</h2><p>Centralize a rotina operacional do condomínio e transforme registros do dia a dia em gestão.</p></div>
        <div className="cta-actions"><Link href={accessHref} className="landing-btn white large">{logged?'Ir para o painel':'Acessar o sistema'} <ArrowRight size={19}/></Link><a href="mailto:contato@solucoescondo.com.br" className="landing-btn outline-white large">Falar sobre a solução</a></div>
      </div>
    </section>

    <footer className="landing-footer"><div className="landing-container footer-inner"><div className="landing-brand"><div className="landing-brandmark"><Building2 size={20}/></div><div><strong>Soluções Condo</strong><span>Gestão Operacional</span></div></div><p>Gestão operacional de condomínios com mais organização, controle e informação.</p><span>© 2026 Soluções Condo</span></div></footer>
  </main>
}
