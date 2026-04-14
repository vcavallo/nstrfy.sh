// nstrfy web — Write + Listen modes
// Write: posts form to /api/send (demo signer)
// Listen: subscribes to kind 7741 firehose on configured relays, filters by topic client-side

import { SimplePool } from 'https://esm.sh/nostr-tools@2.7.0';

// ========================================================================
// shared helpers
// ========================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function truncate(s, n = 16) {
    if (!s) return '';
    return s.length <= n ? s : `${s.slice(0, n / 2)}…${s.slice(-n / 2)}`;
}

function formatRelativeTime(unixSeconds) {
    const diff = Date.now() / 1000 - unixSeconds;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(unixSeconds * 1000).toLocaleString();
}

// ========================================================================
// tab switcher
// ========================================================================

document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach((b) => {
            const active = b.dataset.tab === target;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('.tab-panel').forEach((p) => {
            p.classList.toggle('active', p.id === `tab-${target}`);
        });
    });
});

// ========================================================================
// WRITE MODE
// ========================================================================

const sendForm = document.getElementById('send-form');
const sendBtn = document.getElementById('send-btn');
const expirationInput = document.getElementById('expiration');
const expirationLabel = document.getElementById('expiration-label');
const resultCard = document.getElementById('result-card');
const resultEventId = document.getElementById('result-eventid');
const resultNjump = document.getElementById('result-njump');
const resultRelays = document.getElementById('result-relays');
const resultSender = document.getElementById('result-sender');

function formatDuration(seconds) {
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) {
        const h = seconds / 3600;
        return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
    }
    return '24h';
}

expirationInput.addEventListener('input', () => {
    expirationLabel.textContent = formatDuration(Number(expirationInput.value));
});

sendForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    const body = {
        title: document.getElementById('title').value.trim(),
        message: document.getElementById('message').value.trim(),
        topic: document.getElementById('topic').value.trim(),
        priority: document.getElementById('priority').value,
        expiration: Number(expirationInput.value),
    };
    const to = document.getElementById('to').value.trim();
    if (to) body.to = to;

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || `Error ${res.status}`, 'error');
            return;
        }

        resultEventId.textContent = data.eventId;
        resultNjump.href = `https://njump.me/${data.eventId}`;
        resultSender.textContent = data.senderNpub;

        const accepted = (data.publishedTo || [])
            .map((r) => `<li>✅ <code>${escapeHtml(r)}</code></li>`)
            .join('');
        const rejected = (data.rejectedBy || [])
            .map((r) => `<li>❌ <code>${escapeHtml(r.relay)}</code> <span class="help-text">— ${escapeHtml(r.error || 'unknown')}</span></li>`)
            .join('');
        resultRelays.innerHTML = (accepted + rejected) || '<li class="help-text">No relays responded.</li>';
        resultCard.classList.remove('hidden');
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showToast(`Published to ${data.publishedTo?.length || 0} relay(s)`, 'success');
    } catch (err) {
        showToast(`Network error: ${err.message}`, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '🚀 Send';
    }
});

// ========================================================================
// LISTEN MODE
// ========================================================================

const LISTEN_STORAGE_KEY = 'nstrfy:listen';
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];

const listenState = {
    pool: null,
    sub: null,
    isListening: false,
    // subscriptions: [{ topic: "alerts", whitelistEnabled: false, allowedSenders: [] }, ...]
    subscriptions: [],
    relays: [...DEFAULT_RELAYS],
    seenIds: new Set(),
    feed: [], // rendered notifications (capped)
};

const topicsList = document.getElementById('topics-list');
const topicAddInput = document.getElementById('topic-add-input');
const topicAddBtn = document.getElementById('topic-add-btn');
const listenRelays = document.getElementById('listen-relays');
const listenStartBtn = document.getElementById('listen-start-btn');
const listenStopBtn = document.getElementById('listen-stop-btn');
const clearFeedBtn = document.getElementById('clear-feed-btn');
const listenIndicator = document.getElementById('listen-indicator');
const listenStatusText = document.getElementById('listen-status-text');
const feed = document.getElementById('feed');
const feedCount = document.getElementById('feed-count');

// ---- persistence ---------------------------------------------------------

