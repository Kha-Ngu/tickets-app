import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ---- config ----
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb+srv://khanhngu1804:Btssvt13@cluster0.dx0stdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const PORT = Number(process.env.PORT || 3000);

// ---- app & sockets ----
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/**
 * ✅ Accept both `/api/...` and `/...` by stripping an optional `/api` prefix
 *    before any route handlers run. This makes the backend robust regardless
 *    of the Vite/ingress proxy configuration.
 */
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/")) req.url = req.url.slice(4); // remove '/api'
  next();
});

// ---- Mongo ----
mongoose.set("strictQuery", true);

function maskUri(u) {
  try {
    const url = new URL(u);
    if (url.username || url.password) {
      url.username = "****";
      url.password = "****";
    }
    return url.toString();
  } catch {
    return "<invalid URI>";
  }
}

if (!MONGODB_URI) {
  console.error("❌ No Mongo connection string set. Define MONGODB_URI in your environment.");
  process.exit(1);
}

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("✅ Mongo connected:", maskUri(MONGODB_URI));
} catch (err) {
  console.error("❌ MongoDB connection error:", err?.message || err);
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, index: true },
    phone: String,
    passwordHash: String
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  eventName: { type: String, index: true },
  location: String,
  dateISO: String,
  row: Number,
  col: Number,
  purchasedAt: { type: Date, default: Date.now }
});

const User   = mongoose.model("User",   userSchema);
const Ticket = mongoose.model("Ticket", ticketSchema);

// ---------------- In-memory events ----------------
const THEATER_ROWS = 12;
const THEATER_COLS = 15;

const events = new Map();
const holdTimers = new Map();
const HOLD_MS = Number(process.env.HOLD_MS || 2 * 60 * 1000);
const holdKey = (name, row, col) => `${name}:${row}:${col}`;
const roomFor = (name) => `event:${name}`;

function makeSeatGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill("available"));
}

function admitNext(ev) {
  while (ev.active.size < ev.maxActive && ev.queue.length > 0) {
    const nextUser = ev.queue.shift();
    ev.active.add(nextUser);
  }
  io.to(roomFor(ev.name)).emit("queue:update", {
    activeCount: ev.active.size,
    queueLength: ev.queue.length
  });
}

