import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
const SOCKET_URL: string = (import.meta as any).env?.VITE_SOCKET_URL || '/';
import { api, getToken } from './api';

type SeatStatus = 'available'|'held'|'sold';
type EventData = {
  name: string; rows: number; cols: number; seats: SeatStatus[][];
  location: string; dateISO: string; gated?: boolean; queueRequired?: boolean;
};
type SeatUpdate = { row:number; col:number; status:SeatStatus; expiresAt?: number; };

const DEFAULT_HOLD_MS = 120_000;

export default function EventPage(){
  const { name = '' } = useParams();
  const [ev, setEv] = useState<EventData | null>(null);
  const [holdExpires, setHoldExpires] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [queue, setQueue] = useState<{admitted:boolean; position:number; activeCount:number; queueLength:number}>({admitted:false, position:0, activeCount:0, queueLength:0});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSeat, setActiveSeat] = useState<{r:number;c:number}|null>(null);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', cardNumber:'', expiry:'', cvc:'' });
  const [errors, setErrors] = useState<any>({});

  const socketRef = useRef<Socket|null>(null);
  const seatKey = (r:number,c:number)=>`${r}-${c}`;

  // Load event
  useEffect(()=>{
  // Use api(...) so it respects VITE_API_BASE in production
  api(`/events/by-name/${encodeURIComponent(name)}`)
    .then(setEv)
    .catch(console.error);
}, [name]);

  // Socket
  useEffect(()=>{
    const s = io(SOCKET_URL, { path:'/socket.io', transports:['websocket'] });
    socketRef.current = s;
    s.emit('join:event', name);
    return ()=>{ s.disconnect(); };
  }, [name]);

  // Live seat + queue updates
  useEffect(()=>{
    const s = socketRef.current; if(!s) return;
    const onSeat = (msg: SeatUpdate) => {
      setEv(prev => {
        if(!prev) return prev;
        const copy = structuredClone(prev);
        copy.seats[msg.row][msg.col] = msg.status;
        return copy;
      });
      const key = seatKey(msg.row,msg.col);
      if (msg.status==='held'){
        setHoldExpires(prev => ({...prev, [key]: typeof msg.expiresAt==='number'? msg.expiresAt : Date.now()+DEFAULT_HOLD_MS}));
      } else {
        setHoldExpires(prev => { const { [key]:_, ...rest } = prev; return rest; });
      }
      if (activeSeat && activeSeat.r===msg.row && activeSeat.c===msg.col && msg.status!=='held'){
        setIsModalOpen(false); setActiveSeat(null);
      }
    };
    const onQ = (m:any)=> setQueue(q=>({...q, ...m}));
    s.on('seat:update', onSeat);
    s.on('queue:update', onQ);
    return ()=>{ s.off('seat:update', onSeat); s.off('queue:update', onQ); };
  }, [activeSeat]);

  // countdown tick
  useEffect(()=>{ const t=setInterval(()=>setNowMs(Date.now()), 1000); return ()=>clearInterval(t); }, []);

  const seatClass = useMemo(()=> (status:SeatStatus)=>`seat ${status}`, []);

  // --- Queue join/poll if logged in ---
  useEffect(()=>{
    let stop = false;
    async function loop(){
      if(!getToken()) return;
      try{ await api(`/queue/${encodeURIComponent(name)}/join`, { method:'POST' }); }catch{}
      while(!stop){
        try{
          const s = await api(`/queue/${encodeURIComponent(name)}/status`);
          setQueue(s);
        }catch{}
        await new Promise(r=>setTimeout(r, 2000));
      }
    }
    loop();
    return ()=>{ stop = true; if(getToken()) api(`/queue/${encodeURIComponent(name)}/leave`, { method:'POST' }).catch(()=>{}); };
  }, [name]);

  // Hold / Unhold / Purchase
  async function holdNow(r:number,c:number){
    const res = await api(`/events/${encodeURIComponent(name)}/hold`, { method:'POST', body: JSON.stringify({ row:r, col:c }) });
    const expiresAt = (res?.expiresAt && typeof res.expiresAt==='number') ? res.expiresAt : Date.now()+DEFAULT_HOLD_MS;
    setHoldExpires(prev=>({ ...prev, [seatKey(r,c)]: expiresAt }));
  }
  async function unholdNow(r:number,c:number){
    try{ await api(`/events/${encodeURIComponent(name)}/unhold`, { method:'POST', body: JSON.stringify({ row:r, col:c }) }); }catch{}
  }
  async function purchase(r:number,c:number){
    await api(`/events/${encodeURIComponent(name)}/purchase`, { method:'POST', body: JSON.stringify({ row:r, col:c }) });
  }

  function fmt(ms:number){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`; }

  async function onSeatClick(r:number,c:number,status:SeatStatus){
    if(status!=='available' || !queue.admitted){ return; }
    setActiveSeat({r,c}); setErrors({}); setIsModalOpen(true);
    await holdNow(r,c);
  }

  // validators
  const luhn=(num:string)=>{ const d=num.replace(/\D/g,''); let sum=0,alt=false; for(let i=d.length-1;i>=0;i--){ let n=+d[i]; if(alt){ n*=2; if(n>9) n-=9; } sum+=n; alt=!alt; } return d.length>=13&&d.length<=19&&sum%10===0; };
  const validEmail=(e:string)=>/^\S+@\S+\.\S+$/.test(e.trim());
  const validPhone=(p:string)=>p.replace(/\D/g,'').length>=10;
  const validExpiry=(exp:string)=>{ const m=exp.trim(); const m1=/^(\d{2})\s*\/\s*(\d{2})$/, m2=/^(\d{2})\s*\/\s*(\d{4})$/; let mm=0,yy=0; if(m1.test(m)){const[,a,b]=m.match(m1)!; mm=+a; yy=2000+ +b;} else if(m2.test(m)){const[,a,b]=m.match(m2)!; mm=+a; yy=+b;} else return false; if(mm<1||mm>12)return false; const d=new Date(yy,mm,0); d.setHours(23,59,59,999); return d.getTime()>=Date.now(); };

  function validate(){
    const e:any={};
    if(!form.firstName.trim()) e.firstName='Required';
    if(!form.lastName.trim()) e.lastName='Required';
    if(!validEmail(form.email)) e.email='Invalid email';
    if(!validPhone(form.phone)) e.phone='Invalid phone';
    if(!luhn(form.cardNumber)) e.cardNumber='Invalid card';
    if(!validExpiry(form.expiry)) e.expiry='Invalid/expired';
    if(!/^\d{3,4}$/.test(form.cvc.trim())) e.cvc='3–4 digits';
    setErrors(e);
    return Object.keys(e).length===0;
  }

  async function closeModal(){
    if(activeSeat) await unholdNow(activeSeat.r, activeSeat.c);
    setIsModalOpen(false); setActiveSeat(null);
  }
  async function saveKeep(){ if(!validate())return; setIsModalOpen(false); setActiveSeat(null); }
  async function buyNow(){ if(!validate() || !activeSeat) return; await purchase(activeSeat.r, activeSeat.c); setIsModalOpen(false); setActiveSeat(null); }

  if(!ev) return <section className="card"><h2>Loading event…</h2></section>;

  // Use server's 'gated' (or legacy queueRequired) to decide
  const requiresQueue = (ev as any).gated ?? (ev as any).queueRequired ?? false;
  const showQueueScreen = requiresQueue && (!queue.admitted || !getToken());

  const date = new Date(ev.dateISO);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

  return (
    <>
      <section className="card" style={{marginBottom:16}}>
        <h2 style={{marginBottom:8}}>{ev.name}</h2>
        <div className="event-meta">{ev.location} · {dateStr} {timeStr}</div>
        <div style={{marginTop:8, color:'#9aa3b2'}}>
          {requiresQueue ? (
            getToken()
              ? (queue.admitted
                  ? <span>You’re <b>ADMITTED</b> to buy (active: {queue.activeCount}).</span>
                  : <span>You're currently in the queue… <b>{queue.position || 'waiting'}</b> people ahead.</span>)
              : <span><b>Log in</b> to join the queue for this event.</span>
          ) : <span>No queue for this event.</span>}
        </div>
      </section>

      {showQueueScreen ? (
        <section className="card" style={{padding:28, textAlign:'center'}}>
          <h3>You're currently in the queue…</h3>
          <p className="subtitle">{queue.position || 'Waiting'} people ahead.</p>
        </section>
      ) : (
        <section className="card seat-card">
          <div className="center" style={{marginBottom:12, color:'var(--muted)', letterSpacing:2}}>
            — SCREEN THIS SIDE —
          </div>
          <div style={{display:'grid', placeItems:'center'}}>
            <div className="seat-grid" role="grid" aria-label="Seat map" aria-rowcount={ev.rows} aria-colcount={ev.cols}
                 style={{display:'grid', gridTemplateColumns:`repeat(${ev.cols}, 36px)`, gridAutoRows:'36px', gap:'8px', justifyContent:'center'}}>
              {ev.seats.map((row, r) =>
                row.map((status, c) => {
                  const key = seatKey(r,c);
                  const exp = holdExpires[key];
                  const ms = status==='held' && typeof exp==='number' ? exp - nowMs : 0;
                  const show = status==='held' && ms>0;
                  return (
                    <button
                      key={`${r}-${c}`}
                      aria-label={`Row ${r+1} Seat ${c+1} ${status}`}
                      className={seatClass(status)}
                      onClick={() => onSeatClick(r,c,status)}
                      title={`Row ${r+1} Seat ${c+1} — ${status}${show?` (${fmt(ms)} remaining)`:''}`}
                      style={{width:36, height:36}}
                    >
                      {show ? <span className="countdown">{fmt(ms)}</span> : c+1}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="legend" style={{marginTop:12, justifyContent:'center', display:'flex', gap:10}}>
            <span className="pill available">available</span>
            <span className="pill held">held</span>
            <span className="pill sold">sold</span>
          </div>
        </section>
      )}

      {isModalOpen && activeSeat && (
        <div className="modal-backdrop" onClick={(e)=>{ if(e.target===e.currentTarget) closeModal(); }}>
          <div className="modal panel-strong" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="payTitle">
            <h3 id="payTitle">Seat held – Row {activeSeat.r+1}, Seat {activeSeat.c+1}</h3>
            <p className="hint">Demo only — do not enter real payment info.</p>
            <div className="modal-grid">
              <div><label htmlFor="fn">First name</label><input id="fn" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} /></div>
              <div><label htmlFor="ln">Last name</label><input id="ln" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} /></div>
              <div><label htmlFor="em">Email</label><input id="em" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
              <div><label htmlFor="ph">Phone</label><input id="ph" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="(555) 123-4567" /></div>
              <div className="full"><label htmlFor="cc">Card number</label><input id="cc" value={form.cardNumber} onChange={e=>setForm({...form, cardNumber:e.target.value})} placeholder="4242 4242 4242 4242" /></div>
              <div><label htmlFor="ex">Expiry (MM/YY)</label><input id="ex" value={form.expiry} onChange={e=>setForm({...form, expiry:e.target.value})} placeholder="12/27" /></div>
              <div><label htmlFor="cvc">CVC</label><input id="cvc" value={form.cvc} onChange={e=>setForm({...form, cvc:e.target.value})} placeholder="123" /></div>
            </div>
            <div style={{ color:'crimson', fontSize:12, marginTop: 6 }}>
              {Object.values(errors).length > 0 && 'Please fix the highlighted fields.'}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn" onClick={saveKeep}>Save & Keep Held</button>
              <button className="btn btn-primary" onClick={buyNow}>Purchase Now</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
