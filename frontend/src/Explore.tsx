import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from './api';

type Meta = Record<string, any>;
type EventLite = { name:string; category:string; rows:number; cols:number; location:string; dateISO:string; meta:Meta };

const fmtDate = (iso:string) =>
  new Intl.DateTimeFormat(undefined,{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso));

export default function Explore(){
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState<EventLite[]>([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [cat, setCat] = useState(params.get('cat') || 'All');
  const [city, setCity] = useState(params.get('city') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');

  useEffect(() => {
    api('/events')
      .then(setAll)
      .catch(console.error);
  }, []);

  const cats = useMemo(()=>['All', ...Array.from(new Set(all.map(e=>e.category)))], [all]);

  const results = useMemo(()=>{
    return all.filter(e=>{
      if (cat !== 'All' && e.category !== cat) return false;
      const hay = `${e.name} ${e.location}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (city && !e.location.toLowerCase().includes(city.toLowerCase())) return false;
      const t = new Date(e.dateISO).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime()) return false;
      return true;
    }).sort((a,b)=> new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
  }, [all,q,cat,city,from,to]);

  function runSearch(){
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (cat && cat!=='All') next.set('cat', cat);
    if (city) next.set('city', city);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    setParams(next);
  }

  return (
    <>
      <section className="card" style={{marginBottom:16}}>
        <h2>Explore upcoming</h2>

        <div className="form-row" style={{marginTop:8}}>
          <div style={{flex:2}}>
            <label>Search by name or city</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g., Nova Lights, Chicago" />
          </div>
          <button className="btn" onClick={runSearch}>Search</button>
        </div>

        <div className="form-row" style={{marginTop:8}}>
          <div style={{flex:1}}>
            <label>Category</label>
            <select className="select" value={cat} onChange={e=>setCat(e.target.value)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label>City</label>
            <input value={city} onChange={e=>setCity(e.target.value)} placeholder="City or state" />
          </div>
          <div style={{flex:1}}>
            <label>From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
          <div style={{flex:1}}>
            <label>To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card">
        {results.length === 0 ? <p className="subtitle">No matches yet.</p> :
          <div className="grid">
            {results.map(ev=>(
              <article key={ev.name} className="card event-card">
                <h3>{ev.name}</h3>
                <div className="event-meta">{ev.category} · {ev.location} · {fmtDate(ev.dateISO)}</div>
                <div style={{marginTop:10}}>
                  <Link className="btn btn-primary small" to={`/events/${encodeURIComponent(ev.name)}`}>View event</Link>
                </div>
              </article>
            ))}
          </div>}
      </section>
    </>
  );
}