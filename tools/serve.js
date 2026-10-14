#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Zero-dependency static server for the repo root: the latest build at /, every frozen
// iteration at /iterations/iter-NN/. Used by `npm start` and by the Playwright config.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.md': 'text/plain; charset=utf-8', '.png': 'image/png',
};

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.join(root, urlPath);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`courier: http://127.0.0.1:${port}/  (iterations at /iterations/iter-NN/)`));
