# Nostr Notify - Web App

A Progressive Web App (PWA) for receiving encrypted notifications from the nostr-notify CLI tool. Works in any modern browser and can be installed as a standalone app.

## 🌟 Features

- 🌐 **Works in Any Browser** - Chrome, Firefox, Safari, Edge
- 📱 **Progressive Web App** - Install on desktop or mobile
- 🔔 **Browser Notifications** - Native notification support
- 🔐 **End-to-End Encrypted** - NIP-04 encryption
- 🌊 **Multiple Relays** - Connect to multiple Nostr relays
- 💾 **Offline Capable** - Service worker caching
- 📊 **Notification History** - View recent notifications
- ⚡ **Real-time Updates** - WebSocket connections
- 🎨 **Material Design** - Clean, modern interface
- 📈 **Connection Stats** - Monitor relay connections and uptime

## 🚀 Quick Start

### Option 1: Use Hosted Version (Recommended)

1. Visit the hosted web app (if available)
2. Generate or import your private key
3. Click "Save Settings" and "Start Listening"
4. Grant notification permission when prompted
5. Share your npub with senders

### Option 2: Run Locally

```bash
# Clone or download the files
cd nostr-notify-web

# Serve with any static file server
# Option A: Python
python3 -m http.server 8000

# Option B: Node.js http-server
npx http-server -p 8000

# Option C: PHP
php -S localhost:8000

# Open in browser
open http://localhost:8000
```

### Option 3: Deploy to Static Host

Deploy to any static hosting service:
- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Drag and drop folder
- **Vercel**: Import repository
- **Cloudflare Pages**: Connect repository

## 📋 Setup Instructions

### 1. Generate or Import Key

**Generate New Key:**
- Click "🎲 Generate New Key"
- A random private key will be created
- **Important**: Save this key securely!

**Import Existing Key:**
- Paste your 64-character hex private key
- This can be a key from any Nostr client

### 2. Get Your Public Key

- Click "🔑 Show Public Key"
- Your npub will be displayed
- Click 📋 to copy it
- **Share this npub** with people who want to send you notifications

### 3. Configure Relays (Optional)

Default relays work well for most users:
- wss://relay.damus.io
- wss://nos.lol
- wss://relay.nostr.band
- wss://relay.primal.net

You can add more relays (one per line) if needed.

### 4. Save and Start

- Click "💾 Save Settings"
- Click "▶️ Start Listening"
- Grant notification permission when prompted
- The app will connect to relays and listen for notifications

### 5. Test It!

From your computer with the CLI tool:

```bash
nostr-notify --to YOUR_NPUB \
  --title "Test Notification" \
  --priority high \
  "Hello from the CLI!"
```

You should see:
1. The notification appear in the browser
2. It added to the notification list in the app
3. Stats updated (notification count)

## 💡 Usage

### Receiving Notifications

Once started, the app will:
- Connect to all configured relays
- Subscribe to notifications for your npub
- Automatically decrypt and display notifications
- Show browser notifications (if permitted)
- Save notification history locally

### Notification Priority Levels

The app respects priority levels from the CLI:

- **🔴 Urgent** - Red border, requires interaction
- **🟠 High** - Orange border, with sound
- **🔵 Default** - Blue border, normal notification
- **🟣 Low** - Purple border, silent
- **⚫ Min** - Gray border, minimal

### Browser Notifications

The app shows native browser notifications:
- Desktop notifications on Windows/macOS/Linux
- Mobile notifications on Android/iOS (when installed as PWA)
- Respects browser notification settings
- Click to focus the app

### Notification History

- View last 100 notifications
- Displays title, message, time, priority, topic, and tags
- Stored in browser localStorage
- Persists across sessions
- Can be cleared with "🗑️ Clear" button

## 🔐 Security & Privacy

### Key Storage

- Private keys stored in browser localStorage
- Never transmitted to any server
- Only used locally for decryption
- Encrypted by browser's built-in security

