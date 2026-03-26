import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/clients?teamId=xxx
export async function GET(request: NextRequest) {
    try {
        const teamId = request.nextUrl.searchParams.get("teamId");
        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const clients = await prisma.client.findMany({
            where: { teamId },
            include: {
                _count: { select: { ledgers: true, rules: true, statements: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ clients });
    } catch (error) {
        console.error("List clients error:", error);
        return NextResponse.json({ error: "Failed to list clients" }, { status: 500 });
    }
}

// POST /api/clients
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { teamId, name, tallyCompanyName, bankName } = body;

        if (!teamId || !name) {
            return NextResponse.json(
                { error: "Team ID and name are required" },
                { status: 400 }
            );
        }

        const client = await prisma.client.create({
            data: {
                teamId,
                name,
                tallyCompanyName: tallyCompanyName || null,
                bankName: bankName || null,
            },
        });

        return NextResponse.json(client, { status: 201 });
    } catch (error) {
        console.error("Create client error:", error);
        return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }
}
