import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/clients/[id]/ledgers — Create a new ledger manually
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, name, group } = body;

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Ledger name is required" }, { status: 400 });
        }

        const client = await prisma.client.findFirst({ where: { id, teamId } });
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        // Check for duplicate
        const existing = await prisma.ledger.findUnique({
            where: { clientId_name: { clientId: id, name: name.trim() } },
        });
        if (existing) {
            return NextResponse.json({ error: "A ledger with this name already exists" }, { status: 409 });
        }

        const ledger = await prisma.ledger.create({
            data: {
                clientId: id,
                name: name.trim(),
                group: group?.trim() || null,
            },
        });

        return NextResponse.json(ledger, { status: 201 });
    } catch (error) {
        console.error("Create ledger error:", error);
        return NextResponse.json({ error: "Failed to create ledger" }, { status: 500 });
    }
}

// DELETE /api/clients/[id]/ledgers?ledgerId=xxx&teamId=xxx
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teamId = request.nextUrl.searchParams.get("teamId");
        const ledgerId = request.nextUrl.searchParams.get("ledgerId");

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }
        if (!ledgerId) {
            return NextResponse.json({ error: "Ledger ID is required" }, { status: 400 });
        }

        const client = await prisma.client.findFirst({ where: { id, teamId } });
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        await prisma.ledger.delete({ where: { id: ledgerId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete ledger error:", error);
        return NextResponse.json({ error: "Failed to delete ledger" }, { status: 500 });
    }
}
