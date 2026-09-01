let currentSession = null;
let pollInterval = null;
let musicPlaying = false;
let sessions = new Map();
let prevStats = { sessions: 0, users: 0, messages: 0 };

// ── Particles ──────────────────────────────────────────
function createParticles() {
    const container = document.createElement('div');
    container.className = 'particles';
    document.body.appendChild(container);
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (8 + Math.random() * 12) + 's';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.width = p.style.height = (1 + Math.random() * 3) + 'px';
        p.style.opacity = 0.2 + Math.random() * 0.4;
        container.appendChild(p);
    }
}

// ── Animated Title ─────────────────────────────────────
function animateTitle() {
    const words = [
        { el: document.getElementById('wordLight'), text: 'LIGHT', startDelay: 0 },
        { el: document.getElementById('wordYagami'), text: 'YAGAMI', startDelay: 500 }
    ];
    words.forEach(({ el, text, startDelay }) => {
        if (!el) return;
        el.innerHTML = '';
        text.split('').forEach((ch, i) => {
            const span = document.createElement('span');
            span.className = ch === ' ' ? 'letter space' : 'letter';
            span.textContent = ch;
            span.style.animationDelay = `${startDelay + i * 0.08}s`;
            el.appendChild(span);
        });
    });
    setTimeout(() => {
        document.querySelectorAll('.letter:not(.space)').forEach((el, i) => {
            el.style.animationDelay = `${i * 0.15}s`;
            el.classList.add('bounce');
        });
    }, 2000);
}

function startTitleLoop() {
    animateTitle();
    setInterval(animateTitle, 6000);
}

// ── Counter Animation ──────────────────────────────────
function animateCounter(el, from, to, duration = 600) {
    const start = performance.now();
    const diff = to - from;
    function step(time) {
        const progress = Math.min((time - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(from + diff * ease);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── Ripple Effect ──────────────────────────────────────
function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Music ──────────────────────────────────────────────
const bgm = document.getElementById('bgm');
if (bgm) {
    bgm.volume = 0.3;
    bgm.play().catch(() => {});
    const unmute = () => { bgm.muted = false; document.removeEventListener('click', unmute); };
    document.addEventListener('click', unmute);
}

function toggleMusic() {
    const btn = document.getElementById('musicBtn');
    if (musicPlaying) {
        bgm.pause();
        btn.classList.remove('on');
        btn.innerHTML = '<i class="fas fa-volume-xmark"></i>';
    } else {
        bgm.muted = false;
        bgm.volume = 0.3;
        bgm.play().catch(() => {});
        btn.classList.add('on');
        btn.innerHTML = '<i class="fas fa-volume-high"></i>';
    }
    musicPlaying = !musicPlaying;
}

// ── Tabs ───────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'sessions') loadSessions();
}

// ── Status ─────────────────────────────────────────────
async function loadStatus() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('botStatus').textContent = 'Online';
        document.getElementById('pulseDot').classList.add('green');

        const s = data.activeSessions || 0;
        const u = data.totalUsers || 0;
        const m = data.totalMessages || 0;

        const sEl = document.getElementById('statSessions');
        const uEl = document.getElementById('statUsers');
        const mEl = document.getElementById('statMessages');

        if (s !== prevStats.sessions) { animateCounter(sEl, prevStats.sessions, s); prevStats.sessions = s; }
        if (u !== prevStats.users) { animateCounter(uEl, prevStats.users, u); prevStats.users = u; }
        if (m !== prevStats.messages) { animateCounter(mEl, prevStats.messages, m); prevStats.messages = m; }

        const mins = Math.floor(data.uptime / 60);
        const hrs = Math.floor(mins / 60);
        document.getElementById('statUptime').textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    } catch {
        document.getElementById('botStatus').textContent = 'Offline';
        document.getElementById('pulseDot').classList.remove('green');
    }
}

// ── Sessions ───────────────────────────────────────────
async function loadSessions() {
    const el = document.getElementById('sessionsList');
    try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        sessions = new Map();

        if (!data.sessions || data.sessions.length === 0) {
            el.innerHTML = `<div class="empty"><i class="fas fa-mobile-screen" style="font-size:32px;opacity:0.2"></i><p>No sessions yet</p><p style="font-size:11px;color:#444">Create a new session to get started</p></div>`;
            return;
        }

        el.innerHTML = data.sessions.map((s, i) => {
            sessions.set(s.sessionId, { connected: s.isAlive, phoneNumber: s.phoneNumber });
            const alive = s.isAlive;
            return `
                <div class="session-card ${alive ? 'connected' : 'disconnected'}" style="animation-delay:${i * 0.05}s">
                    <div class="session-left">
                        <div class="session-avatar">${s.sessionId.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="session-name">${s.sessionId}</div>
                            <div class="session-status ${alive ? 'connected' : 'disconnected'}">
                                ${alive ? '● Connected' : '○ ' + (s.status || 'Disconnected')}
                            </div>
                        </div>
                    </div>
                    <div class="session-actions">
                        ${!alive ? `<button class="icon-btn" onclick="reconnectSession('${s.sessionId}')" title="Reconnect"><i class="fas fa-rotate-right"></i></button>` : ''}
                        <button class="icon-btn danger" onclick="deleteSession('${s.sessionId}')" title="Delete"><i class="fas fa-xmark"></i></button>
                    </div>
                </div>`;
        }).join('');
    } catch {
        el.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle" style="font-size:32px;opacity:0.2"></i><p>Failed to load sessions</p></div>`;
    }
}

