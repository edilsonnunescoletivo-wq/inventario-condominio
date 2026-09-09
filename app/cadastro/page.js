'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CadastroPage(){
  const router=useRouter();
  const [f,setF]=useState({nome:'',email:'',senha:'',chave:''});
  const [erro,setErro]=useState('');const [ok,setOk]=useState('');const [loading,setLoading]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  async function enviar(e){e.preventDefault();setErro('');setOk('');setLoading(true);try{
    const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Falha no cadastro');setOk('Cadastro concluído. Você já pode entrar.');setTimeout(()=>router.push('/login'),900);
  }catch(e){setErro(e.message)}finally{setLoading(false)}}
  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-logo"><div className="mark">GC</div><div><strong>Gestão Operacional de Condomínios</strong><div className="muted">Novo acesso</div></div></div>
    <h1>Cadastrar</h1><p>Informe a chave de ativação fornecida pelo administrador.</p>
    <form onSubmit={enviar}>
      <div className="field"><label>Nome</label><input value={f.nome} onChange={e=>set('nome',e.target.value)} minLength={2} required/></div>
      <div className="field"><label>E-mail</label><input type="email" value={f.email} onChange={e=>set('email',e.target.value)} required/></div>
      <div className="field"><label>Senha</label><input type="password" value={f.senha} onChange={e=>set('senha',e.target.value)} minLength={6} required/></div>
      <div className="field"><label>Chave de ativação</label><input value={f.chave} onChange={e=>set('chave',e.target.value.toUpperCase())} required/></div>
      {erro&&<div className="errorbox">{erro}</div>}{ok&&<div className="successbox">{ok}</div>}
      <button className="btn primary block" disabled={loading}>{loading?'Cadastrando...':'Cadastrar'}</button>
    </form><div style={{marginTop:16,textAlign:'center'}}><a href="/login" style={{color:'var(--brand)',fontWeight:650}}>Voltar ao login</a></div>
  </section></main>
}
