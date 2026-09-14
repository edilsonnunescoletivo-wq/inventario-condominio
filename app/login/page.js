'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');const [show,setShow]=useState(false);
  const [erro,setErro]=useState('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{if(localStorage.getItem('token')) router.replace('/dashboard')},[router]);
  async function entrar(e){
    e.preventDefault();setErro('');setLoading(true);
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})});
      const d=await r.json();if(!r.ok) throw new Error(d.error||'Não foi possível entrar');
      localStorage.setItem('token',d.token);if(d.condominios?.[0])localStorage.setItem('condominio_id',d.condominios[0].condominio_id);router.replace('/dashboard');
    }catch(e){setErro(e.message)}finally{setLoading(false)}
  }
  return <main className="auth-shell reference-login"><div className="login-message"><strong>Condomínios mais organizados para um futuro melhor.</strong><span>Gestão eficiente • Mais segurança • Convivência harmônica</span></div><section className="auth-card">
    <div className="auth-logo"><div className="mark">SC</div><div><strong>Soluções Condo</strong><div className="muted">Gestão Condominial</div></div></div>
    <h1>Bem-vindo</h1><p>Entre para acompanhar seus condomínios.</p>
    <form onSubmit={entrar}>
      <div className="field"><label>E-mail</label><input type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
      <div className="field"><label>Senha</label><div className="password-input"><input type={show?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} required autoComplete="current-password"/><button type="button" className="btn light small" aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Ocultar':'Mostrar'}</button></div></div>
      {erro&&<div className="errorbox">{erro}</div>}
      <button className="btn primary block" disabled={loading}>{loading?'Entrando...':'Entrar'}</button>
    </form>
    <div className="login-links"><a href="/recuperar-senha">Esqueci minha senha</a><a href="/morador">Acesso do morador</a></div><div className="login-divider">Gestão. Transparência. Tranquilidade.</div><div style={{marginTop:16,textAlign:'center'}}><a href="/cadastro" style={{color:'var(--brand)',fontWeight:650}}>Cadastrar com chave de ativação</a></div>
  </section></main>
}
