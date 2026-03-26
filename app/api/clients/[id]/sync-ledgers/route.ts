import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchLedgersFromTally, MOCK_LEDGERS } from "@/lib/tally";

// POST /api/clients/[id]/sync-ledgers
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, useMock } = body;

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const client = await prisma.client.findFirst({ where: { id, teamId } });
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        let ledgers: { name: string; group: string }[];

        if (useMock) {
            // Use mock ledgers for testing
            ledgers = MOCK_LEDGERS;
        } else {
            // Fetch from Tally
            const settings = await prisma.tallySettings.findUnique({ where: { teamId } });
            if (!settings) {
                return NextResponse.json(
                    { error: "Tally settings not configured. Go to Settings to configure." },
                    { status: 400 }
                );
            }

            const companyName = client.tallyCompanyName || client.name;
            try {
                ledgers = await fetchLedgersFromTally(settings.host, settings.port, companyName);
            } catch (error) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : "Failed to fetch ledgers from Tally" },
                    { status: 502 }
                );
            }
        }

        // Upsert ledgers
        let created = 0;
        let updated = 0;
        for (const ledger of ledgers) {
            const existing = await prisma.ledger.findUnique({
                where: { clientId_name: { clientId: id, name: ledger.name } },
            });
            if (existing) {
                await prisma.ledger.update({
                    where: { id: existing.id },
                    data: { group: ledger.group, syncedAt: new Date() },
                });
                updated++;
            } else {
                await prisma.ledger.create({
                    data: {
                        clientId: id,
                        name: ledger.name,
                        group: ledger.group,
                        syncedAt: new Date(),
                    },
                });
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            totalLedgers: ledgers.length,
            created,
            updated,
        });
    } catch (error) {
        console.error("Sync ledgers error:", error);
        return NextResponse.json({ error: "Failed to sync ledgers" }, { status: 500 });
    }
}
