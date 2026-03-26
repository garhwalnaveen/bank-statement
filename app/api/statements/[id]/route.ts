import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/statements/[id]?teamId=xxx
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teamId = request.nextUrl.searchParams.get("teamId");

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const statement = await prisma.statement.findFirst({
            where: { id, teamId },
            include: {
                client: { select: { id: true, name: true } },
                transactions: {
                    orderBy: { srNo: "asc" },
                    select: {
                        id: true,
                        srNo: true,
                        date: true,
                        description: true,
                        amount: true,
                        debit: true,
                        credit: true,
                        reference: true,
                        transactionType: true,
                        ledgerName: true,
                        isAutoMatched: true,
                        isManual: true,
                    },
                },
            },
        });

        if (!statement) {
            return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: statement.id,
            teamId: statement.teamId,
            clientId: statement.clientId,
            clientName: statement.client?.name || null,
            filename: statement.filename,
            uploadedAt: statement.uploadedAt.toISOString(),
            transactionCount: statement.transactionCount,
            metadata: {
                bank: statement.bankName,
                account_number: statement.accountNumber,
                currency: statement.currency,
                period_from: statement.periodFrom,
                period_to: statement.periodTo,
                opening_balance: statement.openingBalance,
                closing_balance: statement.closingBalance,
            },
            validation: {
                is_valid: statement.isValid,
                accuracy_pct: statement.accuracyPct,
            },
            warnings: statement.warnings,
            transactions: statement.transactions.map((t) => ({
                id: t.id,
                srNo: t.srNo,
                date: t.date,
                description: t.description,
                amount: t.amount,
                debit: t.debit,
                credit: t.credit,
                reference: t.reference,
                transactionType: t.transactionType,
                ledgerName: t.ledgerName,
                isAutoMatched: t.isAutoMatched,
                isManual: t.isManual,
            })),
        });
    } catch (error: unknown) {
        console.error("Get statement error:", error);
        return NextResponse.json({ error: "Failed to get statement" }, { status: 500 });
    }
}

// DELETE /api/statements/[id]?teamId=xxx
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teamId = request.nextUrl.searchParams.get("teamId");

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const statement = await prisma.statement.findFirst({ where: { id, teamId } });
        if (!statement) {
            return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }

        await prisma.statement.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete statement error:", error);
        return NextResponse.json({ error: "Failed to delete statement" }, { status: 500 });
    }
}
