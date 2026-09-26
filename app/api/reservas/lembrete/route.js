import { query } from '@/lib/db';
import { requireSession, apiError } from '@/lib/session';
import { audit } from '@/lib/audit';

export const runtime='nodejs';

const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function recipients(value){
  const list=String(value||'').split(';').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!list.length||list.some(x=>!EMAIL_RE.test(x))) throw Object.assign(new Error('A reserva não possui e-mail válido para envio.'),{status:400});
  return [...new Set(list)];
}

export async function POST(request){
  try{
    const u=await requireSession(request);
    if(u.perfil==='consulta'&&!u.is_superadmin) throw Object.assign(new Error('Seu perfil permite apenas consultas.'),{status:403});

    const {id}=await request.json();
    if(!id) throw Object.assign(new Error('Reserva não informada.'),{status:400});

    const r=await query(`SELECT r.id,r.responsavel,r.tipo_evento,r.email_solicitante,r.status,r.observacoes,r.valor_total,r.valor_pago,r.valor_restante,r.inicio,r.fim,
      a.nome area,c.nome condominio,
      to_char(r.inicio AT TIME ZONE 'America/Bahia','DD/MM/YYYY') data_evento,
      to_char(r.inicio AT TIME ZONE 'America/Bahia','HH24:MI') hora_inicio,
      to_char(r.fim AT TIME ZONE 'America/Bahia','HH24:MI') hora_fim
      FROM reservas r
      JOIN areas_reservaveis a ON a.id=r.area_id
      JOIN condominios c ON c.id=r.condominio_id
      WHERE r.id=$1 AND r.condominio_id=$2 LIMIT 1`,[id,u.condominio_id]);
    const reserva=r.rows[0];
    if(!reserva) throw Object.assign(new Error('Reserva não encontrada.'),{status:404});
    if(reserva.status==='cancelada') throw Object.assign(new Error('Não é possível enviar lembrete de uma reserva cancelada.'),{status:409});
    if(new Date(reserva.fim).getTime()<Date.now()) throw Object.assign(new Error('Esta reserva já foi concluída.'),{status:409});

    const to=recipients(reserva.email_solicitante);
    const apiKey=process.env.RESEND_API_KEY;
    const from=process.env.RESERVAS_EMAIL_FROM;
    if(!apiKey||!from) throw Object.assign(new Error('O envio de e-mail ainda não está configurado no servidor.'),{status:503});

    const subject=`Lembrete de reserva - ${reserva.area} - ${reserva.data_evento}`;
    const lines=[
      `Olá, ${reserva.responsavel}!`,
      '',
      `Este é um lembrete da sua reserva no ${reserva.condominio}.`,
      '',
      `Área: ${reserva.area}`,
      `Evento: ${reserva.tipo_evento||'Não informado'}`,
      `Data: ${reserva.data_evento}`,
      `Horário: ${reserva.hora_inicio} às ${reserva.hora_fim}`,
      `Valor total: ${money(reserva.valor_total)}`,
      `Valor pago: ${money(reserva.valor_pago)}`,
      `Valor restante: ${money(reserva.valor_restante)}`,
      ...(reserva.observacoes?['',`Observações: ${reserva.observacoes}`]:[]),
      '',
      'Soluções Condo'
    ];
    const html=`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:640px">
      <h2 style="margin-bottom:4px">Lembrete de reserva</h2>
      <p>Olá, <strong>${esc(reserva.responsavel)}</strong>!</p>
      <p>Este é um lembrete da sua reserva no <strong>${esc(reserva.condominio)}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:18px 0">
        <tr><td style="padding:7px 0"><strong>Área</strong></td><td>${esc(reserva.area)}</td></tr>
        <tr><td style="padding:7px 0"><strong>Evento</strong></td><td>${esc(reserva.tipo_evento||'Não informado')}</td></tr>
        <tr><td style="padding:7px 0"><strong>Data</strong></td><td>${esc(reserva.data_evento)}</td></tr>
        <tr><td style="padding:7px 0"><strong>Horário</strong></td><td>${esc(reserva.hora_inicio)} às ${esc(reserva.hora_fim)}</td></tr>
        <tr><td style="padding:7px 0"><strong>Valor total</strong></td><td>${esc(money(reserva.valor_total))}</td></tr>
        <tr><td style="padding:7px 0"><strong>Valor pago</strong></td><td>${esc(money(reserva.valor_pago))}</td></tr>
        <tr><td style="padding:7px 0"><strong>Valor restante</strong></td><td>${esc(money(reserva.valor_restante))}</td></tr>
      </table>
      ${reserva.observacoes?`<p><strong>Observações:</strong> ${esc(reserva.observacoes)}</p>`:''}
      <p>Atenciosamente,<br><strong>Soluções Condo</strong></p>
    </div>`;

    const sent=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to,subject,text:lines.join('\n'),html})
    });
    if(!sent.ok){
      const detail=await sent.text().catch(()=>'');
      console.error('Falha Resend',sent.status,detail);
      throw Object.assign(new Error('Não foi possível enviar o lembrete por e-mail.'),{status:502});
    }

    await query('UPDATE reservas SET lembrete_enviado_em=now(),atualizado_em=now() WHERE id=$1 AND condominio_id=$2',[id,u.condominio_id]);
    await audit(request,{condominio_id:u.condominio_id,usuario_id:u.id,acao:'enviar_lembrete',modulo:'reservas',entidade_id:id,descricao:'Lembrete de reserva enviado por e-mail',detalhes:{destinatarios:to.length}});
    return Response.json({message:`Lembrete enviado para ${to.join(', ')}.`});
  }catch(e){return apiError(e)}
}
