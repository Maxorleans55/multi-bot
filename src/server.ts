import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import sessionManager from './session/sessionManager.js';
import { createSession, disconnectSession, getAllSessions } from './session/sessionHelper.js';
import prisma from './database/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ status: 'online', bot: process.env.BOT_NAME || 'Bot' });
});

// Get QR code for a session
app.get('/api/qr/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const qr = sessionManager.getQR(sessionId);
    const connected = sessionManager.isConnected(sessionId);

    if (connected) {
      return res.json({ qr: null, connected: true });
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

// List all sessions
app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await getAllSessions();
    const activeSessions = Array.from(sessions.keys());

    // Get session details from DB
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

// Create new session
app.post('/api/sessions', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Check if session already exists
    const existing = await sessionManager.getSession(sessionId);
    if (existing) {
      return res.json({ success: true, sessionId, message: 'Session already exists' });
    }

    await createSession(sessionId);
    res.json({ success: true, sessionId, message: 'Session created. Check QR code.' });
  } catch (error) {
    res.status(500).json({ error: `Failed to create session: ${error}` });
  }
});

// Disconnect session
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await disconnectSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} disconnected` });
  } catch (error) {
    res.status(500).json({ error: `Failed to disconnect session: ${error}` });
  }
});

// Bot stats
app.get('/api/stats', async (_req, res) => {
  try {
    const sessions = await getAllSessions();
    const userCount = await prisma.user.count().catch(() => 0);
    const messageCount = await prisma.message.count().catch(() => 0);

    res.json({
      activeSessions: sessions.size,
      totalUsers: userCount,
      totalMessages: messageCount,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Serve web UI for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

export default app;
