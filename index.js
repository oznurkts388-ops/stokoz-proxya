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
  res.json({ ok: true, ts: Date.now(), mngBase: MNG_BASE, version: '5.3' })
);

app.get('/myip', async (_, res) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const data = await r.json();
    res.json({ outboundIp: data.ip });
  } catch (e) {
    res.json({ error: e.message });
  }
});

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
    const raw = String(req.params.id ?? '').trim();
    if (!raw) return res.status(400).json({ error: 'id boş' });
    const id = encodeURIComponent(raw);
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

// ── İzibiz JSON köprüsü (Stoköz app izibizService.ts ile uyumlu) ─────────────────
function izibizAuthWsUrl(envHeader) {
  const e = String(envHeader || 'test').toLowerCase();
  if (e === 'prod' || e === 'production' || e === 'live') {
    return 'https://authenticationws.izibiz.com.tr/AuthenticationWS';
  }
  return 'https://efaturatest.izibiz.com.tr/AuthenticationWS';
}

function izibizEarsivWsUrl(envHeader) {
  const e = String(envHeader || 'test').toLowerCase();
  if (e === 'prod' || e === 'production' || e === 'live') {
    return 'https://earsivws.izibiz.com.tr/EIArchiveWS/EFaturaArchive';
  }
  return 'https://efaturatest.izibiz.com.tr/EIArchiveWS/EFaturaArchive';
}

