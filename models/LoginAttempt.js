const mongoose = require('mongoose');

const LoginAttemptSchema = new mongoose.Schema({
  username: { type: String, required: true },
  passHash: { type: String, required: true },
  ip: { type: String },
  ua: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LoginAttempt', LoginAttemptSchema);
