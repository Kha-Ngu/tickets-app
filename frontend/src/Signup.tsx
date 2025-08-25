import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from './api';

export default function Signup(){
  const nav = useNavigate();
  const [form, setForm] = useState({firstName:'', lastName:'', email:'', phone:'', password:''});
  const [err,setErr]=useState('');
  const [loading, setLoading] = useState(false);

  async function submit(){
    setErr('');
    if (loading) return;
    setLoading(true);
    try{
      // Preferred path (uses /api → works in dev+prod thanks to server prefix-strip)
      const { token } = await api('/auth/signup', { method:'POST', json: form });
      setToken(token);
      nav('/');
    }catch(primary:any){
      // Defensive fallback: if someone hits /auth directly in dev, proxy now handles it;
      // but keep a direct fetch to be extra resilient.
      try{
        const r = await fetch('/auth/signup', {
          method:'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(form),
        });
        if(!r.ok){
          const txt = await r.text();
          throw new Error(txt || r.statusText);
        }
        const { token } = await r.json();
        if (!token) throw new Error('No token returned');
        setToken(token);
        nav('/');
      }catch(secondary:any){
        setErr(secondary?.message || primary?.message || 'Signup failed');
      }
    }finally{
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Create an account</h2>
      <div className="form-grid">
        <div><label>First name</label><input value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} /></div>
        <div><label>Last name</label><input value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} /></div>
        <div><label>Email</label><input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
        <div><label>Phone</label><input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} /></div>
        <div className="full"><label>Password</label><input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} /></div>
      </div>
      {err && <div style={{color:'crimson',marginTop:8, whiteSpace:'pre-wrap'}}>{err}</div>}
      <div style={{marginTop:12}}>
        <button className="btn btn-primary" disabled={loading} onClick={submit}>
          {loading ? 'Signing up…' : 'Sign up'}
        </button>
      </div>
      <p className="subtitle" style={{marginTop:8}}>Already have an account? <Link to="/login">Log in</Link></p>
    </section>
  );
}