### Encryption

- All notifications are end-to-end encrypted
- Uses NIP-04 (secp256k1 ECDH + AES-256-CBC)
- Relays cannot read notification content
- Only you can decrypt your notifications

### Data Storage

**Stored Locally:**
- Private key (localStorage)
- Relay configuration (localStorage)
- Notification history (localStorage)
- Settings (localStorage)

**Never Stored or Transmitted:**
- Your private key is never sent anywhere
- All decryption happens locally
- No analytics or tracking

### Best Practices

1. **Use HTTPS** - Always access via HTTPS in production
2. **Backup Your Key** - Save your private key somewhere safe
3. **Don't Share Private Key** - Only share your npub (public key)
4. **Use Strong Device Security** - Protect your device with password/PIN
5. **Regular Backups** - Export and backup your private key

## 📱 Progressive Web App (PWA)

### Installing as App

**Desktop (Chrome/Edge):**
1. Click install icon in address bar
2. Or Menu > Install Nostr Notify
3. App opens in its own window

**Mobile (Android):**
1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Install app" or "Add to Home Screen"

**Mobile (iOS/Safari):**
1. Tap Share button
2. Tap "Add to Home Screen"
3. Tap "Add"

### Benefits of Installing

- ✅ Opens in dedicated window
- ✅ Works offline (cached files)
- ✅ Better notification experience
- ✅ Faster loading (service worker)
- ✅ Home screen icon
- ✅ No browser UI clutter

## 🛠️ Technical Details

### Architecture

```
┌─────────────────────────────────┐
│     Web App (Browser)           │
│                                 │
│  ┌──────────────────────────┐  │
│  │  UI Layer (HTML/CSS)     │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  App Logic (JavaScript)  │  │
│  │  - Key management        │  │
│  │  - Nostr client          │  │
│  │  - Decryption            │  │
│  │  - Notifications         │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  nostr-tools Library     │  │
│  │  (via ESM CDN)           │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Service Worker          │  │
│  │  - Caching               │  │
│  │  - Offline support       │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
                │
                ▼
        Nostr Relays
    (WebSocket connections)
```

### Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern styling, animations
- **JavaScript (ES6+)** - Module syntax, async/await
- **nostr-tools** - Nostr protocol library (v2.7.0)
- **Service Worker API** - PWA functionality
- **Notifications API** - Browser notifications
- **LocalStorage API** - Data persistence
- **WebSocket API** - Real-time connections

### File Structure

```
nostr-notify-web/
├── index.html          # Main HTML file
├── styles.css          # Stylesheet
├── app.js              # Main application logic
├── sw.js               # Service worker
├── manifest.json       # PWA manifest
├── icon.svg            # App icon (source)
├── icon-192.png        # 192x192 icon
├── icon-512.png        # 512x512 icon
└── README.md           # This file
```

### Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Full support |
| Edge | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Safari | ✅ | ⚠️ | Limited PWA features |
| Opera | ✅ | ✅ | Full support |

**Minimum Versions:**
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## 🐛 Troubleshooting

### Notifications Not Appearing

1. **Check browser notification permission**
   - Chrome: Settings > Privacy > Notifications
   - Firefox: Settings > Privacy > Permissions > Notifications
   - Safari: System Preferences > Notifications

2. **Check if app is listening**
   - Status should show "Connected"
   - Connected relays count > 0

3. **Test with browser notification**
   - Click "Test Notification" link in footer
   - If this works, issue is with Nostr setup

4. **Check browser console**
   - Press F12 to open DevTools
   - Look for errors in Console tab

### Can't Connect to Relays

1. **Check internet connection**
2. **Try different relays**
   - Some relays may be down
   - Add more relays to increase reliability
3. **Check browser console for errors**
4. **Disable browser extensions**
   - Ad blockers may block WebSocket connections
5. **Check firewall/network**
   - Some networks block WebSocket connections

### Private Key Issues

