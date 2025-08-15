import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type Item = {
  name:string; category:string; location:string; dateISO:string; popularity:number;
};

const fmt = (iso:string) =>
  new Intl.DateTimeFormat(undefined,{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',year:'numeric'}).format(new Date(iso));

export default function Charts(){
  const [items, setItems] = useState<Item[]>([]);
  useEffect(()=>{ fetch('/api/events/trending').then(r=>r.json()).then(d=>setItems(d.trending||[])); },[]);

  return (
    <section className="card">
      <h2>TicketChart — Hottest Right Now</h2>
      <ol className="chart" style={{maxWidth: '920px', margin:'10px auto 0'}}>
        {items.map((t,i)=>(
          <li key={t.name} className={`chart-item ${i<3?'top':''}`}>
            <span className="rank">{i+1}</span>
            <div className="info">
              <div className="title">{t.name}</div>
              <div className="meta">{t.category} · {t.location} · {fmt(t.dateISO)}</div>
            </div>
            <div className="score">{t.popularity}</div>
            <Link className="btn btn-primary small" to={`/events/${encodeURIComponent(t.name)}`}>View event</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
