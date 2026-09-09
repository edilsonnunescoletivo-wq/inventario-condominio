'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');
  const [erro,setErro]=useState('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{if(localStorage.getItem('token')) router.replace('/dashboard')},[router]);
  async function entrar(e){
    e.preventDefault();setErro('');setLoading(true);
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})});
      const d=await r.json();if(!r.ok) throw new Error(d.error||'Não foi possível entrar');
      localStorage.setItem('token',d.token);router.replace('/dashboard');
    }catch(e){setErro(e.message)}finally{setLoading(false)}
  }
  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-logo"><div className="mark">SC</div><div><strong>Soluções Condo</strong><div className="muted">Gestão Operacional de Condomínios</div></div></div>
    <h1>Entrar</h1><p>Use seu e-mail e senha cadastrados.</p>
    <form onSubmit={entrar}>
      <div className="field"><label>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
      <div className="field"><label>Senha</label><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} required autoComplete="current-password"/></div>
      {erro&&<div className="errorbox">{erro}</div>}
      <button className="btn primary block" disabled={loading}>{loading?'Entrando...':'Entrar'}</button>
    </form>
    <div style={{marginTop:16,textAlign:'center'}}><a href="/cadastro" style={{color:'var(--brand)',fontWeight:650}}>Cadastrar com chave de ativação</a></div>
  </section></main>
}
