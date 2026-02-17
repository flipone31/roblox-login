require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
// Using default session store (in-memory) after removing MongoDB
const bcrypt = require('bcrypt');
const morgan = require('morgan');

// In-memory storage for login attempts (removed MongoDB dependency)
const loginAttempts = [];

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
    loginAttempts.push(attempt);
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
  // Return recent attempts (no passHash)
  const attempts = loginAttempts
    .slice()
    .sort((a,b)=>b.createdAt - a.createdAt)
    .slice(0,200)
    .map(({ username, ip, ua, createdAt })=>({ username, ip, ua, createdAt }));
  res.json({ ok:true, attempts });
});

// Simple logout
app.post('/api/admin/logout', (req, res)=>{
  req.session.destroy(()=>res.json({ ok:true }));
});

app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
