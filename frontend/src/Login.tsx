import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from './api';

export default function Login(){
  const nav = useNavigate();
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [err,setErr]=useState('');

  async function submit(){
    setErr('');
    try{
      const { token } = await api('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
      setToken(token); nav('/'); 
    }catch(_){
      try{
        const r = await fetch('/api/auth/login', {
          method:'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ email, password })
        });
        if(!r.ok){
          const msg = await r.text();
          throw new Error(msg || 'login failed');
        }
        const { token } = await r.json();
        setToken(token); nav('/');
      }catch(e2:any){
        setErr(e2?.message || 'login failed');
      }
    }
  }

  return (
    <section className="card">
      <h2>Login</h2>
      <div className="form-grid">
        <div><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
      </div>
      {err && <div style={{color:'crimson',marginTop:8}}>{err}</div>}
      <div style={{marginTop:12}}><button className="btn btn-primary" onClick={submit}>Login</button></div>
      <p className="subtitle" style={{marginTop:8}}>No account? <Link to="/signup">Sign up</Link></p>
    </section>
  );
}
