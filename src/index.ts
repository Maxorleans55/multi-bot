import dotenv from 'dotenv';
import { createSession, loadActiveSessions, disconnectAllSessions, getAllSessions } from './session/sessionHelper.js';
import prisma from './database/prisma.js';
import { registerAllTools } from './tools/index.js';
import { premiumService } from './services/premiumService.js';
import './server.js';

// Set console encoding to UTF-8 for emoji support on Windows
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf-8');
  process.stderr.setEncoding('utf-8');
}

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Bot-Baileys-AI...');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    process.exit(1);
  }

  // Register AI tool definitions (function calling)
  registerAllTools();

  // Initialize premium service (load toggle flags from DB)
  await premiumService.init();

  // Get command line arguments BEFORE loading sessions so we know intent
  const args = process.argv.slice(2);
  const newSessionId = args.find(arg => arg.startsWith('--session='))?.split('=')[1];
  const forceClear = args.includes('--force-clear');
  const onlyMode = args.includes('--only');

  if (onlyMode) {
    if (!newSessionId) {
      console.error('❌ --only requires --session=<session-id>');
      process.exit(1);
    }
    console.log(`🎯 --only mode: running ONLY session "${newSessionId}" (other DB sessions will be ignored)`);
    await createSession(newSessionId, forceClear);
  } else {
    await loadActiveSessions(forceClear);
    if (newSessionId) {
      await createSession(newSessionId, forceClear);
    } else {
      const sessions = await getAllSessions();
      if (sessions.size === 0) {
        console.log('ℹ️  No active sessions found. Creating default session...');
        await createSession('default');
      } else {
        console.log(`ℹ️  ${sessions.size} active session(s) loaded.`);
      }
    }
  }

  console.log('✅ Bot is running!');
  console.log('💡 Use --session=<session-id> [--force-clear] to create/replace a session');
  console.log('💡 Use --only with --session=<id> to run only that session');
  console.log('💡 Press Ctrl+C to stop the bot');

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot...');
    await disconnectAllSessions();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down bot...');
    await disconnectAllSessions();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
