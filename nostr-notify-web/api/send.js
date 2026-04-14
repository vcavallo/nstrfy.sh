import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';
import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';

export const config = { runtime: 'nodejs' };

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const VALID_PRIORITIES = new Set(['urgent', 'high', 'default', 'low', 'min']);
const TOPIC_RE = /^[A-Za-z0-9._-]+$/;
const RELAY_RE = /^wss:\/\/[A-Za-z0-9.-]+(?::\d+)?(\/.*)?$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

function loadDemoSecretKey() {
  const raw = process.env.DEMO_NSEC;
  if (!raw) throw new Error('DEMO_NSEC env var not set');
  const trimmed = raw.trim();
  if (trimmed.startsWith('nsec1')) {
    const { type, data } = nip19.decode(trimmed);
    if (type !== 'nsec') throw new Error('DEMO_NSEC is not a valid nsec');
    return data;
  }
  if (HEX64_RE.test(trimmed)) return hexToBytes(trimmed);
  throw new Error('DEMO_NSEC must be hex (64 chars) or bech32 (nsec1...)');
}

function normalizeRecipient(to) {
  if (typeof to !== 'string') return null;
  const s = to.trim();
  if (s.startsWith('npub1')) {
    const { type, data } = nip19.decode(s);
    if (type !== 'npub') throw new Error('invalid npub');
    return data;
  }
  if (HEX64_RE.test(s)) return s.toLowerCase();
  throw new Error('recipient must be npub or 64-char hex');
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'body must be JSON object';
  if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200) {
    return 'title: required string, 1–200 chars';
  }
  if (typeof body.message !== 'string' || body.message.length < 1 || body.message.length > 2000) {
    return 'message: required string, 1–2000 chars';
  }
  if (typeof body.topic !== 'string' || body.topic.length < 1 || body.topic.length > 100 || !TOPIC_RE.test(body.topic)) {
    return 'topic: required, 1–100 chars, [A-Za-z0-9._-]';
  }
  if (body.priority != null && !VALID_PRIORITIES.has(body.priority)) {
    return 'priority: one of urgent|high|default|low|min';
  }
  if (body.expiration != null) {
    const n = Number(body.expiration);
    if (!Number.isInteger(n) || n < 300 || n > 86400) {
      return 'expiration: integer seconds, 300–86400';
    }
  }
  if (body.relays != null) {
    if (!Array.isArray(body.relays) || body.relays.length === 0) {
      return 'relays: non-empty array of wss:// URLs';
    }
    for (const r of body.relays) {
      if (typeof r !== 'string' || !RELAY_RE.test(r)) return `relays: invalid url "${r}"`;
    }
  }
  return null;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const err = validate(body);
  if (err) return res.status(400).json({ error: err });

  let recipientHex = null;
  try {
    if (body.to != null) recipientHex = normalizeRecipient(body.to);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  let sk;
  try {
    sk = loadDemoSecretKey();
  } catch (e) {
    return res.status(500).json({ error: 'server misconfigured: ' + e.message });
  }

  const now = Math.floor(Date.now() / 1000);
  const expirationSecs = body.expiration != null ? Number(body.expiration) : 3600;
  const expiresAt = now + expirationSecs;

  const payload = {
    version: '1.0',
    title: body.title,
    message: body.message,
    priority: body.priority || 'default',
    timestamp: now,
    topic: body.topic || '',
  };
  const payloadJson = JSON.stringify(payload);

  const dTag = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const tags = [
    ['d', dTag],
    ['expiration', String(expiresAt)],
  ];

  let content;
  if (recipientHex) {
    const conversationKey = nip44.v2.utils.getConversationKey(sk, recipientHex);
    content = nip44.v2.encrypt(payloadJson, conversationKey);
    tags.push(['p', recipientHex]);
  } else {
    content = payloadJson;
  }

  const event = finalizeEvent(
    {
      kind: 7741,
      created_at: now,
      tags,
      content,
    },
    sk,
  );

  const relays = (body.relays && body.relays.length ? body.relays : DEFAULT_RELAYS).slice(0, 10);
  const publishResults = await Promise.all(relays.map((r) => publishOne(r, event, 5000)));
  const publishedTo = publishResults.filter((r) => r.ok).map((r) => r.relay);
  const rejectedBy = publishResults.filter((r) => !r.ok).map((r) => ({ relay: r.relay, error: r.error }));

  const senderPubkey = getPublicKey(sk);
  return res.status(200).json({
    eventId: event.id,
    publishedTo,
    rejectedBy,
    senderNpub: nip19.npubEncode(senderPubkey),
    senderPubkey,
    expiresAt,
  });
}

// Publish a signed event to a single relay and wait for an OK/NOTICE reply
// (per NIP-01 / NIP-20). Resolves to { ok, relay, error? } within timeoutMs.
function publishOne(url, event, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch {}
      clearTimeout(timer);
      resolve({ ok, relay: url, error });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    let ws;
    try {
      ws = new WebSocket(url, { handshakeTimeout: Math.min(timeoutMs, 3000) });
    } catch (e) {
      return finish(false, `ws_ctor: ${e.message}`);
    }
    ws.on('open', () => {
      try {
        ws.send(JSON.stringify(['EVENT', event]));
      } catch (e) {
        finish(false, `send_failed: ${e.message}`);
      }
    });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'OK' && msg[1] === event.id) {
        if (msg[2] === true) finish(true);
        else finish(false, `rejected: ${msg[3] || 'unknown'}`);
      } else if (msg[0] === 'NOTICE') {
        // Some relays NOTICE on rate-limit instead of OK=false; ignore unless nothing else arrives.
      }
    });
    ws.on('error', (err) => finish(false, `ws_error: ${err.message || err}`));
    ws.on('close', () => { if (!done) finish(false, 'closed_without_ok'); });
  });
}
