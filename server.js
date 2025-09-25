// server.js — Express web service to host SPA on Render
try { require('dotenv').config(); } catch (_) {}

const path = require('path');
const express = require('express');
const app = express();

// Serve everything (index.html, main.js, /images/*, etc.) from repo root
app.use(express.static(__dirname, { extensions: ['html'] }));

// (Optional) small config endpoint if you later want to pass env to client
app.get('/api/config', (req, res) => {
  res.json({
    // example: DISCORD_USER_ID: process.env.DISCORD_USER_ID || null
  });
});

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ThatLegendJack server running on :${PORT}`));
