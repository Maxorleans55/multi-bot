import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Only delete sessions that are NOT active
  const deadSessions = await prisma.waSession.deleteMany({
    where: { isActive: false }
  });
  
  // Delete auth states for dead sessions
  const deadAuth = await prisma.waAuthState.deleteMany({
    where: { sessionId: { notIn: [] } } // This deletes all orphaned auth states
  });
  
  // Show what's left
  const remaining = await prisma.waSession.findMany({
    select: { sessionId: true, isActive: true, status: true }
  });
  
  console.log(`Deleted ${deadSessions.count} dead sessions`);
  console.log(`Remaining active sessions:`, remaining.map(s => `${s.sessionId} (${s.status})`).join(', ') || 'none');
  await prisma.$disconnect();
}

main().catch(console.error);
