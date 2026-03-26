import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { testTallyConnection } from "@/lib/tally";

// GET /api/tally/settings?teamId=xxx
export async function GET(request: NextRequest) {
    try {
        const teamId = request.nextUrl.searchParams.get("teamId");
        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const settings = await prisma.tallySettings.findUnique({ where: { teamId } });
        return NextResponse.json(settings || { host: "localhost", port: 9000, companyName: null });
    } catch (error) {
        console.error("Get tally settings error:", error);
        return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
    }
}

// PUT /api/tally/settings
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { teamId, host, port, companyName } = body;

        if (!teamId) {
            return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
        }

        const settings = await prisma.tallySettings.upsert({
            where: { teamId },
            update: {
                host: host || "localhost",
                port: port || 9000,
                companyName: companyName || null,
            },
            create: {
                teamId,
                host: host || "localhost",
                port: port || 9000,
                companyName: companyName || null,
            },
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Update tally settings error:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}

// POST /api/tally/settings (test connection)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { host, port } = body;

        const result = await testTallyConnection(host || "localhost", port || 9000);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Test tally connection error:", error);
        return NextResponse.json({ error: "Failed to test connection" }, { status: 500 });
    }
}
