import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api';

type Meta = Record<string, any>;
type EventLite = { name: string; category: string; rows: number; cols: number; location: string; dateISO: string; meta: Meta };
type ByCategory = Record<string, EventLite[]>;
type TrendingItem = EventLite & { popularity: number };

const fmtDate = (iso:string) =>
  new Intl.DateTimeFormat(undefined,{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso));
const fmtHM = (mins:number) => `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')}`;

export default function Home(){
  const [byCat, setByCat] = useState<ByCategory>({});
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [q, setQ] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api('/events/overview')
      .then(d => setByCat(d.byCategory || {}))
      .catch(console.error);

    api('/events/trending')
      .then(d => setTrending(d.trending || []))
      .catch(console.error);
  }, []);

  function searchGo(){
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    nav(`/explore?${params.toString()}`);
  }

  return (
    <>
      {/* Search at the top */}
      <section className="card" style={{marginBottom:16}}>
        <h2>Find your next night out</h2>
        <div className="form-row">
          <div style={{flex:1}}>
            <label>Artist, movie, event or city</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g., Nova Lights, Chicago" />
          </div>
          <button className="btn" onClick={searchGo}>Search</button>
        </div>
        <div style={{display:'flex', gap:10, marginTop:12}}>
          {['Concerts','Movies','Festivals','Conventions'].map(c =>
            <button key={c} className="btn small" onClick={()=>nav(`/explore?cat=${encodeURIComponent(c)}`)}>{c}</button>
          )}
        </div>
      </section>

      {/* Leaderboard (compact) */}
      <section className="card" style={{marginBottom:16}}>
        <h2>TicketChart — Hottest Right Now</h2>
        <ol className="chart">
          {trending.map((t,i)=>(
            <li key={t.name} className={`chart-item ${i<3?'top':''}`}>
              <span className="rank">{i+1}</span>
              <div className="info">
                <div className="title">{t.name}</div>
                <div className="meta">{t.category} · {t.location} · {fmtDate(t.dateISO)}</div>
              </div>
              <div className="score">{t.popularity}</div>
              <Link className="btn btn-primary small" to={`/events/${encodeURIComponent(t.name)}`}>View event</Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Category sections */}
      {Object.entries(byCat).map(([cat, list])=>(
        <section className="card" key={cat} style={{marginBottom:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2>{cat}</h2>
            <button className="btn small" onClick={()=>nav(`/explore?cat=${encodeURIComponent(cat)}`)}>See all</button>
          </div>
          <div className="grid">
            {list.map(ev=>(
              <article key={ev.name} className="card event-card">
                <h3>{ev.name}</h3>
                <div className="event-meta">{ev.location} · {fmtDate(ev.dateISO)}</div>
                {ev.category === 'Movies' && (
                  <div className="cat-meta">
                    <div><b>Trailers start:</b> {fmtDate(ev.meta.startISO)}</div>
                    <div><b>Est. movie start:</b> {fmtDate(ev.meta.estMovieStartISO)}</div>
                    <div><b>Duration:</b> {fmtHM(ev.meta.durationMin)}</div>
                    <div><b>Est. end:</b> {fmtDate(ev.meta.estEndISO)}</div>
                  </div>
                )}
                {ev.category === 'Concerts' && (
                  <div className="cat-meta">
                    <div><b>Artist:</b> {ev.meta.artist}</div>
                    <div><b>Genre:</b> {ev.meta.genre}</div>
                    <div><b>Pre-sale:</b> {fmtDate(ev.meta.presaleISO)}</div>
                    <div><b>General sale:</b> {fmtDate(ev.meta.generalSaleISO)}</div>
                  </div>
                )}
                <div style={{marginTop:10}}>
                  <Link className="btn btn-primary small" to={`/events/${encodeURIComponent(ev.name)}`}>View event</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}