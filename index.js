import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/xml', limit: '10mb' }));
app.use(express.raw({ type: 'application/xml', limit: '10mb' }));

function normalizeMngApiBase(raw) {
  const productionDefault = 'https://api.mngkargo.com.tr/mngapi/api';
  if (raw == null || String(raw).trim() === '') return productionDefault;
  let b = String(raw).trim().replace(/\/+$/, '');
  if (b.includes('/mngapi/api')) return b;
  if (b.endsWith('/mngapi')) return `${b}/api`;
  return `${b}/mngapi/api`;
}

const MNG_BASE = normalizeMngApiBase(process.env.MNG_API_BASE);

function getBearer(req) {
  const a = req.headers.authorization || '';
  const m = a.replace(/^Bearer\s+/i, '').trim();
  if (m) return m;
  return req.headers['x-dhl-token'] || '';
}

// HEALTH
app.get('/health', (_, res) =>
  res.json({ ok: true, ts: Date.now(), mngBase: MNG_BASE, version: '5.1' })
);

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
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MNG TOKEN
app.post('/dhl/token', async (req, res) => {
  const clientId =
    req.headers['x-ibm-client-id'] ||
    req.headers['x-dhl-client-id'] ||
    req.body?.clientId ||
    '';
  const clientSecret =
    req.headers['x-ibm-client-secret'] ||
    req.headers['x-dhl-client-secret'] ||
    req.body?.clientSecret ||
    '';
  console.log('[TOKEN] POST', MNG_BASE + '/token', '| clientId:', clientId?.slice(0, 8));
  try {
    const r = await fetch(`${MNG_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '1.0',
        ...(clientId && { 'X-IBM-Client-Id': clientId }),
        ...(clientSecret && { 'X-IBM-Client-Secret': clientSecret }),
      },
      body: JSON.stringify({
        customerNumber: req.body?.customerNumber,
        password: req.body?.password,
        identityType: req.body?.identityType ?? 1,
      }),
    });
    const txt = await r.text();
    console.log('[TOKEN] status:', r.status, txt.slice(0, 200));
    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      data = { jwt: txt.trim() };
    }
    res.status(r.status).json(data);
  } catch (e) {
    console.error('[TOKEN] err:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// MNG PLUS COMMAND (createDetailedOrder, …)
app.post('/dhl/pluscmdapi/:action', async (req, res) => {
  const jwt = getBearer(req);
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  const cid = req.headers['x-ibm-client-id'] || req.headers['x-dhl-client-id'] || '';
  const csec = req.headers['x-ibm-client-secret'] || req.headers['x-dhl-client-secret'] || '';
  try {
    const r = await fetch(`${MNG_BASE}/pluscmdapi/${req.params.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '1.0',
        Authorization: `Bearer ${jwt}`,
        ...(cid && { 'X-IBM-Client-Id': cid }),
        ...(csec && { 'X-IBM-Client-Secret': csec }),
      },
      body: JSON.stringify(req.body),
    });
    const txt = await r.text();
    console.log('[PLUSCMD]', req.params.action, r.status, txt.slice(0, 200));
    let d;
    try {
      d = JSON.parse(txt);
    } catch {
      d = { raw: txt };
    }
    res.status(r.status).json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MNG BARCODE COMMAND
app.post('/dhl/barcodecmdapi/:action', async (req, res) => {
  const jwt = getBearer(req);
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  const cid = req.headers['x-ibm-client-id'] || req.headers['x-dhl-client-id'] || '';
  const csec = req.headers['x-ibm-client-secret'] || req.headers['x-dhl-client-secret'] || '';
  try {
    const r = await fetch(`${MNG_BASE}/barcodecmdapi/${req.params.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '1.0',
        Authorization: `Bearer ${jwt}`,
        ...(cid && { 'X-IBM-Client-Id': cid }),
        ...(csec && { 'X-IBM-Client-Secret': csec }),
      },
      body: JSON.stringify(req.body),
    });
    const txt = await r.text();
    console.log('[BARCODE]', req.params.action, r.status, txt.slice(0, 200));
    let d;
    try {
      d = JSON.parse(txt);
    } catch {
      d = { raw: txt };
    }
    res.status(r.status).json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MNG PLUS QUERY
app.get('/dhl/plusqueryapi/:action/:id', async (req, res) => {
  const jwt = getBearer(req);
  if (!jwt) return res.status(401).json({ error: 'token yok' });
  const cid = req.headers['x-ibm-client-id'] || req.headers['x-dhl-client-id'] || '';
  const csec = req.headers['x-ibm-client-secret'] || req.headers['x-dhl-client-secret'] || '';
  try {
    const id = encodeURIComponent(req.params.id);
    const r = await fetch(`${MNG_BASE}/plusqueryapi/${req.params.action}/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '1.0',
        Authorization: `Bearer ${jwt}`,
        ...(cid && { 'X-IBM-Client-Id': cid }),
        ...(csec && { 'X-IBM-Client-Secret': csec }),
      },
    });
    const txt = await r.text();
    console.log('[QUERY]', r.status, txt.slice(0, 200));
    let d;
    try {
      d = JSON.parse(txt);
    } catch {
      d = { raw: txt };
    }
    res.status(r.status).json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// İZİBİZ
async function izibizProxy(req, res) {
  const targetUrl = req.headers['x-izibiz-url'];
  const soapAction = req.headers.soapaction || req.headers.SOAPAction || '';
  if (!targetUrl) {
    return res.status(400).send('<error>x-izibiz-url header eksik</error>');
  }
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  console.log('[IZIBIZ]', targetUrl.slice(-30), 'action:', soapAction.slice(-30));
  try {
    const r = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: soapAction,
      },
      body,
    });
    const txt = await r.text();
    console.log('[IZIBIZ] status:', r.status, 'resp:', txt.slice(0, 150));
    res.status(r.status).set('Content-Type', 'text/xml;charset=UTF-8').send(txt);
  } catch (e) {
    console.error('[IZIBIZ] err:', e.message);
    res.status(500).send(`<error>${e.message}</error>`);
  }
}

app.post('/izibiz/auth', izibizProxy);
app.post('/izibiz/earsiv', izibizProxy);
app.post('/izibiz/efatura', izibizProxy);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`STOKÖZ proxy v5.1 → ${MNG_BASE} → port ${PORT}`));
