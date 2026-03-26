import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";

function hashToken(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
}

// GET /api/tally/tokens?teamId=xxx  — list tokens (prefix + metadata only, never raw)
export async function GET(req: NextRequest) {
    const teamId = req.nextUrl.searchParams.get("teamId");
    if (!teamId) {
        return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    const tokens = await prisma.tallyToken.findMany({
        where: { teamId },
        select: { id: true, name: true, tokenPrefix: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tokens });
}

// POST /api/tally/tokens  — generate a new sync token
export async function POST(req: NextRequest) {
    try {
        const { teamId, name } = await req.json();
        if (!teamId) {
            return NextResponse.json({ error: "teamId is required" }, { status: 400 });
        }

        // Generate a cryptographically secure random token
        const raw = "tc_" + randomBytes(32).toString("hex");
        const tokenHash = hashToken(raw);
        const tokenPrefix = raw.slice(0, 11); // "tc_" + 8 hex chars

        await prisma.tallyToken.create({
            data: {
                teamId,
                name: name || "Sync Token",
                tokenHash,
                tokenPrefix,
            },
        });

        // Return the raw token ONCE — it is never stored in plaintext
        return NextResponse.json({ token: raw, prefix: tokenPrefix }, { status: 201 });
    } catch (err) {
        console.error("Create token error:", err);
        return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
    }
}

// DELETE /api/tally/tokens?id=xxx  — revoke a token
export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    try {
        await prisma.tallyToken.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
}
