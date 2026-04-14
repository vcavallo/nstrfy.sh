# nstrfy web client

Browser client for the [nstrfy](../) nostr-based push-notification system.

**Live at <https://nstrfy.sh>.**

## Features

- **Send tab** — compose and publish kind 7741 notifications. Public broadcast,
  or NIP-44 encrypted to a specific npub.
- **Listen tab** — subscribe to incoming notifications, with browser/desktop
  alerts and a live unread indicator on the tab.
- **NIP-07 signer** — connect a browser extension (Alby, nos2x, etc.) to sign
  events with your own key. Without a signer, the `/api/send` function signs
  with a shared demo identity.
- **PWA** — installable, with a service worker registered.

Per-topic whitelists are still to come **in this web client** — they already
work in the [Android app](https://github.com/vcavallo/nstrfy-android). See
`../WEB_CLIENT_PLAN.md`.

## Layout

```
nostr-notify-web/
├── index.html          # Send + Listen tabs, signer bar
├── app.js              # Tab UI, signer integration, send/listen (vanilla JS, no build step)
├── styles.css
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── .well-known/
│   └── nostr.json      # NIP-05 mapping for the demo identity
├── api/
│   └── send.js         # Vercel Node function — signs + publishes
├── package.json        # nostr-tools + ws (for the function)
└── vercel.json         # CORS + content-type headers
```

## Deploy (Vercel)

This directory is the Vercel project root.

1. **Generate the demo nsec** (one-off):
   ```bash
   # with nak installed
   nak key generate
   # or with nostr-tools:
   node -e "import('nostr-tools').then(nt => { const sk = nt.generateSecretKey(); console.log('nsec:', nt.nip19.nsecEncode(sk)); console.log('pubkey hex:', nt.getPublicKey(sk)); console.log('npub:', nt.nip19.npubEncode(nt.getPublicKey(sk))); })"
   ```

2. **Set the secret** on Vercel:
   ```bash
   vercel env add DEMO_NSEC
   # paste the nsec (bech32 nsec1... or 64-char hex — both work)
   ```

3. **Fill in `.well-known/nostr.json`** — replace `REPLACE_WITH_DEMO_PUBKEY_HEX`
   with the **hex pubkey** (not npub) from step 1.

4. **Deploy**:
   ```bash
   cd nostr-notify-web
   vercel --prod
   ```

5. **Point your custom domain** at the Vercel project. After DNS resolves, verify:
   - `https://<your-domain>/` serves the form
   - `https://<your-domain>/.well-known/nostr.json` returns `{"names":{"_":"<hex>"}}`
   - `POST https://<your-domain>/api/send` signs + publishes

## Local dev

```bash
cd nostr-notify-web
npm install
vercel dev          # serves the static site + runs the function on :3000
```

Then open `http://localhost:3000`. Set `DEMO_NSEC` in a local `.env` or via
`vercel env pull`.

## /api/send contract

`POST /api/send`, JSON body:

| field | required | notes |
|---|---|---|
| `title` | yes | 1–200 chars |
| `message` | yes | 1–2000 chars |
| `to` | no | npub bech32 or 64-char hex. Omit for a public broadcast. |
| `topic` | no | 0–100 chars, `[A-Za-z0-9._-]` |
| `priority` | no | `urgent\|high\|default\|low\|min` (default: `default`) |
| `expiration` | no | integer seconds, 300–86400 (default: 3600) |
| `relays` | no | array of `wss://` URLs (default: damus, nos.lol, nostr.band) |

Response:
```json
{
  "eventId": "hex...",
  "publishedTo": ["wss://..."],
  "senderNpub": "npub1...",
  "senderPubkey": "hex...",
  "expiresAt": 1744592400
}
```

The handler **always** emits kind 7741 — the `kind` field in the body is ignored.

## Verify end-to-end

1. Note your Android nstrfy app's npub
2. On the deployed page, set `to` to that npub, fill in title/message, Send
3. The Android app should receive the notification within seconds
4. Visit `https://njump.me/<eventId>` — the event is queryable publicly

Send a second notification with `to` blank (public broadcast). The Android app
won't show it (no `#p` tag), but njump.me shows the plain JSON content.

## License

WTFPL, same as the rest of the project.
