// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './api';

import Home from './Home';
import Explore from './Explore';
import Charts from './Charts';
import EventPage from './EventPage';
import Login from './Login';
import Signup from './Signup';
import Profile from './Profile';

// ---- API warmup gate: wait for /health to respond (or time out gracefully) ----
const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || '/api';

function ApiWarmupGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(
    'Starting backend… This can take a few seconds on the free tier.'
  );

  useEffect(() => {
    let stop = false;
    (async () => {
      const deadline = Date.now() + 30_000; // try up to 30s
      while (!stop && Date.now() < deadline) {
        try {
          const r = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
          if (r.ok) {
            setReady(true);
            return;
          }
        } catch {
          // ignore and retry
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      // proceed even if not OK, so the app can still render
      setMessage('Backend may still be waking up. Loading the app…');
      setReady(true);
    })();
    return () => {
      stop = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="container" style={{ padding: 24 }}>
        <header className="hero">
          <div className="nav">
            <h1 className="title" style={{ margin: 0 }}>TicketChart</h1>
          </div>
          <p className="subtitle">{message}</p>
        </header>
        <section className="card" style={{ maxWidth: 720, margin: '24px auto', textAlign: 'center' }}>
          <div
            aria-label="loading"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              margin: '12px auto',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}

// ---- App (unchanged layout, wrapped with ApiWarmupGate) ----
export default function App() {
  const nav = useNavigate();
  const isAuthed = !!getToken();
  const logout = () => { setToken(''); nav('/'); };

  return (
    <ApiWarmupGate>
      <div className="container">
        <header className="hero">
          <div className="nav">
            <h1 className="title" style={{ margin: 0 }}>TicketChart</h1>
            <nav style={{ display: 'flex', gap: 14 }}>
              <Link to="/">Home</Link>
              <Link to="/explore">Explore</Link>
              <Link to="/charts">Charts</Link>
              {isAuthed ? (
                <>
                  <Link to="/profile">Profile</Link>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      logout();
                    }}
                  >
                    Logout
                  </a>
                </>
              ) : (
                <>
                  <Link to="/login">Login</Link>
                  <Link to="/signup">Sign up</Link>
                </>
              )}
            </nav>
          </div>
          <p className="subtitle">Live event seating with real-time holds &amp; purchases.</p>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/events/:name" element={<EventPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </ApiWarmupGate>
  );
}
