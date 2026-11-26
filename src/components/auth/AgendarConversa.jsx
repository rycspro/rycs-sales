import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
const data = ts => new Date(ts).toLocaleString('pt-BR', {dateStyle:'full',timeStyle:'short'});
export default function AgendarConversa({ respostas }) {
  const [horarios,setHorarios]=useState([]), [horarioId,setHorario]=useState('');
  const [carregando,setCarregando]=useState(true), [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState(''), [confirmacao,setConfirmacao]=useState(null);
  const [contato,setContato]=useState({empresa:'',nome:'',email:'',telefone:'',aceite:false});
  async function carregar() {
    setCarregando(true); setErro('');
    const r=await api('/agenda-publica/horarios');
    if(!r || r.error) setErro(r?.error || 'Não foi possível carregar a agenda. Tente novamente.');
    else {setHorarios(r.horarios); setHorario('');}
    setCarregando(false);
  }
  useEffect(()=>{carregar();},[]);
  async function reservar(e) {
    e.preventDefault(); if(salvando)return;
    setSalvando(true); setErro('');
    const r=await api('/agenda-publica/reservas',{...contato,horarioId,respostas});
    if(!r || r.error) {setErro(r?.error || 'Não foi possível confirmar a reserva. Tente novamente.');}
    else setConfirmacao(r);
    setSalvando(false);
  }
  if(confirmacao) return <div className="vx-notice" role="status"><h3>📅 Sua conversa está agendada!</h3><p><strong>{data(confirmacao.inicio)}</strong></p><p>Fuso: {fuso}. Duração: {(confirmacao.fim-confirmacao.inicio)/60000} minutos.</p><p>A reunião e suas respostas já estão na agenda interna do closer da RYCS. O contato será feito pelos dados que você informou.</p><p>Guarde este horário. Para alterar ou cancelar, fale com a equipe RYCS.</p></div>;
  return <section aria-label="Agendamento da conversa">
    <h3>📅 Escolha o horário da sua conversa</h3>
    <p className="vx-mut" style={{fontSize:13}}>Os horários estão no fuso {fuso}. As reuniões são reservadas na agenda interna da RYCS.</p>
    {erro && <p role="alert" className="vx-notice">{erro}</p>}
    {carregando ? <p role="status">Consultando horários…</p> : <>
      {horarios.length ? <form onSubmit={reservar}>
        <label className="vx-label" htmlFor="agenda-horario">Horário disponível</label>
        <select id="agenda-horario" className="vx-input" required value={horarioId} onChange={e=>setHorario(e.target.value)}>
          <option value="">Selecione uma data e horário</option>
          {horarios.map(h=><option key={h.id} value={h.id}>{data(h.inicio)} · {(h.fim-h.inicio)/60000} min</option>)}
        </select>
        {[['empresa','Empresa','text',160],['nome','Seu nome','text',120],['email','E-mail de contato','email',254],['telefone','Telefone / WhatsApp','tel',30]].map(([campo,label,type,max])=><div key={campo} style={{marginTop:12}}><label className="vx-label" htmlFor={`agenda-${campo}`}>{label}</label><input id={`agenda-${campo}`} className="vx-input" type={type} required maxLength={max} value={contato[campo]} onChange={e=>setContato({...contato,[campo]:e.target.value})}/></div>)}
        <label style={{display:'flex',gap:10,margin:'18px 0',fontSize:13,lineHeight:1.6}}><input type="checkbox" required checked={contato.aceite} onChange={e=>setContato({...contato,aceite:e.target.checked})}/><span>Autorizo o uso dos dados de contato e das respostas para preparar e realizar esta conversa, conforme a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>
        <button className="vx-btn vx-btn-primary vx-btn-block" disabled={salvando || !horarioId}>{salvando?'Confirmando reserva…':'Confirmar meu agendamento'}</button>
      </form> : !erro && <p className="vx-notice">Ainda não há horários disponíveis. A equipe precisa abrir novos horários na agenda.</p>}
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={salvando} onClick={carregar} style={{marginTop:10}}>Atualizar horários</button>
    </>}
  </section>;
}