// ── Create Session ─────────────────────────────────────
async function createSession() {
    const name = document.getElementById('sessionName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    if (!name) return alert('Enter a session name');
    if (!phone) return alert('Enter your phone number');

    const txt = document.getElementById('btnText');
    const ld = document.getElementById('btnLoader');
    txt.textContent = 'Creating...';
    ld.classList.remove('hidden');

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
            document.getElementById('step1').classList.add('done');
            document.getElementById('step2').classList.add('active');
            await requestPairingCode(name, phone);
        } else {
            alert(data.error || 'Failed to create session');
        }
    } catch {
        alert('Network error');
    }

    txt.textContent = 'Create & Link';
    ld.classList.add('hidden');
}

// ── Pairing Code ───────────────────────────────────────
async function requestPairingCode(sessionId, phoneNumber) {
    try {
        const res = await fetch(`/api/pairing/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success && data.code) {
            const raw = data.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const code = raw.length >= 8 ? raw.slice(0, 4) + '-' + raw.slice(4, 8) : raw;
            document.getElementById('pairingCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'Code';
            document.getElementById('pairingCode').textContent = code;
            document.getElementById('pairingStatusText').textContent = 'Enter this code on your phone within 2 minutes';
            currentPairingCode = code;
            waitForPairing(sessionId);
        } else {
            document.getElementById('qrCard').classList.remove('hidden');
            document.getElementById('step2Label').textContent = 'QR';
            waitForQR(sessionId);
        }
    } catch {
        document.getElementById('qrCard').classList.remove('hidden');
        document.getElementById('step2Label').textContent = 'QR';
        waitForQR(sessionId);
    }
}

// ── Copy Code ──────────────────────────────────────────
let currentPairingCode = '';
function copyPairingCode() {
    if (!currentPairingCode) return;
    navigator.clipboard.writeText(currentPairingCode).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.innerHTML = '<i class="fas fa-check"></i> COPIED';
        btn.style.borderColor = '#2ec4b6';
        btn.style.color = '#2ec4b6';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> COPY CODE';
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    }).catch(() => {});
}

// ── Wait for Pairing ───────────────────────────────────
async function waitForPairing(sessionId) {
    let attempts = 0;
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
        if (attempts >= 60) {
            document.getElementById('pairingStatusText').textContent = 'Timed out. Try again.';
            document.getElementById('pairingStatusText').style.color = '#ef4444';
            return;
        }
        setTimeout(check, 2000);
    };
    check();
}

// ── Wait for QR ────────────────────────────────────────
async function waitForQR(sessionId) {
    let attempts = 0;
    let showedQR = false;
    const check = async () => {
        try {
            const res = await fetch(`/api/qr/${sessionId}`);
            const data = await res.json();
            if (data.connected && showedQR) { showSuccess(); return; }
            if (data.qr && !showedQR) {
                showedQR = true;
                document.getElementById('qrContainer').innerHTML = `<img src="${data.qr}" alt="QR">`;
                document.getElementById('qrStatusText').textContent = 'Scan with your phone';
            }
            if (attempts > 20 && !showedQR) { showSuccess(); return; }
        } catch {}
        attempts++;
        setTimeout(check, 2000);
    };
    check();
}

// ── Cancel ─────────────────────────────────────────────
function cancelSession() {
    if (pollInterval) clearInterval(pollInterval);
    currentSession = null;
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('step1').classList.remove('done');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step2Label').textContent = 'Link';
}

// ── Success ────────────────────────────────────────────
function showSuccess() {
    if (pollInterval) clearInterval(pollInterval);
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('successCard').classList.remove('hidden');
    document.getElementById('step2').classList.add('done');
    document.getElementById('step3').classList.add('active');
}

// ── Reset ──────────────────────────────────────────────
function resetSession() {
    currentSession = null;
    currentPairingCode = '';
    document.getElementById('successCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.add('hidden');
    document.getElementById('createCard').classList.remove('hidden');
    document.getElementById('sessionName').value = '';
    document.getElementById('phoneNumber').value = '';
    document.getElementById('step1').classList.remove('done');
    document.getElementById('step2').classList.remove('active', 'done');
    document.getElementById('step2Label').textContent = 'Link';
    document.getElementById('step3').classList.remove('active');
    switchTab('sessions');
}

// ── Reconnect ──────────────────────────────────────────
async function reconnectSession(id) {
    currentSession = id;
    document.getElementById('createCard').classList.add('hidden');
    document.getElementById('pairingCard').classList.add('hidden');
    document.getElementById('qrCard').classList.remove('hidden');
    document.getElementById('step1').classList.add('done');
    document.getElementById('step2').classList.add('active');
    document.getElementById('step2Label').textContent = 'QR';
    if (pollInterval) clearInterval(pollInterval);
    waitForQR(id);
}

// ── Delete ─────────────────────────────────────────────
async function deleteSession(id) {
    if (!confirm(`Delete session "${id}"?`)) return;
    try {
        await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
        sessions.delete(id);
        loadSessions();
    } catch {}
}

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    startTitleLoop();
    loadStatus();
    loadSessions();
    setInterval(loadStatus, 10000);

    // Enter key navigation
    document.getElementById('sessionName')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') document.getElementById('phoneNumber')?.focus();
    });
    document.getElementById('phoneNumber')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') createSession();
    });

    // Ripple on all buttons
    document.querySelectorAll('.btn, .btn-back, .btn-copy, .btn-whatsapp, .icon-btn, .tab, .music-toggle').forEach(el => {
        el.addEventListener('click', addRipple);
    });

    // Parallax on mouse move
    let mouseX = 0, mouseY = 0, currentX = 0, currentY = 0;
    document.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 30;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 30;
    });
    function animateParallax() {
        currentX += (mouseX - currentX) * 0.05;
        currentY += (mouseY - currentY) * 0.05;
        const bg = document.querySelector('.bg');
        if (bg) bg.style.transform = `scale(1.15) translate(${currentX}px, ${currentY}px)`;
        requestAnimationFrame(animateParallax);
    }
    animateParallax();
});
