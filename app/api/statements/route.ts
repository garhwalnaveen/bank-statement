import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const teamId = request.nextUrl.searchParams.get("teamId");
        const clientId = request.nextUrl.searchParams.get("clientId");

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const where: Record<string, unknown> = { teamId };
        if (clientId) where.clientId = clientId;

        const statements = await prisma.statement.findMany({
            where,
            include: {
                client: { select: { id: true, name: true } },
                _count: { select: { transactions: true } },
            },
            orderBy: { uploadedAt: "desc" },
        });

        return NextResponse.json({
            statements: statements.map((s) => ({
                id: s.id,
                filename: s.filename,
                uploadedAt: s.uploadedAt.toISOString(),
                transactionCount: s.transactionCount,
                clientName: s.client?.name || null,
                clientId: s.clientId,
                metadata: {
                    bank: s.bankName,
                    account_number: s.accountNumber,
                    currency: s.currency,
                    period_from: s.periodFrom,
                    period_to: s.periodTo,
                },
                validation: {
                    is_valid: s.isValid,
                    accuracy_pct: s.accuracyPct,
                },
            })),
        });
    } catch (error: unknown) {
        console.error("List statements error:", error);
        return NextResponse.json({ error: "Failed to list statements" }, { status: 500 });
    }
}
