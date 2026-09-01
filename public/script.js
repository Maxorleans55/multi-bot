let currentSession = null;
let pollInterval = null;
let musicPlaying = false;
let sessions = new Map();

// Music - start muted, unmute on first user interaction
const bgm = document.getElementById('bgm');
if (bgm) {
    bgm.volume = 0.3;
    bgm.play().catch(() => {});
    const unmute = () => { bgm.muted = false; document.removeEventListener('click', unmute); };
    document.addEventListener('click', unmute);
}

// Toggle music
function toggleMusic() {
    const btn = document.querySelector('.music-btn');
    if (musicPlaying) {
        bgm.pause();
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="fas fa-volume-xmark"></i>';
    } else {
        bgm.muted = false;
        bgm.volume = 0.3;
        bgm.play().catch(() => {});
        btn.classList.add('playing');
        btn.innerHTML = '<i class="fas fa-volume-high"></i>';
    }
    musicPlaying = !musicPlaying;
}

// Tabs
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'sessions') loadSessions();
}

// Status
async function loadStatus() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('botStatus').textContent = 'Online';
        document.getElementById('pulseDot').classList.add('green');
        document.getElementById('statSessions').textContent = data.activeSessions || 0;
        document.getElementById('statUsers').textContent = data.totalUsers || 0;
        document.getElementById('statMessages').textContent = data.totalMessages || 0;
        const mins = Math.floor(data.uptime / 60);
        const hrs = Math.floor(mins / 60);
        document.getElementById('statUptime').textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    } catch {
        document.getElementById('botStatus').textContent = 'Offline';
        document.getElementById('pulseDot').classList.remove('green');
    }
}

// Sessions - load all sessions
async function loadSessions() {
    const container = document.getElementById('sessionsList');
    try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        sessions = new Map();
        
        if (!data.sessions || data.sessions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-mobile-screen"></i>
                    <p>No sessions yet</p>
                    <p>Create a new session to get started</p>
                </div>`;
            return;
        }
        
        container.innerHTML = data.sessions.map(s => {
            sessions.set(s.sessionId, { connected: s.isAlive, phoneNumber: s.phoneNumber });
            const isAlive = s.isAlive;
            const initial = s.sessionId.charAt(0).toUpperCase();
            return `
                <div class="session-card ${isAlive ? 'connected' : 'disconnected'}">
                    <div class="session-info">
                        <div class="session-avatar">${initial}</div>
                        <div>
                            <div class="session-name">${s.sessionId}</div>
                            <div class="session-status ${isAlive ? 'connected' : 'disconnected'}">
                                ${isAlive ? '● Connected' : '○ ' + (s.status || 'Disconnected')}
                            </div>
                        </div>
                    </div>
                    <div class="session-actions">
                        ${!isAlive ? `<button class="btn-icon" onclick="reconnectSession('${s.sessionId}')" title="Reconnect"><i class="fas fa-rotate-right"></i></button>` : ''}
                        <button class="btn-icon danger" onclick="deleteSession('${s.sessionId}')" title="Disconnect"><i class="fas fa-xmark"></i></button>
                    </div>
                </div>`;
        }).join('');
    } catch {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load sessions</p>
                <p>Please try again</p>
            </div>`;
    }
}

// Create session
async function createSession() {
    const name = document.getElementById('sessionName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    if (!name) return alert('Please enter a session name');
    if (!phone) return alert('Please enter your phone number');
    
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    btnText.textContent = 'Creating...';
    btnLoader.classList.remove('hidden');
    
    try {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: name })
        });
        const data = await res.json();
        if (data.success) {
            currentSession = name;
            document.getElementById('createCard').classList.add('hidden');
            document.getElementById('step1').classList.add('completed');
            document.getElementById('step2').classList.add('active');
            await requestPairingCode(name, phone);
        } else {
            alert(data.error || 'Failed to create session');
        }
    } catch {
        alert('Network error');
    }
    
    btnText.textContent = 'Create & Link';
    btnLoader.classList.add('hidden');
}