function loadListenPrefs() {
    try {
        const raw = localStorage.getItem(LISTEN_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.subscriptions)) {
            // Drop any legacy empty-topic (firehose) entries
            listenState.subscriptions = parsed.subscriptions.filter((s) => s && typeof s.topic === 'string' && s.topic !== '');
        }
        if (Array.isArray(parsed.relays) && parsed.relays.length) listenState.relays = parsed.relays;
    } catch {
        // ignore
    }
}

function saveListenPrefs() {
    try {
        localStorage.setItem(LISTEN_STORAGE_KEY, JSON.stringify({
            subscriptions: listenState.subscriptions,
            relays: listenState.relays,
        }));
    } catch {
        // quota; non-fatal
    }
}

// ---- topic UI ------------------------------------------------------------

function renderTopics() {
    topicsList.innerHTML = listenState.subscriptions
        .map((s, i) => `<li class="topic-chip"><code>${escapeHtml(s.topic)}</code><button type="button" data-idx="${i}" aria-label="remove">×</button></li>`)
        .join('');
}

topicsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    listenState.subscriptions.splice(idx, 1);
    saveListenPrefs();
    renderTopics();
    if (listenState.isListening) restartSubscription();
});

function addTopic(name) {
    const normalized = name.trim();
    if (!normalized) {
        showToast('Topic is required', 'error');
        return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
        showToast('Topic must be alphanumeric (plus . _ -)', 'error');
        return;
    }
    if (listenState.subscriptions.some((s) => s.topic === normalized)) {
        showToast(`Already subscribed to "${normalized}"`, 'info');
        return;
    }
    listenState.subscriptions.push({ topic: normalized, whitelistEnabled: false, allowedSenders: [] });
    saveListenPrefs();
    renderTopics();
    if (listenState.isListening) restartSubscription();
}

topicAddBtn.addEventListener('click', () => {
    addTopic(topicAddInput.value);
    topicAddInput.value = '';
});

topicAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        topicAddBtn.click();
    }
});

// ---- feed rendering ------------------------------------------------------

function renderFeed() {
    feedCount.textContent = `${listenState.feed.length} notification${listenState.feed.length === 1 ? '' : 's'}`;
    if (listenState.feed.length === 0) {
        feed.innerHTML = `<div class="empty-state"><p>No notifications yet</p><p class="help-text">Waiting for matching events…</p></div>`;
        return;
    }
    feed.innerHTML = listenState.feed
        .map((n) => `
            <div class="notification-item priority-${escapeHtml(n.priority || 'default')}">
                <div class="notification-header">
                    <div class="notification-title">${escapeHtml(n.title || 'Notification')}</div>
                    <div class="notification-time">${escapeHtml(formatRelativeTime(n.timestamp))}</div>
                </div>
                <div class="notification-message">${escapeHtml(n.message)}</div>
                <div class="notification-meta">
                    ${n.priority ? `<span class="notification-badge">${escapeHtml(n.priority)}</span>` : ''}
                    ${n.topic ? `<span>📂 ${escapeHtml(n.topic)}</span>` : ''}
                    <span class="notification-sender">by ${escapeHtml(truncate(n.senderNpub || n.senderPubkey, 20))}</span>
                </div>
            </div>
        `)
        .join('');
}

function addToFeed(notification) {
    listenState.feed.unshift(notification);
    if (listenState.feed.length > 200) listenState.feed.length = 200;
    renderFeed();
}

clearFeedBtn.addEventListener('click', () => {
    listenState.feed = [];
    listenState.seenIds.clear();
    renderFeed();
});

// ---- event handling ------------------------------------------------------

function findMatchingSubscription(topic) {
    if (!topic) return null;
    return listenState.subscriptions.find((s) => s.topic === topic) || null;
}

function hasPTag(event) {
    return event.tags.some((t) => t.length >= 2 && t[0] === 'p');
}

function getExpirationTag(event) {
    const t = event.tags.find((t) => t.length >= 2 && t[0] === 'expiration');
    return t ? Number(t[1]) : null;
}

