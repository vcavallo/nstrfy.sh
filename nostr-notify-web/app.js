// nstrfy web — Write mode (Phase 1)
// POSTs the form to /api/send, which signs + publishes a kind 7741 event.

const form = document.getElementById('send-form');
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function buildBody() {
    const body = {
        title: document.getElementById('title').value.trim(),
        message: document.getElementById('message').value.trim(),
        priority: document.getElementById('priority').value,
        expiration: Number(expirationInput.value),
    };
    const to = document.getElementById('to').value.trim();
    const topic = document.getElementById('topic').value.trim();
    if (to) body.to = to;
    if (topic) body.topic = topic;
    return body;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody()),
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
