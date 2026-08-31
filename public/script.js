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

// Create session
async function createSession() {
    const name = document.getElementById('sessionName').value.trim();
    if (!name) return;
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
            // Session created - show QR code
            currentSession = name;
            document.getElementById('createCard').classList.add('hidden');
            document.getElementById('qrCard').classList.remove('hidden');
            document.getElementById('step1').classList.add('completed');
            document.getElementById('step2').classList.add('active');
            pollQR();
        } else {
            alert(data.error || 'Failed to create session');
        }
    } catch {
        alert('Network error');
    }
    btn.textContent = 'Create Session';
    loader.style.display = 'none';
}

// Poll QR code for a specific session
function pollQR() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        if (!currentSession) return;
        try {
            const res = await fetch(`/api/qr/${currentSession}`);
            const data = await res.json();
            if (data.connected) {
                showSuccess();
                return;
            }
            if (data.qr) {
                document.getElementById('qrContainer').innerHTML = `<img src="${data.qr}" alt="QR Code">`;
                document.getElementById('qrStatus').innerHTML = '<span class="status-dot"></span><span>Waiting for scan...</span>';
            }
        } catch {}
    }, 2000);
}

// Cancel session creation
function cancelSession() {
    if (pollInterval) clearInterval(pollInterval);
    currentSession = null;
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('active');
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
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('sessionName').value = '';
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.remove('active');
    switchTab('sessions');
}

// Reconnect session
async function reconnectSession(id) {
    currentSession = id;
    document.getElementById('createCard').classList.add('hidden');
    document.getElementById('qrCard').classList.remove('hidden');
    document.getElementById('step1').classList.add('completed');
    document.getElementById('step2').classList.add('active');
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