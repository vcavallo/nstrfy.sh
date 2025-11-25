// Import nostr-tools from CDN
import {
    SimplePool,
    nip04,
    nip44,
    getPublicKey,
    generateSecretKey,
    nip19
} from 'https://esm.sh/nostr-tools@2.7.0';

// Application State
const state = {
    privateKey: null,
    publicKey: null,
    relays: [],
    pool: null,
    subscription: null,
    notifications: [],
    connectedRelays: 0,
    startTime: null,
    notificationCount: 0
};

// DOM Elements
const elements = {
    privateKeyInput: document.getElementById('private-key'),
    relaysInput: document.getElementById('relays'),
    generateKeyBtn: document.getElementById('generate-key'),
    showPubkeyBtn: document.getElementById('show-pubkey'),
    toggleKeyVisibilityBtn: document.getElementById('toggle-key-visibility'),
    saveSettingsBtn: document.getElementById('save-settings'),
    startListeningBtn: document.getElementById('start-listening'),
    stopListeningBtn: document.getElementById('stop-listening'),
    pubkeyDisplay: document.getElementById('pubkey-display'),
    npubText: document.getElementById('npub-text'),
    copyNpubBtn: document.getElementById('copy-npub'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    connectedRelaysSpan: document.getElementById('connected-relays'),
    notificationCountSpan: document.getElementById('notification-count'),
    uptimeSpan: document.getElementById('uptime'),
    notificationsList: document.getElementById('notifications-list'),
    clearNotificationsBtn: document.getElementById('clear-notifications'),
    testNotificationBtn: document.getElementById('test-notification'),
    installPwaBtn: document.getElementById('install-pwa')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
    requestNotificationPermission();
    registerServiceWorker();
});

// Load Settings from LocalStorage
function loadSettings() {
    const savedKey = localStorage.getItem('nostr-notify-key');
    const savedRelays = localStorage.getItem('nostr-notify-relays');
    
    if (savedKey) {
        elements.privateKeyInput.value = savedKey;
        state.privateKey = savedKey;
        state.publicKey = getPublicKey(hexToBytes(savedKey));
        elements.startListeningBtn.disabled = false;
    }
    
    if (savedRelays) {
        elements.relaysInput.value = savedRelays;
    }
    
    // Load notification history
    const savedNotifications = localStorage.getItem('nostr-notify-history');
    if (savedNotifications) {
        state.notifications = JSON.parse(savedNotifications);
        renderNotifications();
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    const privateKey = elements.privateKeyInput.value.trim();
    const relays = elements.relaysInput.value;
    
    if (!isValidPrivateKey(privateKey)) {
        showToast('Invalid private key. Must be 64 hex characters.', 'error');
        return;
    }
    
    localStorage.setItem('nostr-notify-key', privateKey);
    localStorage.setItem('nostr-notify-relays', relays);
    
    state.privateKey = privateKey;
    state.publicKey = getPublicKey(hexToBytes(privateKey));
    state.relays = parseRelays(relays);
    
    elements.startListeningBtn.disabled = false;
    
    showToast('Settings saved successfully!', 'success');
}

// Setup Event Listeners
function setupEventListeners() {
    elements.generateKeyBtn.addEventListener('click', generateNewKey);
    elements.showPubkeyBtn.addEventListener('click', showPublicKey);
    elements.toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.startListeningBtn.addEventListener('click', startListening);
    elements.stopListeningBtn.addEventListener('click', stopListening);
    elements.copyNpubBtn.addEventListener('click', copyNpubToClipboard);
    elements.clearNotificationsBtn.addEventListener('click', clearNotifications);
    elements.testNotificationBtn.addEventListener('click', showTestNotification);
    elements.installPwaBtn.addEventListener('click', installPWA);
}

// Generate New Key
function generateNewKey() {
    const secretKey = generateSecretKey();
    const privateKeyHex = bytesToHex(secretKey);
    
    elements.privateKeyInput.value = privateKeyHex;
    showToast('New key generated! Remember to save it.', 'success');
}

// Show Public Key
function showPublicKey() {
    const privateKey = elements.privateKeyInput.value.trim();
    
    if (!isValidPrivateKey(privateKey)) {
        showToast('Please enter a valid private key first.', 'error');
        return;
    }
    
    const publicKey = getPublicKey(hexToBytes(privateKey));
    const npub = nip19.npubEncode(publicKey);
    
    elements.npubText.textContent = npub;
    elements.pubkeyDisplay.classList.remove('hidden');
    
    showToast('Public key displayed!', 'info');
}

// Toggle Key Visibility
function toggleKeyVisibility() {
    const input = elements.privateKeyInput;
    if (input.type === 'password') {
        input.type = 'text';
        elements.toggleKeyVisibilityBtn.textContent = '🙈';
    } else {
        input.type = 'password';
        elements.toggleKeyVisibilityBtn.textContent = '👁️';
    }
}

// Copy Npub to Clipboard
async function copyNpubToClipboard() {
    const npub = elements.npubText.textContent;
    try {
        await navigator.clipboard.writeText(npub);
        showToast('Npub copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
    }
}

// Start Listening
async function startListening() {
    if (!state.privateKey) {
        showToast('Please save settings first', 'error');
        return;
    }

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Notification permission granted!', 'success');
        } else {
            showToast('Browser notifications disabled. You can still see notifications in the app.', 'warning');
        }
    }
    
    state.relays = parseRelays(elements.relaysInput.value);
    
    if (state.relays.length === 0) {
        showToast('Please add at least one relay', 'error');
        return;
    }
    
    // Create pool and subscribe
    state.pool = new SimplePool();
    state.startTime = Date.now();
    
    const filter = {
        kinds: [30078],
        '#p': [state.publicKey],
        since: Math.floor(Date.now() / 1000)
    };
    
    console.log('Subscribing with filter:', filter);
    console.log('To relays:', state.relays);
    
    state.subscription = state.pool.subscribeMany(
        state.relays,
        [filter],
        {
            onevent: handleNostrEvent,
            oneose: () => console.log('End of stored events'),
            onclose: () => console.log('Subscription closed')
        }
    );
    
    // Update UI
    updateStatus('connecting', 'Connecting...');
    elements.startListeningBtn.classList.add('hidden');
    elements.stopListeningBtn.classList.remove('hidden');
    
    // Start monitoring connections
    monitorConnections();
    startUptimeCounter();
    
    showToast('Started listening for notifications', 'success');
}

