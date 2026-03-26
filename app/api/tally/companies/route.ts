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
    const record = await prisma.tallyToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!record) return null;
    prisma.tallyToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => { });
    return { teamId: record.teamId };
}

// GET /api/tally/companies — list companies (clients) synced from Tally for this team
export async function GET(req: NextRequest) {
    const auth = await authenticateToken(req);
    if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const companies = await prisma.client.findMany({
        where: { teamId: auth.teamId, NOT: { tallyCompanyName: null } },
        select: {
            id: true,
            name: true,
            tallyCompanyName: true,
            _count: { select: { ledgers: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ companies });
}
