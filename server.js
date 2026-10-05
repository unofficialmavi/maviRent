const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Parse JSON and form bodies, preserving rawBody for webhook HMAC verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to adapt serverless function handlers
function adaptHandler(modulePath) {
  let handler;
  try {
    const mod = require(modulePath);
    handler = mod.default || mod;
  } catch (err) {
    console.error(`Failed to load handler ${modulePath}:`, err);
    return (req, res) => res.status(500).json({ error: `Handler not loaded: ${err.message}` });
  }

  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`Error in ${modulePath}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  };
}

// Mount API routes
app.all('/api/health', adaptHandler('./api/health.js'));
app.all('/api/ai', adaptHandler('./api/ai.js'));
app.all('/api/ai-action', adaptHandler('./api/ai-action.js'));
app.all('/api/care-mode', adaptHandler('./api/care-mode.js'));
app.all('/api/care-scheduler', adaptHandler('./api/care-scheduler.js'));
app.all('/api/care-tasks', adaptHandler('./api/care-tasks.js'));
app.all('/api/payment-prn', adaptHandler('./api/payment-prn.js'));
app.all('/api/send-reminders', adaptHandler('./api/send-reminders.js'));
app.all('/api/media-url', adaptHandler('./api/media-url.js'));

// Serve static assets from project root
app.use(express.static(path.resolve(__dirname), {
  index: 'index.html',
  dotfiles: 'ignore'
}));

// SPA Fallback for any client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`MavRent running at http://${HOST}:${PORT}`);
});
