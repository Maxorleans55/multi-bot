import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import sessionManager from './session/sessionManager.js';
import { createSession, disconnectSession, getAllSessions } from './session/sessionHelper.js';
import prisma from './database/prisma.js';
import { log } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/status', (_req, res) => {
  res.json({ status: 'online', bot: process.env.BOT_NAME || 'Bot' });
});

app.get('/api/qr/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const qr = sessionManager.getQR(sessionId);
    const pairingCode = sessionManager.getPairingCode(sessionId);
    const connected = sessionManager.isConnected(sessionId);

    if (connected) {
      return res.json({ qr: null, connected: true });
    }

    if (pairingCode) {
      return res.json({ qr: null, connected: false, pairingCode });
    }

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      return res.json({ qr: qrDataUrl, connected: false });
    }

    return res.json({ qr: null, connected: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

app.post('/api/pairing/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

    // Check if session exists
    let socket = await sessionManager.getSession(sessionId);
    if (!socket) {
      return res.status(500).json({ error: 'Session not found. Create session first.' });
    }

    // Check if already connected
    if (sessionManager.isConnected(sessionId)) {
      return res.status(400).json({ error: 'Session already connected' });
    }

    log.info(`[Pairing] Requesting pairing code for ${sessionId} (phone: ${cleanPhone})`);

    const code = await sessionManager.requestPairingCode(sessionId, cleanPhone);
    if (code) {
      log.info(`[Pairing] SUCCESS: code ${code} for ${sessionId} (phone: ${cleanPhone})`);
      res.json({ success: true, code });
    } else {
      res.status(500).json({ error: 'Failed to generate pairing code. Check terminal for errors.' });
    }
  } catch (error) {
    log.error(`[Pairing] Error:`, error as object);
    res.status(500).json({ error: 'Failed to request pairing code' });
  }
});

app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await getAllSessions();
    const activeSessions = Array.from(sessions.keys());
    const dbSessions = await prisma.waSession.findMany().catch(() => []);

    const sessionList = dbSessions.map((s) => ({
      sessionId: s.sessionId,
      status: s.status || 'unknown',
      isActive: s.isActive,
      phoneNumber: s.phoneNumber,
      lastConnectedAt: s.lastConnectedAt,
      lastDisconnectedAt: s.lastDisconnectedAt,
      lastQrAt: s.lastQrAt,
      isAlive: activeSessions.includes(s.sessionId),
    }));

    res.json({ sessions: sessionList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Force clear existing session data completely
    try { await sessionManager.disconnectSession(sessionId); } catch {}

    // Also clear ALL auth data from DB for this session
    try {
      const { default: prisma } = await import('./database/prisma.js');
      await prisma.waAuthState.deleteMany({ where: { sessionId } });
      await prisma.waSession.deleteMany({ where: { sessionId } });
    } catch {}

    // Small delay to ensure cleanup is complete
    await new Promise(r => setTimeout(r, 500));

    await createSession(sessionId, true);

    res.json({ success: true, sessionId, message: 'Session created.' });
  } catch (error) {
    res.status(500).json({ error: `Failed to create session: ${error}` });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await disconnectSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} disconnected` });
  } catch (error) {
    res.status(500).json({ error: `Failed to disconnect session: ${error}` });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const sessions = await getAllSessions();

    res.json({
      activeSessions: sessions.size,
      totalUsers: 0,
      totalMessages: 0,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

try {
  app.listen(PORT, '0.0.0.0', () => {
    log.info(`🌐 Web server running on port ${PORT}`);
  });
} catch (err) {
  log.error(`❌ Failed to start web server:`, err as object);
}

export default app;
