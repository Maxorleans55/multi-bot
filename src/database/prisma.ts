import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 0,
    timeout: 0,
  },
  // log: ['query', 'error', 'warn'],
});

// Override $transaction to run operations sequentially (free tier MongoDB doesn't support transactions)
const originalTransaction = prisma.$transaction.bind(prisma);
(prisma as any).$transaction = async (operations: any, options?: any) => {
  const results: any[] = [];
  const ops = Array.isArray(operations) ? operations : [operations];
  for (const op of ops) {
    if (typeof op === 'function') {
      results.push(await op(prisma));
    } else {
      results.push(await op);
    }
  }
  return results.length === 1 ? results[0] : results;
};

export default prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
