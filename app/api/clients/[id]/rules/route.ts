import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/clients/[id]/rules?teamId=xxx
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

        // Single query: verify ownership AND fetch rules together
        const client = await prisma.client.findFirst({
            where: { id, teamId },
            select: {
                id: true,
                rules: { orderBy: { priority: "desc" } },
            },
        });
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        return NextResponse.json({ rules: client.rules });
    } catch (error) {
        console.error("List rules error:", error);
        return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
    }
}

// POST /api/clients/[id]/rules
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, pattern, matchType, ledgerName, transactionType, priority } = body;

        if (!teamId || !pattern || !ledgerName || !transactionType) {
            return NextResponse.json(
                { error: "teamId, pattern, ledgerName, and transactionType are required" },
                { status: 400 }
            );
        }

        // Verify ownership then create — two queries but POST is rare; keep readable
        const client = await prisma.client.findFirst({ where: { id, teamId }, select: { id: true } });
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const rule = await prisma.rule.create({
            data: {
                clientId: id,
                pattern,
                matchType: matchType || "contains",
                ledgerName,
                transactionType,
                priority: priority || 0,
            },
        });

        return NextResponse.json(rule, { status: 201 });
    } catch (error) {
        console.error("Create rule error:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}

// DELETE /api/clients/[id]/rules — merged ownership check into deleteMany
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teamId = request.nextUrl.searchParams.get("teamId");
        const ruleId = request.nextUrl.searchParams.get("ruleId");

        if (!teamId || !ruleId) {
            return NextResponse.json({ error: "teamId and ruleId are required" }, { status: 400 });
        }

        // Single query: only deletes if the rule belongs to a client owned by this team
        const deleted = await prisma.rule.deleteMany({
            where: { id: ruleId, clientId: id, client: { teamId } },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete rule error:", error);
        return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }
}
