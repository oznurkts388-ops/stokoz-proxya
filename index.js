import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const MNG = 'https://testapi.mngkargo.com.tr/mngapi/api';

// HEALTH
app.get('/health', (_, res) => res.json({ status: 'ok', version: '4.0' }));

// SHOPIFY
app.all('/shopify/*', async (req, res) => {
  const storeUrl = req.headers['x-store-url'];
  const accessToken = req.headers['x-access-token'];
  if (!storeUrl || !accessToken) return res.status(400).json({ error: 'headers eksik' });
  const path = req.path.replace('/shopify', '');
  try {
    const r = await fetch(`https://${storeUrl}/admin/api/2024-01${path}`, {
      method: req.method,
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MNG TOKEN
// Spec: POST /mngapi/api/token
// Headers: X-IBM-Client-Id, X-IBM-Client-Secret
// Body: { customerNumber, password, identityType: 1 }
// Response: { jwt, refreshToken, jwtExpireDate, ... }
app.post('/dhl/token', async (req, res) => {
  const { customerNumber, password, clientId, clientSecret } = req.body;
  console.log('[TOKEN] num:', customerNumber, 'clientId:', clientId?.slice(0,8));
  try {
    const r = await fetch(`${MNG}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IBM-Client-Id': clientId || '',
        'X-IBM-Client-Secret': clientSecret || '',
      },
      body: JSON.stringify({ customerNumber, password, identityType: 1 }),
    });
    const txt = await r.text();
    console.log('[TOKEN] status:', r.status, 'body:', txt.slice(0, 200));
    let data; try { data = JSON.parse(txt); } catch { data = { jwt: txt.trim() }; }
    res.status(r.status).json(data);
  } catch (e) {
    console.error('[TOKEN] err:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// MNG PLUS COMMAND
app.post('/dhl/pluscmdapi/:action', async (req, res) => {
  const { 'x-dhl-token': jwt, 'x-ibm-client-id': cid, 'x-ibm-client-secret': csec } = req.headers;
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  try {
    const r = await fetch(`${MNG}/pluscmdapi/${req.params.action}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${jwt}`, 'X-IBM-Client-Id': cid||'', 'X-IBM-Client-Secret': csec||'' },
      body: JSON.stringify(req.body),
    });
    const txt = await r.text();
    console.log('[PLUSCMD]', req.params.action, r.status, txt.slice(0,200));
    let d; try { d=JSON.parse(txt); } catch { d={raw:txt}; }
    res.status(r.status).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MNG BARCODE COMMAND
app.post('/dhl/barcodecmdapi/:action', async (req, res) => {
  const { 'x-dhl-token': jwt, 'x-ibm-client-id': cid, 'x-ibm-client-secret': csec } = req.headers;
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  try {
    const r = await fetch(`${MNG}/barcodecmdapi/${req.params.action}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${jwt}`, 'X-IBM-Client-Id': cid||'', 'X-IBM-Client-Secret': csec||'' },
      body: JSON.stringify(req.body),
    });
    const txt = await r.text();
    console.log('[BARCODE]', req.params.action, r.status, txt.slice(0,200));
    let d; try { d=JSON.parse(txt); } catch { d={raw:txt}; }
    res.status(r.status).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MNG PLUS QUERY
app.get('/dhl/plusqueryapi/:action/:id', async (req, res) => {
  const { 'x-dhl-token': jwt, 'x-ibm-client-id': cid, 'x-ibm-client-secret': csec } = req.headers;
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  try {
    const r = await fetch(`${MNG}/plusqueryapi/${req.params.action}/${req.params.id}`, {
      method: 'GET',
      headers: { 'Authorization':`Bearer ${jwt}`, 'X-IBM-Client-Id': cid||'', 'X-IBM-Client-Secret': csec||'' },
    });
    const txt = await r.text();
    console.log('[QUERY]', r.status, txt.slice(0,200));
    let d; try { d=JSON.parse(txt); } catch { d={raw:txt}; }
    res.status(r.status).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy v4.0 port ${PORT}`));
