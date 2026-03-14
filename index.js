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

// ─── DHL / MNG KARGO PROXY ───────────────────────────────────────────────────
const MNG_BASE = 'https://testapi.mngkargo.com.tr/mngapi/api';

// DHL Token - OAuth2 client_credentials (form-encoded)
app.post('/dhl/token', async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'clientId ve clientSecret gerekli' });
    }

    // MNG Kargo Identity API - FORM ENCODED zorunlu
    const formBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(`${MNG_BASE}/identity/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DHL - Plus Command (sipariş oluştur)
app.post('/dhl/pluscmdapi/:action', async (req, res) => {
  try {
    const token = req.headers['x-dhl-token'];
    const customerNumber = req.headers['x-dhl-customer'];

    if (!token) {
      return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    }

    const response = await fetch(`${MNG_BASE}/pluscommand/${req.params.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'MNG-CustomerNumber': customerNumber || '',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DHL - Barcode Command (barkod oluştur)
app.post('/dhl/barcodecmdapi/:action', async (req, res) => {
  try {
    const token = req.headers['x-dhl-token'];
    const customerNumber = req.headers['x-dhl-customer'];

    if (!token) {
      return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    }

    const response = await fetch(`${MNG_BASE}/barcodecommand/${req.params.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'MNG-CustomerNumber': customerNumber || '',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DHL - Plus Query (takip)
app.get('/dhl/plusqueryapi/:action/:barcode', async (req, res) => {
  try {
    const token = req.headers['x-dhl-token'];
    const customerNumber = req.headers['x-dhl-customer'];

    if (!token) {
      return res.status(401).json({ error: 'x-dhl-token header gerekli' });
    }

    const response = await fetch(
      `${MNG_BASE}/plusquery/${req.params.action}/${req.params.barcode}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'MNG-CustomerNumber': customerNumber || '',
        },
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