1. **Invalid private key error**
   - Must be exactly 64 hexadecimal characters
   - No spaces or special characters
   - Generate a new one if unsure

2. **Lost private key**
   - Cannot be recovered
   - Generate a new key
   - Update your npub with senders

### PWA Installation Issues

1. **Install button not showing**
   - Must be served over HTTPS (except localhost)
   - Browser must support PWA
   - May already be installed

2. **App not working offline**
   - Service worker may not be registered
   - Check DevTools > Application > Service Workers
   - Clear cache and reload

### Performance Issues

1. **App running slow**
   - Clear notification history
   - Check number of connected relays (4-6 is optimal)
   - Close other tabs

2. **High battery usage (mobile)**
   - Reduce number of relays
   - Close app when not needed
   - Use Android/iOS native apps for better efficiency

## 🚀 Deployment

### GitHub Pages

```bash
# Create gh-pages branch
git checkout -b gh-pages

# Add files
git add .
git commit -m "Deploy to GitHub Pages"

# Push
git push origin gh-pages

# Access at: https://username.github.io/nostr-notify-web/
```

### Netlify

1. Drag and drop folder to Netlify
2. Or connect GitHub repository
3. Deploy automatically on push

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or connect GitHub repository in Vercel dashboard
```

### Cloudflare Pages

1. Connect GitHub repository
2. Build settings: None needed (static site)
3. Deploy automatically on push

### Self-Hosting

```bash
# Using nginx
server {
    listen 80;
    server_name notify.example.com;
    root /var/www/nostr-notify-web;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Or using Apache
<VirtualHost *:80>
    ServerName notify.example.com
    DocumentRoot /var/www/nostr-notify-web
    
    <Directory /var/www/nostr-notify-web>
        Options -Indexes +FollowSymLinks
        AllowOverride All
    </Directory>
</VirtualHost>
```

## 🎨 Customization

### Changing Colors

Edit `styles.css` and modify CSS variables:

```css
:root {
    --primary-color: #6200EE;    /* Main color */
    --primary-dark: #3700B3;     /* Dark variant */
    --secondary-color: #03DAC6;  /* Accent color */
    --background: #FAFAFA;       /* Background */
    --surface: #FFFFFF;          /* Card background */
}
```

### Adding Custom Relays

Edit default relays in `index.html`:

```html
<textarea id="relays" ...>
wss://your-custom-relay.com
wss://relay.damus.io
wss://nos.lol
</textarea>
```

### Customizing Icons

Replace `icon-192.png` and `icon-512.png` with your own icons.

## 📊 Monitoring

### Connection Stats

The app displays real-time stats:
- **Connected Relays**: Number of active relay connections
- **Notifications Received**: Total count since start
- **Uptime**: How long the listener has been running

### Browser Console

For debugging, open DevTools (F12) and check console for:
- Connection status to each relay
- Received events
- Decryption success/failures
- Errors and warnings

## 🤝 Contributing

Contributions welcome! Areas to improve:

- [ ] Better PWA offline experience
- [ ] Notification filtering/muting
- [ ] Do Not Disturb schedule
- [ ] Custom notification sounds
- [ ] Dark mode
- [ ] Multiple languages
- [ ] Export/import settings
- [ ] Notification search
- [ ] Per-sender settings

## 📄 License

MIT License - Same as nostr-notify project

## 🔗 Related Projects

- [nostr-notify CLI](../nostr-notify/) - Send notifications
- [nostr-notify Android](../nostr-notify-android/) - Android app
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools)

## 💬 Support

- 🐛 Report bugs: GitHub Issues
- 💡 Feature requests: GitHub Issues
- 📖 Documentation: This README
- 💭 Questions: GitHub Discussions

---

**Ready to receive notifications?**

1. Open `index.html` in your browser
2. Generate a key
3. Start listening
4. Send a test notification!

Enjoy your decentralized, encrypted notifications! 🎉
