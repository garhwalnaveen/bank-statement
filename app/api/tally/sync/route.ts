import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";

function hashToken(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
}

async function authenticateToken(req: NextRequest): Promise<{ teamId: string } | null> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const raw = authHeader.slice(7);
    const tokenHash = hashToken(raw);

    const record = await prisma.tallyToken.findUnique({ where: { tokenHash } });
    if (!record) return null;

    // Update lastUsedAt asynchronously (fire-and-forget)
    prisma.tallyToken.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => { });

    return { teamId: record.teamId };
}

export async function POST(req: NextRequest) {
    // Authenticate via bearer token
    const auth = await authenticateToken(req);
    if (!auth) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { companyName, ledgers } = await req.json();
        const { teamId } = auth;

        if (!companyName) {
            return NextResponse.json({ message: "Missing companyName" }, { status: 400 });
        }

        if (!Array.isArray(ledgers)) {
            return NextResponse.json({ message: "Ledgers must be an array" }, { status: 400 });
        }

        // 1. Upsert the Tally Client (Company) — teamId comes from the token, not the body
        let client = await prisma.client.findFirst({
            where: { teamId, tallyCompanyName: companyName },
        });

        if (!client) {
            client = await prisma.client.create({
                data: {
                    teamId,
                    name: companyName,
                    tallyCompanyName: companyName,
                },
            });
        }

        // 2. Upsert Ledgers in batches of 100 to avoid query limits
        const BATCH_SIZE = 100;
        for (let i = 0; i < ledgers.length; i += BATCH_SIZE) {
            const batch = ledgers.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map((l: { name: string; group?: string }) =>
                    prisma.ledger.upsert({
                        where: { clientId_name: { clientId: client!.id, name: l.name } },
                        update: { group: l.group ?? null, syncedAt: new Date() },
                        create: {
                            clientId: client!.id,
                            name: l.name,
                            group: l.group ?? null,
                            syncedAt: new Date(),
                        },
                    })
                )
            );
        }

        return NextResponse.json({
            message: "Sync successful",
            clientId: client.id,
            ledgerCount: ledgers.length,
        });
    } catch (error) {
        console.error("Tally sync error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
