'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ChevronDown,LogOut,UserRound} from 'lucide-react';

const labelPerfil=u=>u?.is_superadmin?'Super Administrador':u?.tipo_conta==='sindico'?'Síndico':String(u?.perfil||'Usuário').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function TopUserMenu(){
 const pathname=usePathname(),router=useRouter(),box=useRef(null),[user,setUser]=useState(null),[open,setOpen]=useState(false);
 useEffect(()=>{if(pathname!=='/dashboard')return;const token=localStorage.getItem('token');if(!token)return;const cid=localStorage.getItem('condominio_id');fetch('/api/me',{headers:{Authorization:`Bearer ${token}`,...(cid?{'X-Condominio-Id':cid}:{})},cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>d&&setUser(d.user)).catch(()=>{})},[pathname]);
 useEffect(()=>{const close=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
 if(pathname!=='/dashboard'||!user)return null;
 const initial=String(user.nome||user.email||'U').trim().charAt(0).toUpperCase();
 async function logout(){const token=localStorage.getItem('token');const cid=localStorage.getItem('condominio_id');try{await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`,...(cid?{'X-Condominio-Id':cid}:{})}})}catch{}localStorage.removeItem('token');localStorage.removeItem('condominio_id');router.replace('/login');router.refresh()}
 return <div className="global-user-menu" ref={box}>
  <button className="global-user-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu"><span className="global-user-avatar">{initial}</span><span className="global-user-copy"><strong>{user.nome||'Usuário'}</strong><small>{labelPerfil(user)}</small></span><ChevronDown size={17} className={open?'rotated':''}/></button>
  {open&&<div className="global-user-dropdown" role="menu"><div className="global-user-dropdown-head"><UserRound size={18}/><span><strong>{user.nome||'Usuário'}</strong><small>{user.email||labelPerfil(user)}</small></span></div><button role="menuitem" onClick={logout}><LogOut size={18}/> Sair / Deslogar</button></div>}
 </div>
}
