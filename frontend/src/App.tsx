import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import Home from './Home';
import EventPage from './EventPage';
import Login from './Login';
import Signup from './Signup';
import Profile from './Profile';
import Charts from './Charts';
import Explore from './Explore';
import { getToken, setToken } from './api';

export default function App(){
  const nav = useNavigate();
  const isAuthed = !!getToken();
  const logout = () => { setToken(''); nav('/'); };

  return (
    <div className="container">
      <header className="hero">
        <div className="nav">
          <h1 className="title" style={{margin:0}}>TicketChart</h1>
          <nav style={{display:'flex', gap:14}}>
            <Link to="/">Home</Link>
            <Link to="/explore">Explore</Link>
            <Link to="/charts">Charts</Link>
            {isAuthed ? <>
              <Link to="/profile">Profile</Link>
              <a href="#" onClick={(e)=>{e.preventDefault(); logout();}}>Logout</a>
            </> : <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign up</Link>
            </>}
          </nav>
        </div>
        <p className="subtitle">Live event seating with real-time holds & purchases.</p>
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
  );
}