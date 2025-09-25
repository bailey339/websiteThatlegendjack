// server.js — Express web service to serve the SPA + expose env config
try { require('dotenv').config(); } catch (_) {}

const path = require('path');
const express = require('express');
const app = express();

// Serve static files (index.html, main.js) from repo root
app.use(express.static(__dirname, { extensions: ['html'] }));

// Tiny config endpoint to expose env → client
app.get('/api/config', (req, res) => {
  res.json({
    discord_user_id: process.env.DISCORD_USER_ID || null
  });
});

// SPA fallback (all other routes -> index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
