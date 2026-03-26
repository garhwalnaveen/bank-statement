import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateTallyXml, sendToTally } from "@/lib/tally";

// POST /api/statements/[id]/export-tally
// Generates Tally XML and optionally sends it to Tally directly
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, action } = body; // action: "download" | "send"

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const statement = await prisma.statement.findFirst({
            where: { id, teamId },
            include: {
                client: true,
                transactions: { orderBy: { srNo: "asc" } },
            },
        });

        if (!statement) {
            return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }

        // Get assigned transactions only
        const assignedTxns = statement.transactions.filter(
            (t) => t.ledgerName && t.transactionType
        );

        if (assignedTxns.length === 0) {
            return NextResponse.json(
                { error: "No transactions have been assigned ledgers. Please assign ledgers first." },
                { status: 400 }
            );
        }

        // Determine bank ledger name
        const bankLedger = statement.bankName || statement.client?.bankName || "Bank Account";

        // Determine company name
        const companyName =
            statement.client?.tallyCompanyName ||
            statement.client?.name ||
            "Default Company";

        // Build voucher entries
        const entries = assignedTxns.map((t) => ({
            date: t.date || new Date().toISOString().split("T")[0],
            narration: t.description || "",
            type: t.transactionType as "Receipt" | "Payment" | "Contra" | "Journal",
            bankLedger,
            partyLedger: t.ledgerName!,
            amount: Math.abs(t.amount || t.debit || t.credit || 0),
        }));

        const xml = generateTallyXml(companyName, entries);

        if (action === "send") {
            // Send directly to Tally
            const settings = await prisma.tallySettings.findUnique({ where: { teamId } });
            if (!settings) {
                return NextResponse.json(
                    { error: "Tally settings not configured" },
                    { status: 400 }
                );
            }

            const result = await sendToTally(settings.host, settings.port, xml);
            return NextResponse.json({
                ...result,
                voucherCount: entries.length,
            });
        }

        // Default: return XML for download
        return new NextResponse(xml, {
            headers: {
                "Content-Type": "application/xml",
                "Content-Disposition": `attachment; filename="${statement.filename.replace(
                    /\.pdf$/i,
                    ""
                )}_tally_vouchers.xml"`,
            },
        });
    } catch (error: unknown) {
        console.error("Export to Tally error:", error);
        return NextResponse.json({ error: "Failed to generate Tally export" }, { status: 500 });
    }
}