// Request pairing code
async function requestPairingCode(sessionId, phoneNumber) {
    try {
        const res = await fetch(`/api/pairing/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success && data.code) {
            const rawCode = data.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const formattedCode = rawCode.length >= 8
                ? rawCode.slice(0, 4) + '-' + rawCode.slice(4, 8)
                : rawCode;
            document.getElementById('pairingCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'Enter Code';
            document.getElementById('pairingCode').textContent = formattedCode;
            document.getElementById('pairingStatusText').textContent = 'Enter this code on your phone within 2 minutes';
            currentPairingCode = formattedCode;
            waitForPairing(sessionId);
        } else {
            console.log('Pairing code failed, falling back to QR');
            document.getElementById('qrCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'Scan QR';
            waitForQR(sessionId);
        }
    } catch {
        document.getElementById('qrCard').classList.remove('hidden');
        document.getElementById('step2Label').textContent = 'Scan QR';
        waitForQR(sessionId);
    }
}

// Copy pairing code
let currentPairingCode = '';
function copyPairingCode() {
    if (!currentPairingCode) return;
    navigator.clipboard.writeText(currentPairingCode).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.innerHTML = '<i class="fas fa-check"></i> COPIED';
        btn.style.borderColor = '#25D366';
        btn.style.color = '#25D366';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> COPY CODE';
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    }).catch(() => {});
}

// Wait for pairing code to be linked
async function waitForPairing(sessionId) {
    let attempts = 0;
    const maxAttempts = 60;
    const check = async () => {
        try {
            const res = await fetch(`/api/qr/${sessionId}`);
            const data = await res.json();
            if (data.connected) {
                document.getElementById('pairingStatusText').textContent = 'Connected!';
                document.getElementById('pairingStatusText').style.color = '#2ec4b6';
                showSuccess();
                return;
            }
        } catch {}
        attempts++;
        if (attempts >= maxAttempts) {
            document.getElementById('pairingStatusText').textContent = 'Timed out. Try again.';
            document.getElementById('pairingStatusText').style.color = '#ef4444';
            return;
        }
        setTimeout(check, 2000);
    };
    check();
}

// Wait for QR scan
async function waitForQR(sessionId) {
    let attempts = 0;
    let showedQR = false;
    const check = async () => {
        try {
            const res = await fetch(`/api/qr/${sessionId}`);
            const data = await res.json();
            if (data.connected && showedQR) {
                showSuccess();
                return;
            }
            if (data.qr && !showedQR) {
                showedQR = true;
                document.getElementById('qrContainer').innerHTML = `<img src="${data.qr}" alt="QR Code">`;
                document.getElementById('qrStatusText').textContent = 'Scan with your phone camera';
            }
            if (attempts > 20 && !showedQR) {
                showSuccess();
                return;
            }
        } catch {}
        attempts++;
        setTimeout(check, 2000);
    };
    check();
}

// Cancel session creation
function cancelSession() {
    if (pollInterval) clearInterval(pollInterval);
    currentSession = null;
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step2Label').textContent = 'Link Device';
}

// Success state
function showSuccess() {
    if (pollInterval) clearInterval(pollInterval);
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('successCard').classList.remove('hidden');
    document.getElementById('step2').classList.add('completed');
    document.getElementById('step3').classList.add('active');
}

// Reset session UI
function resetSession() {
    currentSession = null;
    currentPairingCode = '';
    document.getElementById('successCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('sessionName').value = '';
    document.getElementById('phoneNumber').value = '';
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step2Label').textContent = 'Link Device';
    document.getElementById('step3').classList.remove('active');
    switchTab('sessions');
}

// Reconnect session
async function reconnectSession(id) {
    currentSession = id;
    document.getElementById('createCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.remove('hidden');
    document.getElementById('step1').classList.add('completed');
    document.getElementById('step2').classList.add('active');
    document.getElementById('step2Label').textContent = 'Scan QR';
    if (pollInterval) clearInterval(pollInterval);
    waitForQR(id);
}

// Delete session
async function deleteSession(id) {
    if (!confirm(`Disconnect session "${id}"?`)) return;
    try {
        await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
        sessions.delete(id);
        loadSessions();
    } catch {}
}

// Enter key on inputs
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sessionName')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') document.getElementById('phoneNumber')?.focus();
    });
    document.getElementById('phoneNumber')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') createSession();
    });
});

// Init
loadStatus();
loadSessions();
setInterval(loadStatus, 10000);
