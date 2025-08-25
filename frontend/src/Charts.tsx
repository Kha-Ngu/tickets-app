import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';

type Item = {
  name: string;
  category: string;
  location: string;
  dateISO: string;
  popularity: number;
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));

export default function Charts() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api('/events/trending'); // ✅ honors VITE_API_BASE
        if (!cancelled) setItems((d?.trending as Item[]) || []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load trending events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card">
      <h2>TicketChart — Hottest Right Now</h2>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      {!loading && !err && (
        <ol className="chart" style={{ maxWidth: '920px', margin: '10px auto 0' }}>
          {items.map((t, i) => (
            <li key={`${t.name}-${t.dateISO}`} className={`chart-item ${i < 3 ? 'top' : ''}`}>
              <span className="rank">{i + 1}</span>
              <div className="info">
                <div className="title">{t.name}</div>
                <div className="meta">
                  {t.category} · {t.location} · {fmt(t.dateISO)}
                </div>
              </div>
              <div className="score">{t.popularity}</div>
              <Link className="btn btn-primary small" to={`/events/${encodeURIComponent(t.name)}`}>
                View event
              </Link>
            </li>
          ))}
          {items.length === 0 && <li style={{ color: 'var(--muted)' }}>No trending events.</li>}
        </ol>
      )}
    </section>
  );
}
