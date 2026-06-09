const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Signal proxy running');
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: { message: 'Not found' } }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const apiKey = parsed.apiKey;
      delete parsed.apiKey;

      const payload = JSON.stringify(parsed);

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
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

      apiReq.write(payload);
      apiReq.end();

    } catch(e) {
      res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signal proxy running on port ${PORT}`);
});
