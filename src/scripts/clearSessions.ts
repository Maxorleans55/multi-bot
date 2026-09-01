import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const auth = await prisma.waAuthState.deleteMany({});
  const sessions = await prisma.waSession.deleteMany({});
  console.log(`Deleted ${auth.count} auth records and ${sessions.count} session records`);
  await prisma.$disconnect();
}

main().catch(console.error);
