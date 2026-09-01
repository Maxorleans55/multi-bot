let currentSession = null;
let pollInterval = null;
let musicPlaying = false;
let sessions = new Map(); // Map of sessionId -> { connected, qr, phoneNumber }

// Letter-by-letter animation
const titleLight = 'LIGHT';
const titleYagami = 'YAGAMI';

function animateTitle() {
    const el1 = document.getElementById('textLight');
    const el2 = document.getElementById('textYagami');
    el1.innerHTML = '';
    el2.innerHTML = '';

    let i = 0;
    const interval = setInterval(() => {
        if (i < titleLight.length) {
            el1.innerHTML += `<span class="char" style="animation-delay:${i * 0.15}s">${titleLight[i]}</span>`;
            i++;
        } else {
            let j = 0;
            const interval2 = setInterval(() => {
                if (j < titleYagami.length) {
                    el2.innerHTML += `<span class="char" style="animation-delay:${j * 0.15}s">${titleYagami[j]}</span>`;
                    j++;
                } else {
                    clearInterval(interval2);
                    setTimeout(animateTitle, 4000);
                }
            }, 150);
            clearInterval(interval);
        }
    }, 150);
}

// Music
function toggleMusic() {
    const bgm = document.getElementById('bgm');
    const label = document.getElementById('musicLabel');
    const icon = document.getElementById('musicIcon');
    if (musicPlaying) {
        bgm.pause();
        label.textContent = 'Play Music';
        icon.style.animation = 'none';
    } else {
        bgm.volume = 0.3;
        bgm.play().catch(() => {});
        label.textContent = 'Pause Music';
        icon.style.animation = 'spin 2s linear infinite';
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
        document.getElementById('pulseDot').className = 'pulse-dot green';
        document.getElementById('sessionCount').textContent = data.activeSessions || 0;
        document.getElementById('userCount').textContent = data.totalUsers || 0;
        document.getElementById('msgCount').textContent = data.totalMessages || 0;
        const mins = Math.floor(data.uptime / 60);
        const hrs = Math.floor(mins / 60);
        document.getElementById('uptime').textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
        document.getElementById('memUsage').textContent = `${Math.round(performance?.memory?.usedJSHeapSize / 1024 / 1024) || 'N/A'}MB`;
    } catch {
        document.getElementById('botStatus').textContent = 'Offline';
        document.getElementById('pulseDot').className = 'pulse-dot';
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
            container.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px;color:#555">
                <p style="font-size:14px">No sessions yet</p>
                <p style="font-size:12px;color:#444;margin-top:8px">Click "New Session" to connect a device</p>
            </div>`;
            return;
        }
        
        container.innerHTML = data.sessions.map(s => {
            sessions.set(s.sessionId, { connected: s.isAlive, phoneNumber: s.phoneNumber });
            const isAlive = s.isAlive;
            return `
                <div class="session-card ${isAlive ? 'connected' : 'disconnected'}">
                    <div class="session-info">
                        <div class="session-avatar">${s.sessionId.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="session-name">${s.sessionId}</div>
                            <div class="session-status ${isAlive ? 'connected' : 'disconnected'}">
                                ${isAlive ? '● Connected' : '○ ' + (s.status || 'Disconnected')}
                            </div>
                        </div>
                    </div>
                    <div class="session-actions">
                        ${!isAlive ? `<button class="btn-icon" onclick="reconnectSession('${s.sessionId}')" title="Reconnect">↻</button>` : ''}
                        <button class="btn-icon danger" onclick="deleteSession('${s.sessionId}')" title="Disconnect">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252">Failed to load sessions</div>';
    }
}

// Create session - uses phone pairing
async function createSession() {
    const name = document.getElementById('sessionName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    if (!name) return alert('Please enter a session name');
    if (!phone) return alert('Please enter your phone number');
    const btn = document.getElementById('btnText');
    const loader = document.getElementById('btnLoader');
    btn.textContent = 'Creating...';
    loader.style.display = 'block';
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
            // Request pairing code
            await requestPairingCode(name, phone);
        } else {
            alert(data.error || 'Failed to create session');
        }
    } catch {
        alert('Network error');
    }
    btn.textContent = 'Create & Link';
    loader.style.display = 'none';
}

// Request pairing code from server
async function requestPairingCode(sessionId, phoneNumber) {
    try {
        const res = await fetch(`/api/pairing/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success && data.code) {
            // Show pairing code card
            document.getElementById('pairingCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'Enter Code';
            document.getElementById('pairingCode').textContent = data.code;
            document.getElementById('pairingStatusText').textContent = 'Enter this code on your phone...';
            waitForPairing(sessionId);
        } else {
            // Fallback to QR code
            console.log('Pairing code failed, falling back to QR');
            document.getElementById('qrCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'Scan QR';
            waitForQR(sessionId);
        }
    } catch {
        // Fallback to QR code
        document.getElementById('qrCard').classList.remove('hidden');
        document.getElementById('step2Label').textContent = 'Scan QR';
        waitForQR(sessionId);
    }
}

// Wait for pairing code to be linked
async function waitForPairing(sessionId) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 60; // 2 minutes
        const check = async () => {
            try {
                const res = await fetch(`/api/qr/${sessionId}`);
                const data = await res.json();
                if (data.connected) {
                    document.getElementById('pairingStatusText').textContent = 'Connected!';
                    showSuccess();
                    return;
                }
            } catch {}
            attempts++;
            if (attempts >= maxAttempts) {
                document.getElementById('pairingStatusText').textContent = 'Timed out. Try again.';
                return;
            }
            setTimeout(check, 2000);
        };
        check();
    });
}

// Wait for session QR to be ready
// Always shows QR code first, only considers connected after user scan or timeout
async function waitForQR(sessionId) {
    return new Promise((resolve) => {
        let attempts = 0;
        let showedQR = false;
        const check = async () => {
            try {
                const res = await fetch(`/api/qr/${sessionId}`);
                const data = await res.json();
                if (data.connected && showedQR) {
                    // User already saw QR and it's connected - show success
                    showSuccess();
                    return;
                }
                if (data.qr && !showedQR) {
                    // Show QR code first time
                    showedQR = true;
                    document.getElementById('qrContainer').innerHTML = `<img src="${data.qr}" alt="QR Code">`;
                    document.getElementById('qrStatus').innerHTML = '<span class="status-dot"></span><span>Waiting for scan...</span>';
                }
                // After 40 seconds of waiting without scan, consider connected
                if (attempts > 20 && !showedQR) {
                    showSuccess();
                    return;
                }
            } catch {}
            attempts++;
            setTimeout(check, 2000);
        };
        check();
    });
}

// Poll QR code for a specific session
async function pollQR() {
    if (pollInterval) clearInterval(pollInterval);
    const qrCode = await waitForQR(currentSession);
    // If QR was already shown and session connected, pollQR does nothing
    // (showSuccess was already called inside waitForQR)
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
    document.getElementById('successCard').classList.remove('hidden');
    document.getElementById('step2').classList.add('completed');
    document.getElementById('step3').classList.add('active');
}

// Reset session UI
function resetSession() {
    currentSession = null;
    sessions.delete(currentSession);
    document.getElementById('successCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
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
    pollQR();
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

// Enter key on input
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sessionName')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') createSession();
    });
});

// Init
animateTitle();
loadStatus();
loadSessions();
setInterval(loadStatus, 10000);