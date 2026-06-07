'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-session-cookie, accept',
    });
    return res.end();
  }

  // Serve the tool
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }

  // Generic proxy to claude.ai
  if (u.pathname === '/proxy') {
    const claudePath = u.searchParams.get('path');
    if (!claudePath) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing path param' })); }

    const cookie = req.headers['x-session-cookie'] || '';
    const accept = req.headers['accept'] || 'application/json';

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const opts = {
        hostname: 'claude.ai',
        path: claudePath,
        method: req.method === 'GET' ? 'GET' : 'POST',
        headers: {
          'accept': accept,
          'content-type': 'application/json',
          'cookie': cookie,
          'origin': 'https://claude.ai',
          'referer': 'https://claude.ai/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
      };
      if (body.length) opts.headers['content-length'] = body.length;

      const pr = https.request(opts, (r) => {
        res.writeHead(r.statusCode, {
          'content-type': r.headers['content-type'] || 'application/json',
          'access-control-allow-origin': '*',
          'cache-control': 'no-cache',
          'x-accel-buffering': 'no',
        });
        r.pipe(res);
      });

      pr.on('error', e => {
        try { res.writeHead(502); res.end(JSON.stringify({ error: e.message })); } catch (_) {}
      });

      if (body.length) pr.write(body);
      pr.end();
    });
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('\n  Actor Flow Builder  →  http://localhost:' + PORT + '\n');
  console.log('  Press Ctrl+C to stop.\n');
});
