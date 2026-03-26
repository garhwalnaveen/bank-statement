import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PARSER_URL = process.env.PARSER_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const teamId = formData.get("teamId") as string;
        const clientId = formData.get("clientId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json(
                { error: "Only PDF files are accepted" },
                { status: 400 }
            );
        }

        if (!teamId) {
            return NextResponse.json(
                { error: "Team ID is required" },
                { status: 400 }
            );
        }

        // Forward to Python parser service
        const parserFormData = new FormData();
        parserFormData.append("file", file);

        const response = await fetch(`${PARSER_URL}/parse`, {
            method: "POST",
            body: parserFormData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: "Parser service error" }));
            return NextResponse.json(
                { error: error.detail || "Parsing failed" },
                { status: response.status }
            );
        }

        const result = await response.json();

        // Create statement in database
        const statement = await prisma.statement.create({
            data: {
                teamId,
                clientId: clientId || null,
                filename: file.name,
                bankName: result.metadata?.bank || null,
                accountNumber: result.metadata?.account_number || null,
                currency: result.metadata?.currency || null,
                periodFrom: result.metadata?.period_from || null,
                periodTo: result.metadata?.period_to || null,
                openingBalance: result.metadata?.opening_balance || null,
                closingBalance: result.metadata?.closing_balance || null,
                transactionCount: result.transaction_count || 0,
                isValid: result.validation?.is_valid || false,
                accuracyPct: result.validation?.summary?.accuracy_pct || null,
                warnings: result.warnings || [],
                transactions: {
                    create: (result.transactions || []).map((t: Record<string, unknown>, index: number) => ({
                        srNo: index + 1,
                        date: (t.date as string) || null,
                        description: (t.description as string) || null,
                        amount: t.amount != null ? Number(t.amount) : null,
                        debit: t.debit != null ? Number(t.debit) : null,
                        credit: t.credit != null ? Number(t.credit) : null,
                        balance: t.balance != null ? Number(t.balance) : null,
                        reference: (t.reference as string) || null,
                    })),
                },
            },
        });

        // If client has rules, auto-apply them
        if (clientId) {
            await applyRules(statement.id, clientId);
        }

        return NextResponse.json({
            id: statement.id,
            filename: file.name,
            transactionCount: result.transaction_count,
            metadata: result.metadata,
            validation: result.validation,
            warnings: result.warnings,
        });
    } catch (error: unknown) {
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Auto-apply rules to transactions
// Optimised: batch-collect matched IDs per rule, then call updateMany once per rule.
async function applyRules(statementId: string, clientId: string) {
    const [rules, transactions] = await Promise.all([
        prisma.rule.findMany({
            where: { clientId },
            orderBy: { priority: "desc" },
            select: { id: true, pattern: true, matchType: true, ledgerName: true, transactionType: true },
        }),
        prisma.transaction.findMany({
            where: { statementId },
            select: { id: true, description: true },
        }),
    ]);

    if (rules.length === 0 || transactions.length === 0) return;

    // Track which transactions have already been assigned (first matching rule wins)
    const assignedIds = new Set<string>();

    for (const rule of rules) {
        const matchedIds: string[] = [];
        const pattern = rule.pattern.toLowerCase();

        for (const txn of transactions) {
            if (assignedIds.has(txn.id) || !txn.description) continue;

            const desc = txn.description.toLowerCase();
            let matched = false;

            switch (rule.matchType) {
                case "exact": matched = desc === pattern; break;
                case "startsWith": matched = desc.startsWith(pattern); break;
                case "contains":
                default: matched = desc.includes(pattern); break;
            }

            if (matched) matchedIds.push(txn.id);
        }

        if (matchedIds.length > 0) {
            // Single DB call for all matched transactions under this rule
            await prisma.transaction.updateMany({
                where: { id: { in: matchedIds } },
                data: {
                    ledgerName: rule.ledgerName,
                    transactionType: rule.transactionType,
                    isAutoMatched: true,
                    ruleId: rule.id,
                },
            });
            matchedIds.forEach(id => assignedIds.add(id));
        }
    }
}
