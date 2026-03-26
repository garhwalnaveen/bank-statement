const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const stmts = await prisma.statement.findMany({
    include: { transactions: true },
    take: 1,
    orderBy: { uploadedAt: 'desc' }
  });
  
  if (stmts.length > 0) {
    console.log("Statement:", stmts[0].filename);
    console.log("Transactions preview (first 5):");
    console.dir(stmts[0].transactions.slice(0, 5).map(t => ({
      desc: t.description,
      amount: t.amount,
      debit: t.debit,
      credit: t.credit,
      type: t.transactionType,
      auto: t.isAutoMatched
    })), { depth: null });
  } else {
    console.log("No statements found.");
  }
}

main().finally(() => prisma.$disconnect());
