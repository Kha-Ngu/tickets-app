<h1>TicketCharts — Real-Time Ticketing Demo</h1>

<p>
A full-stack demo for browsing events, seeing what’s trending, and
<strong>buying seats with real-time holds</strong> via WebSockets.<br/>
Frontend: React + Vite (SPA). Backend: Node/Express + Socket.io + MongoDB (Atlas).
</p>

<h2>🔗 Live Links</h2>
<ul>
  <li><strong>Website (GitHub Pages):</strong> <a href="https://Kha-Ngu.github.io/tickets-app/">https://Kha-Ngu.github.io/tickets-app/</a></li>
  <li><strong>API (Render):</strong> <a href="https://ticketchart-api.onrender.com">https://ticketchart-api.onrender.com</a>
    <ul>
      <li>Health: <a href="https://ticketchart-api.onrender.com/health">/health</a></li>
    </ul>
  </li>
</ul>

<h2>📖 What It Does</h2>
<ul>
  <li><strong>Browse events</strong> by category with date/location details.</li>
  <li><strong>Trending charts</strong> (“Hottest Right Now”) by popularity score.</li>
  <li><strong>Event page with seat map</strong> (available / held / sold).</li>
  <li><strong>Real-time seat holds</strong> with countdown and demo purchase flow.</li>
  <li><strong>Queue gating</strong> (optional per event) using a lightweight virtual queue.</li>
  <li><strong>Auth</strong> (email/password) with JWT stored in <code>localStorage</code>.</li>
</ul>

<h2>🧱 Architecture</h2>
<ul>
  <li><strong>Frontend (GitHub Pages)</strong> — React + Vite SPA
    <ul>
      <li>Env: <code>VITE_API_BASE</code>, <code>VITE_SOCKET_URL</code>, <code>VITE_BASE_PATH</code></li>
      <li>Router: HashRouter for Pages to avoid 404 on refresh</li>
    </ul>
  </li>
  <li><strong>Backend (Render Web Service)</strong> — Node + Express + Socket.io + MongoDB (Atlas)
    <ul>
      <li>REST API under <code>/</code></li>
      <li>WebSocket at <code>/socket.io</code></li>
      <li>Seeds demo events on startup</li>
    </ul>
  </li>
</ul>

<h2>🧰 Tech Stack</h2>
<ul>
  <li><strong>Frontend:</strong> React 18, Vite, TypeScript, React Router (HashRouter on Pages)</li>
  <li><strong>Backend:</strong> Node.js, Express, Socket.io, MongoDB (Atlas), JWT</li>
  <li><strong>Hosting:</strong> GitHub Pages (frontend), Render (backend)</li>
  <li><strong>CI/CD:</strong> GitHub Actions to build <code>frontend/</code> and publish <code>dist</code> to Pages</li>
</ul>

<h2>🗂 Project Structure (key files)</h2>
<ul>
  <li><code>frontend/</code>
    <ul>
      <li><code>src/App.tsx</code> — routes</li>
      <li><code>src/Home.tsx</code> — intro/featured</li>
      <li><code>src/Explore.tsx</code> — all events</li>
      <li><code>src/Charts.tsx</code> — trending (“Hottest Right Now”)</li>
      <li><code>src/EventPage.tsx</code> — seat map, queue, purchase (socket.io)</li>
      <li><code>src/Login.tsx</code> — <code>api('/auth/login')</code></li>
      <li><code>src/Signup.tsx</code> — <code>api('/auth/signup')</code></li>
      <li><code>src/Profile.tsx</code></li>
      <li><code>src/api.ts</code> — fetch helper (reads <code>VITE_API_BASE</code>, adds JWT)</li>
      <li><code>vite.config.ts</code> — base path (<code>VITE_BASE_PATH</code>), dev proxy → <code>:3000</code></li>
    </ul>
  </li>
  <li><code>backend/</code>
    <ul>
      <li><code>server.js</code> — Express API + Socket.io + seeding + <code>/health</code></li>
      <li><code>.env.example</code> — <code>PORT</code>, <code>JWT_SECRET</code>, <code>MONGODB_URI</code> (local dev)</li>
      <li><code>Dockerfile</code> — optional</li>
    </ul>
  </li>
  <li><code>.github/workflows/deploy-frontend.yml</code> — builds frontend &amp; deploys to GitHub Pages</li>
</ul>

<h2>🧪 Capabilities</h2>
<ul>
  <li><strong>Live holds &amp; purchase flow:</strong> click a seat → held briefly; all clients update instantly. Countdown on held seats; expiry reverts to available.</li>
  <li><strong>Queue gating (optional):</strong> users join a queue for an event; receive position/ETA/active counts; only admitted users can purchase.</li>
  <li><strong>Auth:</strong> email/password signup &amp; login with JWT; <code>api()</code> attaches <code>Authorization</code> header.</li>
</ul>
<p><strong>Note:</strong> Payment UI is a demo. Do <strong>not</strong> enter real card data.</p>

<h2>⚙️ Configuration</h2>

<h3>Frontend (build-time vars)</h3>
<p>Set these in <em>Repository → Settings → Secrets and variables → Variables</em>:</p>
<ul>
  <li><code>VITE_BASE_PATH</code> → <code>/<em>repo-name</em>/</code> (e.g., <code>/tickets-app/</code>)</li>
  <li><code>VITE_API_BASE</code> → <code>https://ticketchart-api.onrender.com</code></li>
  <li><code>VITE_SOCKET_URL</code> → <code>https://ticketchart-api.onrender.com</code></li>
</ul>
<p>The workflow sets <code>VITE_USE_HASH_ROUTER='true'</code> so refresh works on Pages.</p>

<h3>Backend (Render/Railway env)</h3>
<ul>
  <li><code>JWT_SECRET</code> — long random string</li>
  <li><code>MONGODB_URI</code> — Atlas URI (URL-encode special characters)</li>
  <li><em>Do not set</em> <code>PORT</code> — platform injects it</li>
</ul>

<h2>🧭 Pages &amp; Components</h2>
<ul>
  <li><strong>Home</strong>, <strong>Explore</strong>, <strong>Charts</strong></li>
  <li><strong>EventPage</strong> — seat map, holds, queue, purchase</li>
  <li><strong>Login</strong>, <strong>Signup</strong>, <strong>Profile</strong></li>
</ul>

<h2>🩹 Troubleshooting</h2>
<ul>
  <li>Assets 404 on Pages → ensure <code>VITE_BASE_PATH</code> is exactly <code>/<em>repo-name</em>/</code> (with leading &amp; trailing slash), then rebuild.</li>
  <li>Refresh 404 on Pages → HashRouter is enabled at build (<code>VITE_USE_HASH_ROUTER='true'</code>).</li>
  <li>API calls fail → <code>VITE_API_BASE</code>/<code>VITE_SOCKET_URL</code> must point to the Render origin (HTTPS). Rebuild Pages.</li>
  <li>WebSocket fails → confirm the URL and that client uses <code>{ transports: ['websocket'] }</code>.</li>
  <li>“Cannot GET /” on Render → expected for API root (optional friendly route available).</li>
</ul>

<h2>🔒 Notes</h2>
<ul>
  <li>Demo app — do <strong>not</strong> enter real payment details.</li>
  <li>CORS is permissive for demo; harden for production.</li>
  <li>JWT stored in <code>localStorage</code> for simplicity.</li>
</ul>