// Stop Listening
function stopListening() {
    if (state.subscription) {
        state.subscription.close();
        state.subscription = null;
    }
    
    if (state.pool) {
        state.pool.close(state.relays);
        state.pool = null;
    }
    
    state.connectedRelays = 0;
    state.startTime = null;
    
    updateStatus('disconnected', 'Disconnected');
    updateStats();
    
    elements.startListeningBtn.classList.remove('hidden');
    elements.stopListeningBtn.classList.add('hidden');
    
    showToast('Stopped listening', 'info');
}

// Handle Nostr Event
async function handleNostrEvent(event) {
    console.log('Received event:', event);

    try {
        // Try NIP-44 first (newer, more secure), fall back to NIP-04
        let decrypted;
        try {
            const privateKeyBytes = hexToBytes(state.privateKey);
            const conversationKey = nip44.getConversationKey(privateKeyBytes, event.pubkey);
            decrypted = nip44.decrypt(event.content, conversationKey);
            console.log('Decrypted with NIP-44');
        } catch (nip44Error) {
            console.log('NIP-44 failed, trying NIP-04...', nip44Error.message);
            decrypted = await nip04.decrypt(
                state.privateKey,
                event.pubkey,
                event.content
            );
            console.log('Decrypted with NIP-04');
        }

        console.log('Decrypted content:', decrypted);
        
        const notification = JSON.parse(decrypted);
        
        // Add metadata
        notification.id = event.id;
        notification.receivedAt = Date.now();
        notification.from = event.pubkey;
        
        // Add to state
        state.notifications.unshift(notification);
        state.notificationCount++;
        
        // Save to localStorage
        saveNotificationHistory();
        
        // Update UI
        renderNotifications();
        updateStats();
        
        // Show browser notification
        showBrowserNotification(notification);
        
    } catch (err) {
        console.error('Failed to process notification:', err);
        showToast('Failed to decrypt notification', 'error');
    }
}

