const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://emvmarolsmbxbimbyvbv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtdm1hcm9sc21ieGJpbWJ5dmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzk2NjUsImV4cCI6MjA5NjYxNTY2NX0.HRbAReRB6FLX6OrrL0m437di8Dve--lvVqiUVSXk28U';

function proxyRequest(targetUrl, method, headers, body, res) {
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname,
    path: parsed.path,
    method: method,
    headers: { ...headers, 'host': parsed.hostname }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      res.writeHead(apiRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  apiReq.on('error', (e) => {
    res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: { message: e.message } }));
  });

  if (body) apiReq.write(body);
  apiReq.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Signal proxy running');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {

    // ── Anthropic proxy ──────────────────────────────
    if (req.url === '/proxy') {
      try {
        const parsed = JSON.parse(body);
        const apiKey = parsed.apiKey;
        delete parsed.apiKey;
        const payload = JSON.stringify(parsed);

        proxyRequest(
          'https://api.anthropic.com/v1/messages',
          'POST',
          {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload)
          },
          payload,
          res
        );
      } catch(e) {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: { message: e.message } }));
      }
      return;
    }

    // ── Supabase proxy ───────────────────────────────
    if (req.url.startsWith('/sb/')) {
      const sbPath = req.url.replace('/sb/', '');
      const targetUrl = `${SUPABASE_URL}/rest/v1/${sbPath}`;
      
      const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'return=representation'
      };

      if (body) headers['Content-Length'] = Buffer.byteLength(body);

      proxyRequest(targetUrl, req.method, headers, body || null, res);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
  });
});

server.listen(PORT, () => {
  console.log(`Signal proxy running on port ${PORT}`);
});