// ---------------- Auth helpers ----------------
function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: "missing token" });
  try {
    req.user = jwt.verify(tok, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

// ---------------- Health ----------------
app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/health/mongo", async (_req, res) => {
  try {
    await mongoose.connection.db.adminCommand({ ping: 1 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Auth API ----------------
app.post("/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email & password required" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "email taken" });
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await User.create({ firstName, lastName, email, phone, passwordHash });
    return res.json({ token: sign(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const u = await User.findOne({ email });
  if (!u) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password || "", u.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  res.json({ token: sign(u) });
});

app.get("/me", auth, async (req, res) => {
  const u = await User.findById(req.user.id).lean();
  const tickets = await Ticket.find({ userId: req.user.id }).lean();
  res.json({
    user: { firstName: u?.firstName, lastName: u?.lastName, email: u?.email, phone: u?.phone },
    tickets
  });
});

// ---------------- Events API ----------------
app.post("/events", (req, res) => {
  const {
    name, category = "Concerts",
    rows = THEATER_ROWS, cols = THEATER_COLS,
    location, dateISO, meta = {}, gated = false
  } = req.body || {};
  if (!name || !rows || !cols) return res.status(400).json({ error: "name, rows, cols required" });
  if (events.has(name)) return res.status(409).json({ error: "name must be unique" });

  const ev = {
    name, category,
    rows, cols,
    location: location || "TBD Arena",
    dateISO: dateISO || new Date().toISOString(),
    seats: makeSeatGrid(rows, cols),
    queue: [],
    active: new Set(),
    maxActive: 10,
    gated: !!gated,
    meta,
    popularity: Math.floor(Math.random() * 50)
  };
  events.set(name, ev);
  return res.status(201).json(summary(ev));
});

app.get("/events", (_req, res) => {
  const list = Array.from(events.values()).map(summary);
  res.json(list);
});

// Overview grouped by category (sorted by date)
app.get("/events/overview", (_req, res) => {
  const byCat = {};
  for (const ev of events.values()) {
    if (!byCat[ev.category]) byCat[ev.category] = [];
    byCat[ev.category].push(summary(ev));
  }
  for (const k of Object.keys(byCat)) {
    byCat[k].sort((a,b)=> new Date(a.dateISO) - new Date(b.dateISO));
  }
  res.json({ byCategory: byCat });
});

// Simple search endpoint used by Explore
app.get("/events/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();
  const city = String(req.query.city || "").trim().toLowerCase();

  const hit = Array.from(events.values()).filter(e => {
    const inQ = !q || e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) ||
                (e.meta?.artist && String(e.meta.artist).toLowerCase().includes(q));
    const inCat = !category || e.category.toLowerCase() === category;
    const inCity = !city || e.location.toLowerCase().includes(city);
    return inQ && inCat && inCity;
  }).map(summary);

  hit.sort((a,b)=> new Date(a.dateISO) - new Date(b.dateISO));
  res.json({ results: hit });
});

// Leaderboard
app.get("/events/trending", (_req, res) => {
  const list = Array.from(events.values())
    .sort((a,b)=> b.popularity - a.popularity)
    .slice(0, 15)
    .map(e => ({ ...summary(e), popularity: e.popularity }));
  res.json({ trending: list });
});

app.get("/events/by-name/:name", (req, res) => {
  const ev = events.get(req.params.name);
  if (!ev) return res.status(404).json({ error: "not found" });
  ev.popularity += 1;
  res.json(detail(ev));
});

// ---- queue ----
function requireAdmitted(req, res, next) {
  const ev = events.get(req.params.name);
  if (!ev) return res.status(404).json({ error: "not found" });

  if (!ev.gated) { req.ev = ev; return next(); }

  const userId = req.user?.id;
  if (!userId || !ev.active.has(userId)) return res.status(403).json({ error: "not admitted" });
  req.ev = ev; next();
}

app.post("/queue/:name/join", auth, (req, res) => {
  const ev = events.get(req.params.name);
  if (!ev) return res.status(404).json({ error: "not found" });

  if (!ev.gated) {
    ev.popularity += 2;
    return res.json({ admitted: true, position: 0, activeCount: ev.active.size, queueLength: ev.queue.length });
  }

  const userId = req.user.id;
  if (ev.active.has(userId)) {
    ev.popularity += 2;
    return res.json({ admitted: true, position: 0, activeCount: ev.active.size, queueLength: ev.queue.length });
  }
  if (!ev.queue.includes(userId)) ev.queue.push(userId);
  ev.popularity += 3;
  admitNext(ev);

  const position = ev.active.has(userId) ? 0 : ev.queue.indexOf(userId) + 1;
  res.json({ admitted: ev.active.has(userId), position, activeCount: ev.active.size, queueLength: ev.queue.length });
});

app.get("/queue/:name/status", auth, (req, res) => {
  const ev = events.get(req.params.name);
  if (!ev) return res.status(404).json({ error: "not found" });

  if (!ev.gated) return res.json({ admitted: true, position: 0, activeCount: ev.active.size, queueLength: ev.queue.length });

  const userId = req.user.id;
  const admitted = ev.active.has(userId);
  const position = admitted ? 0 : (ev.queue.indexOf(userId) + 1 || 0);
  res.json({ admitted, position, activeCount: ev.active.size, queueLength: ev.queue.length });
});

app.post("/queue/:name/leave", auth, (req, res) => {
  const ev = events.get(req.params.name);
  if (!ev) return res.status(404).json({ error: "not found" });

  if (!ev.gated) return res.json({ ok: true });

  const userId = req.user.id;
  const i = ev.queue.indexOf(userId);
  if (i >= 0) ev.queue.splice(i, 1);
  if (ev.active.has(userId)) ev.active.delete(userId);
  admitNext(ev);
  res.json({ ok: true });
});

// ---------- Hold / Unhold / Purchase (multi-seat) ----------
const normalizeSeats = (body) => {
  if (Array.isArray(body?.seats)) return body.seats;
  if (typeof body?.row === "number" && typeof body?.col === "number") return [{ row: body.row, col: body.col }];
  return [];
};

app.post("/events/:name/hold", auth, requireAdmitted, (req, res) => {
  const ev = req.ev;
  const seats = normalizeSeats(req.body);
  if (seats.length === 0) return res.status(400).json({ error: "invalid seat(s)" });

  for (const { row, col } of seats) {
    if (row < 0 || col < 0 || row >= ev.rows || col >= ev.cols) return res.status(400).json({ error: "invalid seat coords" });
    if (ev.seats[row][col] !== "available") return res.status(409).json({ error: "seat not available" });
  }

  const expiresAt = Date.now() + HOLD_MS;
  const response = [];

  for (const { row, col } of seats) {
    ev.seats[row][col] = "held";

    const key = holdKey(ev.name, row, col);
    if (holdTimers.has(key)) clearTimeout(holdTimers.get(key));
    holdTimers.set(key, setTimeout(() => {
      const cur = events.get(ev.name);
      if (cur && cur.seats[row][col] === "held") {
        cur.seats[row][col] = "available";
        io.to(roomFor(ev.name)).emit("seat:update", { row, col, status: "available" });
      }
      holdTimers.delete(key);
    }, HOLD_MS));

    io.to(roomFor(ev.name)).emit("seat:update", { row, col, status: "held", expiresAt });
    response.push({ row, col, expiresAt });
  }

  res.json({ ok: true, seats: response, expiresInMs: HOLD_MS });
});

app.post("/events/:name/unhold", auth, requireAdmitted, (req, res) => {
  const ev = req.ev;
  const seats = normalizeSeats(req.body);
  if (seats.length === 0) return res.json({ ok: true });

  for (const { row, col } of seats) {
    if (row < 0 || col < 0 || row >= ev.rows || col >= ev.cols) continue;
    if (ev.seats[row][col] !== "held") continue;

    ev.seats[row][col] = "available";
    const key = holdKey(ev.name, row, col);
    if (holdTimers.has(key)) { clearTimeout(holdTimers.get(key)); holdTimers.delete(key); }
    io.to(roomFor(ev.name)).emit("seat:update", { row, col, status: "available" });
  }
  res.json({ ok: true });
});

app.post("/events/:name/purchase", auth, requireAdmitted, async (req, res) => {
  const ev = req.ev;
  const seats = normalizeSeats(req.body);
  if (seats.length === 0) return res.status(400).json({ error: "invalid seat(s)" });

  for (const { row, col } of seats) {
    if (row < 0 || col < 0 || row >= ev.rows || col >= ev.cols) return res.status(400).json({ error: "invalid seat coords" });
    if (ev.seats[row][col] === "sold") return res.status(409).json({ error: "seat not available" });
  }

  const docs = [];
  for (const { row, col } of seats) {
    ev.seats[row][col] = "sold";
    const key = holdKey(ev.name, row, col);
    if (holdTimers.has(key)) { clearTimeout(holdTimers.get(key)); holdTimers.delete(key); }
    io.to(roomFor(ev.name)).emit("seat:update", { row, col, status: "sold" });

    docs.push({
      userId: req.user.id,
      eventName: ev.name,
      location: ev.location,
      dateISO: ev.dateISO,
      row, col
    });
  }
  try { await Ticket.insertMany(docs); } catch (e) { console.error("ticket save failed", e); }

  if (ev.gated && ev.active.has(req.user.id)) {
    ev.active.delete(req.user.id);
    admitNext(ev);
  }
  res.json({ ok: true, count: seats.length });
});

// sockets
io.on("connection", (socket) => {
  socket.on("join:event", (eventName) => {
    const ev = events.get(eventName);
    if (ev) { ev.popularity += 1; socket.join(roomFor(eventName)); }
  });
});

// ---------- helpers ----------
function summary(e) {
  return {
    name: e.name,
    category: e.category,
    rows: e.rows, cols: e.cols,
    location: e.location,
    dateISO: e.dateISO,
    meta: e.meta
  };
}
function detail(e) {
  return {
    ...summary(e),
    seats: e.seats,
    gated: e.gated
  };
}
const randFrom = (arr) => arr[Math.floor(Math.random()*arr.length)];
const minutes = (n) => n * 60 * 1000;

// ---------- seed demo data ----------
(function seedEvents() {
  if (events.size > 0) return;

  const cities = ['Seattle, WA','Austin, TX','Redmond, WA','San Jose, CA','New York, NY','Chicago, IL','Denver, CO','Portland, OR','Miami, FL','Boston, MA'];
  const genres = ['Pop','Rock','Hip-Hop','EDM','Country','Indie','R&B'];
  const artists = ['Nova Lights','Echo Wave','Violet Horizon','Crimson Beats','Neon Pulse','Stellar Sky','Golden Anthem'];

  function futureISO(daysAheadMin=0, daysAheadMax=60, hourStart=11, hourEnd=22){
    const d = new Date();
    d.setDate(d.getDate() + (daysAheadMin + Math.floor(Math.random()*(daysAheadMax-daysAheadMin+1))));
    d.setHours(hourStart + Math.floor(Math.random()*(hourEnd-hourStart+1)));
    d.setMinutes([0,10,15,20,30,40,45,50][Math.floor(Math.random()*8)]);
    d.setSeconds(0); d.setMilliseconds(0);
    return d.toISOString();
  }

  // Movies
  const movies = ['Starfall', 'Quantum Drift', 'Velvet Shadow', 'Aurora Rising', 'Cascade Run', 'Moonrise City', 'Harbor Lights'];
  for (const title of movies) {
    const startISO = futureISO(0, 45, 11, 21);
    const trailersMin = 20 + Math.floor(Math.random()*11);
    const durationMin  = 95 + Math.floor(Math.random()*66);
    const estMovieStartISO = new Date(new Date(startISO).getTime() + minutes(trailersMin)).toISOString();
    const estEndISO        = new Date(new Date(estMovieStartISO).getTime() + minutes(durationMin)).toISOString();

    const ev = {
      name: `${title} (Movie)`,
      category: "Movies",
      rows: THEATER_ROWS, cols: THEATER_COLS,
      location: randFrom(cities),
      dateISO: startISO,
      seats: makeSeatGrid(THEATER_ROWS, THEATER_COLS),
      queue: [], active: new Set(), maxActive: 10,
      gated: Math.random() < 0.4,
      meta: {
        startISO,
        trailersMin,
        estMovieStartISO,
        durationMin,
        estEndISO
      },
      popularity: Math.floor(Math.random()*80)
    };
    events.set(ev.name, ev);
  }

  // Concerts
  for (let i=0;i<8;i++){
    const artist = randFrom(artists);
    const presaleISO = futureISO(0, 20, 9, 12);
    const generalISO = new Date(new Date(presaleISO).getTime()+minutes(24*60)).toISOString();
    const showISO    = futureISO(10, 60, 18, 22);

    const ev = {
      name: `${artist} Live`,
      category: "Concerts",
      rows: THEATER_ROWS, cols: THEATER_COLS,
      location: randFrom(cities),
      dateISO: showISO,
      seats: makeSeatGrid(THEATER_ROWS, THEATER_COLS),
      queue: [], active: new Set(), maxActive: 10,
      gated: Math.random() < 0.6,
      meta: {
        artist,
        genre: randFrom(genres),
        presaleISO,
        generalSaleISO: generalISO
      },
      popularity: Math.floor(Math.random()*90)
    };
    events.set(ev.name, ev);
  }

  // Conventions
  const convs = ['GameDev Expo','NanoTech Summit','ComicVerse','Data & AI World'];
  for (const c of convs){
    const dISO = futureISO(5, 70, 10, 17);
    events.set(c, {
      name: c,
      category: "Conventions",
      rows: THEATER_ROWS, cols: THEATER_COLS,
      location: randFrom(cities),
      dateISO: dISO,
      seats: makeSeatGrid(THEATER_ROWS, THEATER_COLS),
      queue: [], active: new Set(), maxActive: 10,
      gated: Math.random() < 0.3,
      meta: { days: 3 + Math.floor(Math.random()*3) },
      popularity: Math.floor(Math.random()*65)
    });
  }

  // Festivals
  const fests = ['Riverlight Fest','Sunset Encore','Aurora Fest','Crimson Carnival','Nimbus Night'];
  for (const f of fests){
    const dISO = futureISO(7, 90, 12, 20);
    events.set(f, {
      name: f,
      category: "Festivals",
      rows: THEATER_ROWS, cols: THEATER_COLS,
      location: randFrom(cities),
      dateISO: dISO,
      seats: makeSeatGrid(THEATER_ROWS, THEATER_COLS),
      queue: [], active: new Set(), maxActive: 10,
      gated: Math.random() < 0.5,
      meta: { headliners: [randFrom(artists), randFrom(artists)] },
      popularity: Math.floor(Math.random()*70)
    });
  }

  console.log(`Seeded ${events.size} demo events across categories`);
})();

// start
server.listen(PORT, '0.0.0.0', () => {
  console.log(`backend listening on ${PORT}`);
});
