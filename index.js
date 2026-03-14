import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

// ─── SHOPIFY PROXY ───────────────────────────────────────────────────────────
app.all('/shopify/*', async (req, res) => {
  const storeUrl = req.headers['x-store-url'];
  const accessToken = req.headers['x-access-token'];
  if (!storeUrl || !accessToken) {
    return res.status(400).json({ error: 'x-store-url ve x-access-token header gerekli' });
  }
  const path = req.path.replace('/shopify', '');
  const shopifyUrl = `https://${storeUrl}/admin/api/2024-01${path}`;
  try {
    const response = await fetch(shopifyUrl, {
      method: req.method,
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MNG KARGO (DHL eCommerce) PROXY ─────────────────────────────────────────
const MNG_BASE = 'https://testapi.mngkargo.com.tr/mngapi/api';

// Token: POST /mngapi/api/token
// Body: { customerNumber, password, identityType: 1 }
// Response: { jwt, refreshToken, jwtExpireDate, refreshTokenExpireDate }
app.post('/dhl/token', async (req, res) => {
  try {
    const { customerNumber, password } = req.body;
    if (!customerNumber || !password) {
      return res.status(400).json({ error: 'customerNumber ve password gerekli' });
    }
    console.log('[MNG Token] customerNumber:', customerNumber);
    const response = await fetch(`${MNG_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerNumber: String(customerNumber), password: String(password), identityType: 1 }),
    });
    const text = await response.text();
    console.log('[MNG Token] status:', response.status, '| body:', text.slice(0, 300));
    let data;
    try { data = JSON.parse(text); } catch { data = { jwt: text.trim() }; }
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[MNG Token] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Plus Command: POST /mngapi/api/pluscmdapi/{action}
// Headers: Authorization: Bearer {jwt}, X-IBM-Client-Id, X-IBM-Client-Secret
app.post('/dhl/pluscmdapi/:action', async (req, res) => {
  try {
    const jwt = req.headers['x-dhl-token'];
    const clientId = req.headers['x-ibm-client-id'];
    const clientSecret = req.headers['x-ibm-client-secret'];
    if (!jwt) return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
    if (clientId) headers['X-IBM-Client-Id'] = clientId;
    if (clientSecret) headers['X-IBM-Client-Secret'] = clientSecret;
    const url = `${MNG_BASE}/pluscmdapi/${req.params.action}`;
    console.log('[MNG PlusCmd]', req.params.action);
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(req.body) });
    const text = await response.text();
    console.log('[MNG PlusCmd] status:', response.status, '| response:', text.slice(0, 300));
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[MNG PlusCmd] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Barcode Command: POST /mngapi/api/barcodecmdapi/{action}
app.post('/dhl/barcodecmdapi/:action', async (req, res) => {
  try {
    const jwt = req.headers['x-dhl-token'];
    const clientId = req.headers['x-ibm-client-id'];
    const clientSecret = req.headers['x-ibm-client-secret'];
    if (!jwt) return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
    if (clientId) headers['X-IBM-Client-Id'] = clientId;
    if (clientSecret) headers['X-IBM-Client-Secret'] = clientSecret;
    const url = `${MNG_BASE}/barcodecmdapi/${req.params.action}`;
    console.log('[MNG BarcodeCmd]', req.params.action);
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(req.body) });
    const text = await response.text();
    console.log('[MNG BarcodeCmd] status:', response.status, '| response:', text.slice(0, 300));
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[MNG BarcodeCmd] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Plus Query: GET /mngapi/api/plusqueryapi/{action}/{id}
app.get('/dhl/plusqueryapi/:action/:id', async (req, res) => {
  try {
    const jwt = req.headers['x-dhl-token'];
    const clientId = req.headers['x-ibm-client-id'];
    const clientSecret = req.headers['x-ibm-client-secret'];
    if (!jwt) return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    const headers = { 'Authorization': `Bearer ${jwt}` };
    if (clientId) headers['X-IBM-Client-Id'] = clientId;
    if (clientSecret) headers['X-IBM-Client-Secret'] = clientSecret;
    const url = `${MNG_BASE}/plusqueryapi/${req.params.action}/${req.params.id}`;
    console.log('[MNG PlusQuery]', url);
    const response = await fetch(url, { method: 'GET', headers });
    const text = await response.text();
    console.log('[MNG PlusQuery] status:', response.status, '| response:', text.slice(0, 300));
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[MNG PlusQuery] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', version: '3.0' }));
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
