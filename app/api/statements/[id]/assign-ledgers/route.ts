import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT /api/statements/[id]/assign-ledgers
// Accepts: { teamId, assignments: [{ transactionId, ledgerName, transactionType }] }
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, assignments } = body;

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const statement = await prisma.statement.findFirst({ where: { id, teamId } });
        if (!statement) {
            return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }

        if (!Array.isArray(assignments)) {
            return NextResponse.json({ error: "assignments array is required" }, { status: 400 });
        }

        let updated = 0;
        for (const a of assignments) {
            if (!a.transactionId) continue;
            await prisma.transaction.update({
                where: { id: a.transactionId, statementId: id },
                data: {
                    ledgerName: a.ledgerName || null,
                    transactionType: a.transactionType || null,
                    isManual: true,
                    isAutoMatched: false,
                },
            });
            updated++;
        }

        return NextResponse.json({ success: true, updated });
    } catch (error: unknown) {
        console.error("Assign ledgers error:", error);
        return NextResponse.json({ error: "Failed to assign ledgers" }, { status: 500 });
    }
}