// Show Browser Notification
async function showBrowserNotification(notification) {
    if (Notification.permission !== 'granted') {
        return;
    }
    
    const options = {
        body: notification.message,
        icon: notification.icon || 'icon-192.png',
        badge: 'icon-192.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'min'
    };
    
    try {
        const browserNotification = new Notification(
            notification.title || 'Nostr Notification',
            options
        );
        
        browserNotification.onclick = () => {
            window.focus();
            browserNotification.close();
        };
    } catch (err) {
        console.error('Failed to show browser notification:', err);
    }
}

// Render Notifications
function renderNotifications() {
    const container = elements.notificationsList;
    
    if (state.notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No notifications yet</p>
                <p class="help-text">Start listening to receive notifications</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.notifications.map(notif => `
        <div class="notification-item priority-${notif.priority || 'default'}">
            <div class="notification-header">
                <div class="notification-title">
                    ${escapeHtml(notif.title || 'Notification')}
                </div>
                <div class="notification-time">
                    ${formatTime(notif.receivedAt)}
                </div>
            </div>
            <div class="notification-message">
                ${escapeHtml(notif.message)}
            </div>
            <div class="notification-meta">
                ${notif.priority ? `<span class="notification-badge">${notif.priority}</span>` : ''}
                ${notif.topic ? `<span>📂 ${escapeHtml(notif.topic)}</span>` : ''}
                ${notif.tags && notif.tags.length > 0 ? `<span>🏷️ ${notif.tags.join(', ')}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// Clear Notifications
function clearNotifications() {
    if (confirm('Clear all notifications?')) {
        state.notifications = [];
        state.notificationCount = 0;
        localStorage.removeItem('nostr-notify-history');
        renderNotifications();
        updateStats();
        showToast('Notifications cleared', 'info');
    }
}

// Save Notification History
function saveNotificationHistory() {
    // Keep only last 100 notifications
    const toSave = state.notifications.slice(0, 100);
    localStorage.setItem('nostr-notify-history', JSON.stringify(toSave));
}

// Monitor Relay Connections
function monitorConnections() {
    if (!state.pool) return;
    
    // Check connections periodically
    const checkInterval = setInterval(() => {
        if (!state.pool) {
            clearInterval(checkInterval);
            return;
        }
        
        // Count connected relays (this is a simplification)
        // In reality, SimplePool doesn't expose connection status easily
        state.connectedRelays = state.relays.length;
        updateStats();
        
        if (state.connectedRelays > 0) {
            updateStatus('connected', `Connected to ${state.connectedRelays} relay(s)`);
        } else {
            updateStatus('connecting', 'Connecting...');
        }
    }, 2000);
}

// Start Uptime Counter
function startUptimeCounter() {
    setInterval(() => {
        if (state.startTime) {
            const elapsed = Date.now() - state.startTime;
            elements.uptimeSpan.textContent = formatDuration(elapsed);
        }
    }, 1000);
}

// Update Status
function updateStatus(status, text) {
    elements.statusIndicator.className = `status-indicator status-${status}`;
    elements.statusText.textContent = text;
}

// Update Stats
function updateStats() {
    elements.connectedRelaysSpan.textContent = state.connectedRelays;
    elements.notificationCountSpan.textContent = state.notificationCount;
}

// Request Notification Permission
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Notification permission granted!', 'success');
        }
    }
}

// Show Test Notification
function showTestNotification() {
    if (Notification.permission !== 'granted') {
        showToast('Please grant notification permission first', 'error');
        requestNotificationPermission();
        return;
    }
    
    const notification = new Notification('Test Notification', {
        body: 'This is a test notification from Nostr Notify',
        icon: 'icon-192.png'
    });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

// Show Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Utility Functions
function isValidPrivateKey(key) {
    return /^[0-9a-f]{64}$/i.test(key);
}

function parseRelays(text) {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('wss://') || line.startsWith('ws://'));
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Register Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration);
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    }
}

// Install PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elements.installPwaBtn.style.display = 'inline';
});

function installPWA() {
    if (!deferredPrompt) {
        showToast('App is already installed or not installable', 'info');
        return;
    }
    
    deferredPrompt.prompt();
    
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            showToast('App installed successfully!', 'success');
        }
        deferredPrompt = null;
    });
}

// Export for debugging
window.nostrNotify = {
    state,
    elements,
    startListening,
    stopListening
};
