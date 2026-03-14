import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

// Shopify proxy
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
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DHL eCommerce (MNG Kargo) - Token
app.post('/dhl/token', async (req, res) => {
  try {
    const response = await fetch('https://testapi.mngkargo.com.tr/mngapi/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DHL eCommerce (MNG Kargo) - Diger istekler
app.all('/dhl/*', async (req, res) => {
  const token = req.headers['x-dhl-token'];
  const path = req.path.replace('/dhl', '');
  const dhlUrl = `https://testapi.mngkargo.com.tr/mngapi/api${path}`;

  try {
    const response = await fetch(dhlUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