function izibizEfaturaWsUrl(envHeader) {
  const e = String(envHeader || 'test').toLowerCase();
  if (e === 'prod' || e === 'production' || e === 'live') {
    return 'https://efaturaws.izibiz.com.tr/EInvoiceWS';
  }
  return 'https://efaturatest.izibiz.com.tr/EInvoiceWS';
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encodeBase64Utf8(value) {
  return Buffer.from(String(value ?? ''), 'utf8').toString('base64');
}

function parseSoapSessionId(xml) {
  const m = String(xml).match(/<(?:[^/>]+:)?SESSION_ID>([^<]+)</);
  return m ? m[1].trim() : null;
}

function parseSoapErrorShort(xml) {
  const m = String(xml).match(/<(?:[^/>]+:)?ERROR_SHORT_DES>([^<]*)</);
  return m ? m[1].trim() : null;
}

function parseSoapErrorCode(xml) {
  const m = String(xml).match(/<(?:[^/>]+:)?ERROR_CODE>([^<]*)</);
  return m ? m[1].trim() : null;
}

function parseSoapErrorLong(xml) {
  const m = String(xml).match(/<(?:[^/>]+:)?ERROR_LONG_DES>([^<]*)</);
  return m ? m[1].trim() : null;
}

const IZIBIZ_ACTION_LOGIN =
  'http://schemas.i2i.com/ei/wsdl/AuthenticationServicePort/LoginRequest';
const IZIBIZ_ACTION_CHECK_USER =
  'http://schemas.i2i.com/ei/wsdl/AuthenticationServicePort/CheckUserRequest';
const IZIBIZ_ACTION_GET_INVOICE =
  'http://schemas.i2i.com/ei/wsdl/EInvoiceWSPort/GetInvoiceRequest';

function izibizLoginErrorJson(txt) {
  const short = parseSoapErrorShort(txt) || 'İzibiz giriş reddedildi';
  const o = { success: false, error: short };
  const code = parseSoapErrorCode(txt);
  const long = parseSoapErrorLong(txt);
  if (code) o.errorCode = code;
  if (long) o.errorLong = long;
  return o;
}

function xmlInner(txt, re) {
  const m = String(txt).match(re);
  return m ? m[1].trim() : undefined;
}

/** GetInvoice yanıtı — INVOICE öğeleri (UUID/ID attr + HEADER) */
function parseGetInvoiceListXml(xml) {
  const rows = [];
  const seen = new Set();
  const pushRow = (row) => {
    const k = row.uuid || row.id || '';
    if (k && seen.has(k)) return;
    if (k) seen.add(k);
    rows.push(row);
  };

  const re = /<(?:[\w.-]+:)?INVOICE\s([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?INVOICE>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const openAttrs = m[1];
    const body = m[2];
    let uuid = (openAttrs.match(/\bUUID="([^"]*)"/i) || [])[1];
    let id = (openAttrs.match(/\bID="([^"]*)"/i) || [])[1];
    const hm = body.match(/<(?:[\w.-]+:)?HEADER>([\s\S]*?)<\/(?:[\w.-]+:)?HEADER>/i);
    const h = hm ? hm[1] : '';
    if (!uuid) uuid = xmlInner(h, /<(?:[^:/>]+:)?UUID>([^<]*)</i);
    if (!id) id = xmlInner(h, /<(?:[^:/>]+:)?ID>([^<]*)</i);
    const supplier =
      xmlInner(h, /<(?:[^:/>]+:)?SUPPLIER>([^<]*)</i) || xmlInner(h, /<(?:[^:/>]+:)?SENDER>([^<]*)</i);
    const customer =
      xmlInner(h, /<(?:[^:/>]+:)?CUSTOMER>([^<]*)</i) || xmlInner(h, /<(?:[^:/>]+:)?RECEIVER>([^<]*)</i);
    pushRow({
      source: 'EFATURA',
      uuid: uuid || undefined,
      id: id || undefined,
      issueDate: xmlInner(h, /<(?:[^:/>]+:)?ISSUE_DATE>([^<]*)</i),
      supplier,
      customer,
      payableAmount: xmlInner(h, /<(?:[^:/>]+:)?PAYABLE_AMOUNT[^>]*>([^<]*)</i),
      direction: xmlInner(h, /<(?:[^:/>]+:)?DIRECTION>([^<]*)</i),
    });
  }

  const reSelf = /<(?:[\w.-]+:)?INVOICE\s+([^>]+)\/>/gi;
  while ((m = reSelf.exec(xml)) !== null) {
    const attrs = m[1];
    const uuid = (attrs.match(/\bUUID="([^"]*)"/i) || [])[1];
    const id = (attrs.match(/\bID="([^"]*)"/i) || [])[1];
    if (uuid || id) {
      pushRow({
        source: 'EFATURA',
        uuid: uuid || undefined,
        id: id || undefined,
        issueDate: undefined,
        supplier: undefined,
        customer: undefined,
        payableAmount: undefined,
        direction: undefined,
      });
    }
  }

  return rows;
}

/** GetEArchiveInvoiceList — INVOICE (EARCHIVEINV) */
function parseEArchiveListXml(xml) {
  const rows = [];
  const re = /<(?:[\w.-]+:)?INVOICE\s*([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?INVOICE>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const body = m[2];
    const uuid =
      xmlInner(body, /<(?:[^:/>]+:)?UUID>([^<]*)</i) ||
      (m[1].match(/\bUUID="([^"]*)"/i) || [])[1];
    const id =
      xmlInner(body, /<(?:[^:/>]+:)?INVOICE_ID>([^<]*)</i) ||
      (m[1].match(/\bID="([^"]*)"/i) || [])[1];
    const sender = xmlInner(body, /<(?:[^:/>]+:)?SENDER_NAME>([^<]*)</i);
    const issueDate = xmlInner(body, /<(?:[^:/>]+:)?ISSUE_DATE>([^<]*)</i);
    const amount = xmlInner(body, /<(?:[^:/>]+:)?PAYABLE_AMOUNT[^>]*>([^<]*)</i);
    rows.push({
      source: 'EARSIV',
      uuid: uuid || undefined,
      id: id || undefined,
      issueDate: issueDate || undefined,
      supplier: sender || undefined,
      customer: undefined,
      payableAmount: amount || undefined,
      direction: 'ARCHIVE',
    });
  }
  return rows;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const ymd = (d) => d.toISOString().slice(0, 10);
  return { startDate: ymd(start), endDate: ymd(end) };
}

function buildGetInvoiceSoapXmlNode(sessionId, opts) {
  const {
    lim,
    sd,
    ed,
    direction,
    readIncluded,
    omitDateRange = false,
    dateType = 'ISSUE',
    headerOnly = 'Y',
  } = opts;
  const ri = readIncluded === false ? 'false' : 'true';
  const ho = headerOnly === 'N' ? 'N' : 'Y';
  let searchBlock = `<wsdl:LIMIT>${lim}</wsdl:LIMIT>`;
  if (!omitDateRange) {
    searchBlock += `
<wsdl:DATE_TYPE>${escapeXml(dateType)}</wsdl:DATE_TYPE>
<wsdl:START_DATE>${escapeXml(sd)}</wsdl:START_DATE>
<wsdl:END_DATE>${escapeXml(ed)}</wsdl:END_DATE>`;
  }
  searchBlock += `
<wsdl:READ_INCLUDED>${ri}</wsdl:READ_INCLUDED>
<wsdl:DIRECTION>${direction}</wsdl:DIRECTION>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl" xmlns:ent="http://schemas.i2i.com/ei/entity">
<soapenv:Body>
<wsdl:GetInvoiceRequest>
<ent:REQUEST_HEADER>
<ent:SESSION_ID>${escapeXml(sessionId)}</ent:SESSION_ID>
<ent:COMPRESSED>N</ent:COMPRESSED>
<ent:APPLICATION_NAME>STOKOZ</ent:APPLICATION_NAME>
</ent:REQUEST_HEADER>
<wsdl:INVOICE_SEARCH_KEY>
${searchBlock}
</wsdl:INVOICE_SEARCH_KEY>
<wsdl:HEADER_ONLY>${ho}</wsdl:HEADER_ONLY>
</wsdl:GetInvoiceRequest>
</soapenv:Body>
</soapenv:Envelope>`;
}

async function izibizFetchGetInvoice(env, sessionId, { direction, limit, startDate, endDate, headerOnly }) {
  const dr = defaultDateRange();
  const sd = startDate || dr.startDate;
  const ed = endDate || dr.endDate;
  const url = izibizEfaturaWsUrl(env);
  const lim = Math.min(500, Math.max(1, parseInt(String(limit || 100), 10) || 100));
  const dir = String(direction || 'OUT').toUpperCase() === 'IN' ? 'IN' : 'OUT';
  const ho = headerOnly === 'N' ? 'N' : 'Y';
  const baseKey = { lim, sd, ed, direction: dir, headerOnly: ho };

  const attempts =
    dir === 'IN'
      ? [
          { readIncluded: false, dateType: 'ISSUE' },
          { readIncluded: true, dateType: 'ISSUE' },
          { readIncluded: false, dateType: 'CREATE' },
          { readIncluded: true, dateType: 'CREATE' },
          { readIncluded: false, omitDateRange: true },
          { readIncluded: true, omitDateRange: true },
        ]
      : [{ readIncluded: true, dateType: 'ISSUE' }];

  let lastTxt = '';
  for (let i = 0; i < attempts.length; i++) {
    const att = attempts[i];
    const soap = buildGetInvoiceSoapXmlNode(sessionId, { ...baseKey, ...att });
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: '',
        Action: IZIBIZ_ACTION_GET_INVOICE,
      },
      body: soap,
    });
    const txt = await r.text();
    lastTxt = txt;
    console.log('[IZIBIZ GetInvoice]', dir, r.status, txt.slice(0, 200));
    if (!r.ok) throw new Error(parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`);
    const errNoInv = /<ERROR_TYPE>/i.test(txt) && !/<(?:[\w.-]+:)?INVOICE[\s>]/i.test(txt);
    if (errNoInv) {
      if (dir === 'IN' && i >= 2) continue;
      throw new Error(parseSoapErrorShort(txt) || 'GetInvoice hata');
    }
    const items = parseGetInvoiceListXml(txt);
    if (items.length > 0) return items;
  }
  return parseGetInvoiceListXml(lastTxt);
}

async function izibizFetchEArchiveList(env, sessionId, { limit, startDate, endDate }) {
  const dr = defaultDateRange();
  const sd = `${startDate || dr.startDate}T00:00:00`;
  const ed = `${endDate || dr.endDate}T23:59:59`;
  const url = izibizEarsivWsUrl(env);
  const lim = Math.min(500, Math.max(1, parseInt(String(limit || 100), 10) || 100));
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl" xmlns:arc="http://schemas.i2i.com/ei/wsdl/archive">
<soapenv:Body>
<arc:GetEArchiveInvoiceListRequest>
<arc:REQUEST_HEADER>
<wsdl:SESSION_ID>${escapeXml(sessionId)}</wsdl:SESSION_ID>
</arc:REQUEST_HEADER>
<arc:LIMIT>${lim}</arc:LIMIT>
<arc:START_DATE>${escapeXml(sd)}</arc:START_DATE>
<arc:END_DATE>${escapeXml(ed)}</arc:END_DATE>
<arc:HEADER_ONLY>Y</arc:HEADER_ONLY>
</arc:GetEArchiveInvoiceListRequest>
</soapenv:Body>
</soapenv:Envelope>`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
    body: soap,
  });
  const txt = await r.text();
  console.log('[IZIBIZ GetEArchiveList]', r.status, txt.slice(0, 200));
  if (!r.ok) throw new Error(parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`);
  if (/<ERROR_TYPE>/i.test(txt) && !/<(?:[\w.-]+:)?INVOICE[\s>]/i.test(txt)) {
    throw new Error(parseSoapErrorShort(txt) || 'GetEArchiveInvoiceList hata');
  }
  return parseEArchiveListXml(txt);
}

app.post('/izibiz/login', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const username = req.body?.username;
    const password = req.body?.password;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username / password gerekli' });
    }
    const url = izibizAuthWsUrl(env);
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl">
<soapenv:Body>
<wsdl:LoginRequest>
<REQUEST_HEADER xmlns="http://schemas.i2i.com/ei/entity">
  <SESSION_ID>0</SESSION_ID>
  <APPLICATION_NAME>Login</APPLICATION_NAME>
</REQUEST_HEADER>
<USER_NAME>${escapeXml(username)}</USER_NAME>
<PASSWORD>${escapeXml(password)}</PASSWORD>
</wsdl:LoginRequest>
</soapenv:Body>
</soapenv:Envelope>`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: '',
        Action: IZIBIZ_ACTION_LOGIN,
      },
      body: soap,
    });
    const txt = await r.text();
    console.log('[IZIBIZ JSON login]', r.status, txt.slice(0, 180));
    if (!r.ok) {
      const ec = parseSoapErrorCode(txt);
      const el = parseSoapErrorLong(txt);
      return res.status(502).json({
        success: false,
        error: parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`,
        ...(ec ? { errorCode: ec } : {}),
        ...(el ? { errorLong: el } : {}),
      });
    }
    const sid = parseSoapSessionId(txt);
    if (sid) {
      return res.json({ success: true, sessionId: sid });
    }
    if (/<ERROR_TYPE>/i.test(txt)) {
      return res.json(izibizLoginErrorJson(txt));
    }
    return res.json({ success: false, error: 'SESSION_ID yanıtta yok' });
  } catch (e) {
    console.error('[IZIBIZ JSON login]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/izibiz/check-user', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    const vkn = req.body?.vkn;
    if (!sessionId || vkn == null || String(vkn).trim() === '') {
      return res.status(400).json({ success: false, error: 'x-izibiz-session ve vkn gerekli' });
    }
    const url = izibizAuthWsUrl(env);
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl">
<soapenv:Body>
<wsdl:CheckUserRequest>
<REQUEST_HEADER xmlns="http://schemas.i2i.com/ei/entity">
  <SESSION_ID>${escapeXml(sessionId)}</SESSION_ID>
  <APPLICATION_NAME>CheckUser</APPLICATION_NAME>
</REQUEST_HEADER>
<USER><IDENTIFIER>${escapeXml(String(vkn).trim())}</IDENTIFIER></USER>
</wsdl:CheckUserRequest>
</soapenv:Body>
</soapenv:Envelope>`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: '',
        Action: IZIBIZ_ACTION_CHECK_USER,
      },
      body: soap,
    });
    const txt = await r.text();
    console.log('[IZIBIZ check-user]', r.status, txt.slice(0, 180));
    if (!r.ok) {
      const ec = parseSoapErrorCode(txt);
      const el = parseSoapErrorLong(txt);
      return res.status(502).json({
        success: false,
        error: parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`,
        ...(ec ? { errorCode: ec } : {}),
        ...(el ? { errorLong: el } : {}),
      });
    }
    if (/<ERROR_TYPE>/i.test(txt) && !/<USER[\s>]/i.test(txt)) {
      const short = parseSoapErrorShort(txt) || 'CheckUser hata';
      const o = { success: false, error: short };
      const code = parseSoapErrorCode(txt);
      const long = parseSoapErrorLong(txt);
      if (code) o.errorCode = code;
      if (long) o.errorLong = long;
      return res.json(o);
    }
    const isEfatura = /<USER[\s>]/i.test(txt) && /<IDENTIFIER/i.test(txt);
    const aliases = [];
    const re = /<(?:[^/>]+:)?ALIAS>([^<]*)</gi;
    let m;
    while ((m = re.exec(txt)) !== null) aliases.push(m[1]);
    return res.json({ success: true, isEfatura, aliases });
  } catch (e) {
    console.error('[IZIBIZ check-user]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/izibiz/invoices', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'x-izibiz-session gerekli' });
    }
    const direction = String(req.query.direction || 'OUT').toUpperCase() === 'IN' ? 'IN' : 'OUT';
    const items = await izibizFetchGetInvoice(env, sessionId, {
      direction,
      limit: req.query.limit,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      headerOnly: 'Y',
    });
    const ids = items.map((x) => x.uuid || x.id).filter(Boolean);
    res.json({ success: true, items, ids });
  } catch (e) {
    console.error('[IZIBIZ invoices GET]', e);
    res.status(502).json({ success: false, error: e.message, items: [], ids: [] });
  }
});

app.post('/izibiz/list-efatura', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'x-izibiz-session gerekli' });
    }
    const { direction, limit, startDate, endDate, headerOnly } = req.body || {};
    const items = await izibizFetchGetInvoice(env, sessionId, {
      direction: direction || 'OUT',
      limit,
      startDate,
      endDate,
      headerOnly: headerOnly || 'Y',
    });
    res.json({ success: true, items });
  } catch (e) {
    console.error('[IZIBIZ list-efatura]', e);
    res.status(502).json({ success: false, error: e.message, items: [] });
  }
});

app.post('/izibiz/list-earsiv', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'x-izibiz-session gerekli' });
    }
    const { limit, startDate, endDate } = req.body || {};
    const items = await izibizFetchEArchiveList(env, sessionId, { limit, startDate, endDate });
    res.json({ success: true, items });
  } catch (e) {
    console.error('[IZIBIZ list-earsiv]', e);
    res.status(502).json({ success: false, error: e.message, items: [] });
  }
});

// ── E-Arşiv Fatura Gönderme (WriteToArchieveExtended) ──────────────────────────
app.post('/izibiz/send-earchive', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    const { invoiceXml, archiveType, sendEmail, customerEmail, invoiceNumber, invoiceDate, invoiceUuid } = req.body || {};
    if (!sessionId || !invoiceXml) {
      return res.status(400).json({ success: false, error: 'sessionId ve invoiceXml gerekli' });
    }
    const url = izibizEarsivWsUrl(env);
    const earsivTipi = archiveType === 'INTERNET' ? 'INTERNET' : 'NORMAL';
    const subStatus = 'NEW';
    const emailFlag = sendEmail ? 'Y' : 'N';
    const archiveEmail = String(customerEmail || '').trim();
    if (emailFlag === 'Y' && !archiveEmail) {
      return res.status(400).json({ success: false, error: 'sendEmail=Y ise customerEmail gerekli' });
    }
    const invoiceContent = encodeBase64Utf8(invoiceXml);

    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl" xmlns:arc="http://schemas.i2i.com/ei/wsdl/archive">
<soapenv:Body>
<arc:ArchiveInvoiceExtendedRequest>
<arc:REQUEST_HEADER>
<wsdl:SESSION_ID>${escapeXml(sessionId)}</wsdl:SESSION_ID>
<wsdl:COMPRESSED>N</wsdl:COMPRESSED>
<wsdl:APPLICATION_NAME>STOKOZ</wsdl:APPLICATION_NAME>
</arc:REQUEST_HEADER>
<arc:ArchiveInvoiceExtendedContent>
<arc:INVOICE_PROPERTIES>
<arc:EARSIV_FLAG>Y</arc:EARSIV_FLAG>
<arc:EARSIV_PROPERTIES>
<arc:EARSIV_TYPE>${earsivTipi}</arc:EARSIV_TYPE>
<arc:SUB_STATUS>${subStatus}</arc:SUB_STATUS>
<arc:EARSIV_EMAIL_FLAG>${emailFlag}</arc:EARSIV_EMAIL_FLAG>
${emailFlag === 'Y' ? `<arc:EARSIV_EMAIL>${escapeXml(archiveEmail)}</arc:EARSIV_EMAIL>` : ''}
</arc:EARSIV_PROPERTIES>
</arc:INVOICE_PROPERTIES>
<arc:INVOICE_CONTENT>${invoiceContent}</arc:INVOICE_CONTENT>
</arc:ArchiveInvoiceExtendedContent>
</arc:ArchiveInvoiceExtendedRequest>
</soapenv:Body>
</soapenv:Envelope>`;

    console.log('[IZIBIZ send-earchive] env:', env, 'type:', earsivTipi, 'url:', url);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
      body: soap,
    });
    const txt = await r.text();
    console.log('[IZIBIZ send-earchive]', r.status, txt.slice(0, 300));

    if (!r.ok) {
      const err = parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`;
      return res.json({ success: false, error: err, raw: txt.slice(0, 500) });
    }

    if (/<ERROR_TYPE>/i.test(txt)) {
      const err = parseSoapErrorShort(txt) || 'E-Arşiv gönderim hatası';
      return res.json({ success: false, error: err, raw: txt.slice(0, 500) });
    }

    // Başarılı — RETURN_CODE + UUID parse et
    const uuidMatch = txt.match(/<(?:[^/>]+:)?INVOICE_ID>([^<]+)</i);
    const returnCode = txt.match(/<(?:[^/>]+:)?RETURN_CODE>([^<]+)</i);
    return res.json({
      success: true,
      uuid: uuidMatch ? uuidMatch[1].trim() : invoiceUuid,
      invoiceId: invoiceNumber,
      returnCode: returnCode ? returnCode[1].trim() : '0',
      raw: txt.slice(0, 500),
    });
  } catch (e) {
    console.error('[IZIBIZ send-earchive]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── E-Fatura Gönderme (SendInvoice) ──────────────────────────────────────────
app.post('/izibiz/send-invoice', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    const { invoiceXml, senderVkn, senderAlias, receiverVkn, receiverAlias } = req.body || {};
    if (!sessionId || !invoiceXml) {
      return res.status(400).json({ success: false, error: 'sessionId ve invoiceXml gerekli' });
    }
    const url = izibizEfaturaWsUrl(env);
    const invoiceContent = encodeBase64Utf8(invoiceXml);

    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl" xmlns:ent="http://schemas.i2i.com/ei/entity">
<soapenv:Body>
<wsdl:SendInvoiceRequest>
<ent:REQUEST_HEADER>
<ent:SESSION_ID>${escapeXml(sessionId)}</ent:SESSION_ID>
<ent:COMPRESSED>N</ent:COMPRESSED>
<ent:APPLICATION_NAME>STOKOZ</ent:APPLICATION_NAME>
</ent:REQUEST_HEADER>
<wsdl:SENDER vkn="${escapeXml(senderVkn || '')}" alias="${escapeXml(senderAlias || 'urn:mail:defaultgb@izibiz.com.tr')}" />
<wsdl:RECEIVER vkn="${escapeXml(receiverVkn || '')}" alias="${escapeXml(receiverAlias || 'urn:mail:defaultpk@izibiz.com.tr')}" />
<wsdl:INVOICE>
<wsdl:CONTENT>${invoiceContent}</wsdl:CONTENT>
</wsdl:INVOICE>
</wsdl:SendInvoiceRequest>
</soapenv:Body>
</soapenv:Envelope>`;

    console.log('[IZIBIZ send-invoice] env:', env, 'url:', url);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
      body: soap,
    });
    const txt = await r.text();
    console.log('[IZIBIZ send-invoice]', r.status, txt.slice(0, 300));

    if (!r.ok || /<ERROR_TYPE>/i.test(txt)) {
      const err = parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`;
      return res.json({ success: false, error: err, raw: txt.slice(0, 500) });
    }

    const returnCode = txt.match(/<(?:[^/>]+:)?RETURN_CODE>([^<]+)</i);
    const uuidM =
      txt.match(/<(?:[^/>]+:)?UUID>([^<]+)</i) ||
      txt.match(/<(?:[^/>]+:)?INVOICE_ID>([^<]+)</i);
    const idM = txt.match(/<(?:[^/>]+:)?ID>([^<]+)</i);
    return res.json({
      success: true,
      returnCode: returnCode ? returnCode[1].trim() : '0',
      uuid: uuidM ? uuidM[1].trim() : undefined,
      documentNumber: idM ? idM[1].trim() : undefined,
      raw: txt.slice(0, 500),
    });
  } catch (e) {
    console.error('[IZIBIZ send-invoice]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── E-Arşiv Durum Sorgulama (GetEArchiveInvoiceStatus) ──────────────────────
app.post('/izibiz/get-earchive-status', async (req, res) => {
  try {
    const env = req.headers['x-izibiz-env'] || 'test';
    const sessionId = req.headers['x-izibiz-session'];
    const { uuid } = req.body || {};
    if (!sessionId || !uuid) {
      return res.status(400).json({ success: false, error: 'sessionId ve uuid gerekli' });
    }
    const url = izibizEarsivWsUrl(env);

    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsdl="http://schemas.i2i.com/ei/wsdl" xmlns:arc="http://schemas.i2i.com/ei/wsdl/archive">
<soapenv:Body>
<arc:GetEArchiveInvoiceStatusRequest>
<arc:REQUEST_HEADER>
<wsdl:SESSION_ID>${escapeXml(sessionId)}</wsdl:SESSION_ID>
</arc:REQUEST_HEADER>
<arc:UUID>${escapeXml(uuid)}</arc:UUID>
</arc:GetEArchiveInvoiceStatusRequest>
</soapenv:Body>
</soapenv:Envelope>`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
      body: soap,
    });
    const txt = await r.text();
    console.log('[IZIBIZ earchive-status]', r.status, txt.slice(0, 300));

    if (!r.ok || /<ERROR_TYPE>/i.test(txt)) {
      const err = parseSoapErrorShort(txt) || `İzibiz HTTP ${r.status}`;
      return res.json({ success: false, error: err });
    }

    const statusMatch = txt.match(/<(?:[^/>]+:)?INVOICE_STATUS>([^<]+)</i);
    const emailMatch = txt.match(/<(?:[^/>]+:)?EMAIL_STATUS>([^<]+)</i);
    const reportMatch = txt.match(/<(?:[^/>]+:)?REPORT_STATUS>([^<]+)</i);
    return res.json({
      success: true,
      status: statusMatch ? statusMatch[1].trim() : 'UNKNOWN',
      emailStatus: emailMatch ? emailMatch[1].trim() : undefined,
      reportStatus: reportMatch ? reportMatch[1].trim() : undefined,
    });
  } catch (e) {
    console.error('[IZIBIZ earchive-status]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Yurtiçi Kargo SOAP Proxy ─────────────────────────────────────────────────
// Kaynak: Web Servis Giden Kargo Teknik Döküman_V3.doc
// Bu sunucunun çıkış IP'si Yurtiçi'ye kayıt ettirilmelidir.
function escXmlYk(v) {
  return String(v || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

app.post('/yurtici/createShipment', async (req, res) => {
  const { wsUserName, wsPassword, orders } = req.body || {};
  if (!wsUserName || !wsPassword || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ message: 'wsUserName, wsPassword ve orders zorunludur.' });
  }

  const orderXml = orders.map((o) => `<ShippingOrderVO>
      <cargoKey>${escXmlYk(o.cargoKey)}</cargoKey>
      <invoiceKey>${escXmlYk(o.invoiceKey)}</invoiceKey>
      <receiverCustName>${escXmlYk(o.receiverCustName)}</receiverCustName>
      <receiverAddress>${escXmlYk(o.receiverAddress)}</receiverAddress>
      <receiverPhone1>${escXmlYk(o.receiverPhone1)}</receiverPhone1>
      <cityName>${escXmlYk(o.cityName)}</cityName>
      <townName>${escXmlYk(o.townName)}</townName>
      <cargoCount>${parseInt(o.cargoCount) || 1}</cargoCount>
      <dcCreditRule/><dcSelectedCredit/><ttDocumentId/>
    </ShippingOrderVO>`).join('\n');

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
  <soapenv:Header/>
  <soapenv:Body>
    <ship:createShipment>
      <wsUserName>${escXmlYk(wsUserName)}</wsUserName>
      <wsPassword>${escXmlYk(wsPassword)}</wsPassword>
      <userLanguage>TR</userLanguage>
      ${orderXml}
    </ship:createShipment>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const ykRes = await fetch(
      'https://ws.yurticikargo.com/KOPSWebService/ShippingOrderDispatcherServices.asmx',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"http://yurticikargo.com.tr/ShippingOrderDispatcherServices/createShipment"',
        },
        body: soapBody,
      }
    );

    const xmlText = await ykRes.text();
    console.log('[yurtici] HTTP', ykRes.status, '| slice:', xmlText.slice(0, 200));

    if (!ykRes.ok) {
      return res.status(200).json({
        message: `Yurtiçi SOAP HTTP hatası (${ykRes.status})`,
        httpStatus: ykRes.status,
        usedEndpoint: 'https://ws.yurticikargo.com/KOPSWebService/ShippingOrderDispatcherServices.asmx',
        raw: xmlText.slice(0, 800),
      });
    }

    const get = (tag) => (xmlText.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1] || '';
    const outFlag   = get('outFlag');
    const outResult = get('outResult');
    const jobId     = get('jobId');

    const details = [];
    const re = /<shippingOrderDetailVO>([\s\S]*?)<\/shippingOrderDetailVO>/g;
    let m;
    while ((m = re.exec(xmlText)) !== null) {
      const inner = m[1];
      const gi = (tag) => (inner.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1] || '';
      details.push({
        cargoKey:   gi('cargoKey'),
        invoiceKey: gi('invoiceKey'),
        errCode:    parseInt(gi('errCode') || '0', 10),
        errMessage: gi('errMessage'),
      });
    }

    return res.json({ outFlag, outResult, jobId, details });
  } catch (err) {
    console.error('[yurtici] hata:', err.message);
    return res.status(500).json({ message: err.message || 'Yurtiçi proxy hatası' });
  }
});
// ── /Yurtiçi ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`STOKÖZ proxy v5.5 izibiz-lists → ${MNG_BASE} → port ${PORT}`));
