import prisma from './lib/prisma';

async function main() {
    const cnt = await prisma.transaction.count({
        where: {
            // check if debit is not null or amount < 0
            OR: [
                { debit: { not: null } },
                { amount: { lt: 0 } }
            ]
        }
    });
    console.log("Total debits in DB:", cnt);

    const allTxns = await prisma.transaction.count();
    console.log("Total Txns in DB:", allTxns);
}

main().finally(() => prisma.$disconnect());