function handleEvent(event) {
    if (listenState.seenIds.has(event.id)) return;
    listenState.seenIds.add(event.id);
    if (listenState.seenIds.size > 2000) {
        // cheap GC
        listenState.seenIds = new Set(Array.from(listenState.seenIds).slice(-1000));
    }

    // Phase 2: public events only. Encrypted (has #p tag) requires NIP-07 (Phase 3).
    if (hasPTag(event)) return;

    let payload;
    try {
        payload = JSON.parse(event.content);
    } catch {
        return;
    }

    const expiresAt = getExpirationTag(event);
    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) return;

    const topic = payload.topic || '';
    const sub = findMatchingSubscription(topic);
    if (!sub) return;

    // Phase 3 hook: whitelist check (data structure exists; UI toggle comes later)
    if (sub.whitelistEnabled && !sub.allowedSenders.includes(event.pubkey)) return;

    const notification = {
        id: event.id,
        topic,
        title: payload.title || '',
        message: payload.message || '',
        priority: payload.priority || 'default',
        timestamp: payload.timestamp || event.created_at,
        senderPubkey: event.pubkey,
        click: payload.click || null,
        icon: payload.icon || null,
    };

    addToFeed(notification);
    fireBrowserNotification(notification);
}

// ---- browser notifications ----------------------------------------------

async function ensureNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
}

function fireBrowserNotification(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const notif = new Notification(n.title || 'nstrfy', {
            body: n.message,
            icon: n.icon || 'icon.svg',
            tag: n.id,
            silent: n.priority === 'min' || n.priority === 'low',
            requireInteraction: n.priority === 'urgent',
            data: { click: n.click },
        });
        notif.onclick = () => {
            window.focus();
            if (n.click) window.open(n.click, '_blank', 'noopener');
            notif.close();
        };
    } catch (err) {
        console.warn('Notification failed:', err);
    }
}

// ---- subscription management --------------------------------------------

function updateStatus(state) {
    // state: 'connected' | 'connecting' | 'disconnected'
    listenIndicator.className = `status-indicator status-${state}`;
    if (state === 'connected') listenStatusText.textContent = `Listening on ${listenState.relays.length} relay(s)`;
    else if (state === 'connecting') listenStatusText.textContent = 'Connecting…';
    else listenStatusText.textContent = 'Not listening';
}

function parseRelayTextarea() {
    return listenRelays.value
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^wss:\/\/[A-Za-z0-9.-]+/.test(l));
}

async function startListening() {
    if (listenState.isListening) return;

    if (listenState.subscriptions.length === 0) {
        showToast('Add at least one topic first', 'error');
        return;
    }

    const relays = parseRelayTextarea();
    if (relays.length === 0) {
        showToast('Add at least one valid wss:// relay', 'error');
        return;
    }
    listenState.relays = relays;
    saveListenPrefs();

    await ensureNotificationPermission();

    updateStatus('connecting');
    listenState.pool = new SimplePool();

    const filter = { kinds: [7741], since: Math.floor(Date.now() / 1000) };
    try {
        listenState.sub = listenState.pool.subscribeMany(
            listenState.relays,
            [filter],
            {
                onevent: handleEvent,
                oneose: () => updateStatus('connected'),
                onclose: (reasons) => {
                    console.warn('Subscription closed:', reasons);
                },
            },
        );
    } catch (err) {
        showToast(`Failed to connect: ${err.message}`, 'error');
        listenState.pool = null;
        updateStatus('disconnected');
        return;
    }

    listenState.isListening = true;
    listenStartBtn.classList.add('hidden');
    listenStopBtn.classList.remove('hidden');
    updateStatus('connected');
    showToast('Listening for notifications', 'success');
}

function stopListening() {
    if (!listenState.isListening) return;
    try { listenState.sub?.close(); } catch {}
    try { listenState.pool?.close(listenState.relays); } catch {}
    listenState.sub = null;
    listenState.pool = null;
    listenState.isListening = false;
    listenStartBtn.classList.remove('hidden');
    listenStopBtn.classList.add('hidden');
    updateStatus('disconnected');
}

function restartSubscription() {
    stopListening();
    startListening();
}

listenStartBtn.addEventListener('click', startListening);
listenStopBtn.addEventListener('click', stopListening);

listenRelays.addEventListener('change', () => {
    const relays = parseRelayTextarea();
    if (relays.length) listenState.relays = relays;
    saveListenPrefs();
    if (listenState.isListening) restartSubscription();
});

// ---- init ----------------------------------------------------------------

loadListenPrefs();
if (listenState.relays.length) listenRelays.value = listenState.relays.join('\n');
renderTopics();
renderFeed();
updateStatus('disconnected');
