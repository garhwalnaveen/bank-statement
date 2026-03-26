import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
                transactions: { orderBy: { srNo: "asc" } },
            },
        });

        if (!statement) {
            return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }

        // Build CSV
        const headers = ["date", "description", "amount", "debit", "credit", "balance", "reference", "ledger", "type"];
        const rows = [headers.join(",")];

        for (const t of statement.transactions) {
            const row = [
                t.date || "",
                csvEscape(t.description || ""),
                t.amount?.toString() || "",
                t.debit?.toString() || "",
                t.credit?.toString() || "",
                t.balance?.toString() || "",
                csvEscape(t.reference || ""),
                csvEscape(t.ledgerName || ""),
                t.transactionType || "",
            ];
            rows.push(row.join(","));
        }

        const csv = rows.join("\n");
        const csvFilename = statement.filename.replace(/\.pdf$/i, "_transactions.csv");

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${csvFilename}"`,
            },
        });
    } catch (error: unknown) {
        console.error("CSV download error:", error);
        return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 });
    }
}

function csvEscape(str: string): string {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
