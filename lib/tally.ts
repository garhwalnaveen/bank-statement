/**
 * Tally XML Connector
 * Communicates with TallyPrime via XML over HTTP
 * - Fetch ledgers from Tally
 * - Fetch account groups
 * - Generate import XML for vouchers
 */

// ─── Fetch Ledgers from Tally ────────────────────────────────────────────────

export async function fetchLedgersFromTally(
    host: string,
    port: number,
    companyName: string
): Promise<{ name: string; group: string }[]> {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>All Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="All Ledgers" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>NAME, PARENT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();

    try {
        const response = await fetch(`http://${host}:${port}`, {
            method: "POST",
            headers: { "Content-Type": "text/xml" },
            body: xml,
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Tally responded with ${response.status}`);
        }

        const responseXml = await response.text();
        return parseLedgerResponse(responseXml);
    } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new Error("Tally connection timed out. Is TallyPrime running with the XML server enabled?");
        }
        throw error;
    }
}

function parseLedgerResponse(xml: string): { name: string; group: string }[] {
    const ledgers: { name: string; group: string }[] = [];
    // Simple regex-based XML parsing (no dependency needed)
    const ledgerRegex = /<LEDGER\b[^>]*>([\s\S]*?)<\/LEDGER>/gi;
    let match;

    while ((match = ledgerRegex.exec(xml)) !== null) {
        const block = match[1];
        const nameMatch = block.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
        const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);

        if (nameMatch) {
            ledgers.push({
                name: nameMatch[1].trim(),
                group: parentMatch ? parentMatch[1].trim() : "Unknown",
            });
        }
    }

    return ledgers;
}

// ─── Test Tally Connection ───────────────────────────────────────────────────

export async function testTallyConnection(
    host: string,
    port: number
): Promise<{ connected: boolean; companies: string[]; error?: string }> {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Companies" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>NAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();

    try {
        const response = await fetch(`http://${host}:${port}`, {
            method: "POST",
            headers: { "Content-Type": "text/xml" },
            body: xml,
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return { connected: false, companies: [], error: `HTTP ${response.status}` };
        }

        const responseXml = await response.text();
        const companies: string[] = [];
        const companyRegex = /<COMPANY\b[^>]*>([\s\S]*?)<\/COMPANY>/gi;
        let match;
        while ((match = companyRegex.exec(responseXml)) !== null) {
            const nameMatch = match[1].match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
            if (nameMatch) companies.push(nameMatch[1].trim());
        }

        return { connected: true, companies };
    } catch {
        return {
            connected: false,
            companies: [],
            error: "Cannot connect to Tally. Make sure TallyPrime is running with XML Server enabled (port " + port + ").",
        };
    }
}

// ─── Generate Tally Import XML ───────────────────────────────────────────────

interface VoucherEntry {
    date: string;           // YYYY-MM-DD format
    narration: string;
    type: "Receipt" | "Payment" | "Contra" | "Journal";
    bankLedger: string;     // The bank account ledger
    partyLedger: string;    // The party/expense ledger
    amount: number;         // Always positive
}

export function generateTallyXml(
    companyName: string,
    entries: VoucherEntry[]
): string {
    const voucherXml = entries
        .map((entry) => {
            const tallyDate = entry.date.replace(/-/g, ""); // YYYYMMDD
            const isReceipt = entry.type === "Receipt";

            // In Tally:
            // Receipt: Bank Dr (positive inflow), Party Cr
            // Payment: Party Dr, Bank Cr (positive outflow)
            return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${escapeXml(entry.type)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>${escapeXml(entry.type)}</VOUCHERTYPENAME>
          <NARRATION>${escapeXml(entry.narration)}</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(isReceipt ? entry.bankLedger : entry.partyLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isReceipt ? "Yes" : "Yes"}</ISDEEMEDPOSITIVE>
            <AMOUNT>-${entry.amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(isReceipt ? entry.partyLedger : entry.bankLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isReceipt ? "No" : "No"}</ISDEEMEDPOSITIVE>
            <AMOUNT>${entry.amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── Send XML to Tally for Import ────────────────────────────────────────────

export async function sendToTally(
    host: string,
    port: number,
    xml: string
): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
        const response = await fetch(`http://${host}:${port}`, {
            method: "POST",
            headers: { "Content-Type": "text/xml" },
            body: xml,
            signal: AbortSignal.timeout(30000),
        });

        const responseText = await response.text();

        if (!response.ok) {
            return { success: false, error: `Tally returned HTTP ${response.status}` };
        }

        // Check for errors in Tally response
        if (responseText.includes("LINEERROR") || responseText.includes("ERROR")) {
            const errorMatch = responseText.match(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i);
            return {
                success: false,
                response: responseText,
                error: errorMatch ? errorMatch[1] : "Tally returned errors in the response",
            };
        }

        // Check for created count
        const createdMatch = responseText.match(/<CREATED>(\d+)<\/CREATED>/i);
        const created = createdMatch ? parseInt(createdMatch[1]) : 0;

        return {
            success: created > 0,
            response: responseText,
        };
    } catch {
        return {
            success: false,
            error: "Cannot connect to Tally. Make sure TallyPrime is running.",
        };
    }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// ─── Mock Ledgers (for testing without Tally) ─────────────────────────────────

export const MOCK_LEDGERS = [
    { name: "Cash", group: "Cash-in-Hand" },
    { name: "Bank of Baroda", group: "Bank Accounts" },
    { name: "HDFC Bank", group: "Bank Accounts" },
    { name: "ICICI Bank", group: "Bank Accounts" },
    { name: "SBI", group: "Bank Accounts" },
    { name: "Sales Account", group: "Sales Accounts" },
    { name: "Purchase Account", group: "Purchase Accounts" },
    { name: "Salary", group: "Indirect Expenses" },
    { name: "Rent", group: "Indirect Expenses" },
    { name: "Office Expenses", group: "Indirect Expenses" },
    { name: "Telephone Expenses", group: "Indirect Expenses" },
    { name: "Electricity Expenses", group: "Indirect Expenses" },
    { name: "Professional Fees", group: "Indirect Expenses" },
    { name: "Bank Charges", group: "Indirect Expenses" },
    { name: "Interest Received", group: "Indirect Incomes" },
    { name: "Interest Paid", group: "Indirect Expenses" },
    { name: "GST Input CGST", group: "Duties & Taxes" },
    { name: "GST Input SGST", group: "Duties & Taxes" },
    { name: "GST Input IGST", group: "Duties & Taxes" },
    { name: "GST Output CGST", group: "Duties & Taxes" },
    { name: "GST Output SGST", group: "Duties & Taxes" },
    { name: "GST Output IGST", group: "Duties & Taxes" },
    { name: "TDS Receivable", group: "Duties & Taxes" },
    { name: "TDS Payable", group: "Duties & Taxes" },
    { name: "Sundry Debtors", group: "Sundry Debtors" },
    { name: "Sundry Creditors", group: "Sundry Creditors" },
    { name: "Capital Account", group: "Capital Account" },
    { name: "Drawings", group: "Capital Account" },
    { name: "Loan Account", group: "Loans (Liability)" },
    { name: "SMS Alert Charges", group: "Indirect Expenses" },
    { name: "IMPS/NEFT Charges", group: "Indirect Expenses" },
    { name: "Miscellaneous Expenses", group: "Indirect Expenses" },
];
