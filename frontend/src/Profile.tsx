import { useEffect, useState } from 'react';
import { api, getToken } from './api';

type Ticket = { eventName:string; location:string; dateISO:string; row:number; col:number; purchasedAt:string };
type Me = { user?: { firstName?:string; lastName?:string; email?:string; phone?:string }, tickets: Ticket[] };

export default function Profile(){
  const [data, setData] = useState<Me>({ tickets: [] });
  const [showExpired, setShowExpired] = useState(false);

  useEffect(()=>{ if(getToken()) api('/me').then(setData).catch(console.error); },[]);
  if(!getToken()) return <section className="card"><h2>Please log in</h2></section>;

  const now = Date.now();
  const byEvent = new Map<string, Ticket[]>();
  const expired: Ticket[] = [];

  for (const t of data.tickets || []) {
    const isPast = new Date(t.dateISO).getTime() < now;
    if (isPast) { expired.push(t); continue; }
    if (!byEvent.has(t.eventName)) byEvent.set(t.eventName, []);
    byEvent.get(t.eventName)!.push(t);
  }

  return (
    <div className="container">
      {/* Profile info panel */}
      <section className="card" style={{padding:18, marginBottom:16}}>
        <h2 style={{marginTop:0}}>Profile</h2>
        {data.user && (
          <div className="subtitle">
            {data.user.firstName} {data.user.lastName} · {data.user.email}{data.user.phone ? ` · ${data.user.phone}` : ''}
          </div>
        )}
      </section>

      {/* Active tickets grouped by event */}
      <section className="card" style={{padding:18, marginBottom:16}}>
        <h3>Your Tickets</h3>
        {Array.from(byEvent.entries()).map(([eventName, list]) => {
          const d = new Date(list[0].dateISO);
          const dateStr = d.toLocaleDateString();
          const timeStr = d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
          return (
            <div key={eventName} className="card" style={{marginBottom:12}}>
              <h4 style={{margin:'8px 0'}}>{eventName}</h4>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr className="subtitle">
                    <th style={{textAlign:'left'}}>Location</th>
                    <th style={{textAlign:'left'}}>Date</th>
                    <th style={{textAlign:'left'}}>Seats</th>
                    <th style={{textAlign:'left'}}>Purchased</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{list[0].location}</td>
                    <td>{dateStr} {timeStr}</td>
                    <td>{list.map(s => `R${s.row+1}-C${s.col+1}`).join(', ')}</td>
                    <td>{list.map(s => new Date(s.purchasedAt).toLocaleString()).join(' | ')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
        {byEvent.size === 0 && <p className="subtitle">No active tickets yet.</p>}
      </section>

      {/* Expired tickets dropdown */}
      <section className="card" style={{padding:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Expired tickets</h3>
          <button className="btn" onClick={()=>setShowExpired(!showExpired)}>{showExpired ? 'Hide' : 'Show'}</button>
        </div>
        {showExpired && (
          <div style={{marginTop:12}}>
            {expired.length === 0 ? <p className="subtitle">None</p> :
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr className="subtitle">
                    <th align="left">Event</th>
                    <th align="left">Location</th>
                    <th align="left">Date</th>
                    <th align="left">Seat</th>
                    <th align="left">Purchased</th>
                  </tr>
                </thead>
                <tbody>
                  {expired.map((t,i)=>{
                    const d = new Date(t.dateISO);
                    return (
                      <tr key={i}>
                        <td>{t.eventName}</td>
                        <td>{t.location}</td>
                        <td>{d.toLocaleDateString()} {d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</td>
                        <td>R{t.row+1}-C{t.col+1}</td>
                        <td>{new Date(t.purchasedAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
          </div>
        )}
      </section>
    </div>
  );
}
