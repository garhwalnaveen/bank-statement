import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/clients/[id]?teamId=xxx
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

        const client = await prisma.client.findFirst({
            where: { id, teamId },
            include: {
                ledgers: { orderBy: { name: "asc" } },
                rules: { orderBy: { priority: "desc" } },
                _count: { select: { statements: true } },
            },
        });

        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        return NextResponse.json(client);
    } catch (error) {
        console.error("Get client error:", error);
        return NextResponse.json({ error: "Failed to get client" }, { status: 500 });
    }
}

// PUT /api/clients/[id]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { teamId, name, tallyCompanyName, bankName } = body;

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const existing = await prisma.client.findFirst({ where: { id, teamId } });
        if (!existing) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const client = await prisma.client.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(tallyCompanyName !== undefined && { tallyCompanyName }),
                ...(bankName !== undefined && { bankName }),
            },
        });

        return NextResponse.json(client);
    } catch (error) {
        console.error("Update client error:", error);
        return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }
}

// DELETE /api/clients/[id]?teamId=xxx
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teamId = request.nextUrl.searchParams.get("teamId");
        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const existing = await prisma.client.findFirst({ where: { id, teamId } });
        if (!existing) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        await prisma.client.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete client error:", error);
        return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
    }
}
