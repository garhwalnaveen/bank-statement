"""
Universal Bank Statement Parser v2
====================================
Fixes in v2:
  - Handles single-column merged tables (common in borderless PDFs)
  - Regex splitter decomposes merged rows into proper columns
  - Amount parsing handles £/$/ prefixed values like '$4,800.00', '-$56.32'
  - Balance parsing handles currency-prefixed values
  - Extended bank detection patterns (Deutsche Bank, Starling, IDFC, etc.)
  - Debit/Credit column aliases extended (Paid out/in, Out/In, Money Out/In)
  - Accounting parentheses improved for Wells Fargo
  - Signed-amount column (Amount with +/- prefix) handled
  - Text-line regex fallback for completely unstructured pages
"""

import re
import json
import csv
import hashlib
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import pdfplumber
from rapidfuzz import fuzz, process

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger("bank_parser")

# ---------------------------------------------------------------------------
# Canonical schema & field aliases
# ---------------------------------------------------------------------------

CANONICAL_FIELDS = {
    "date": [
        "date", "transaction date", "txn date", "value date", "posting date",
        "trans date", "tran date", "dt", "effective date", "posted date",
        "post date", "booking date", "buchungstag", "value dt",
    ],
    "description": [
        "description", "narration", "particulars", "details", "reference",
        "transaction details", "transaction description", "remarks", "memo",
        "payee", "transaction narration", "beneficiary", "narrative",
        "payment type", "merchant / description", "reference / description",
        "payee / description", "transaction", "verwendungszweck",
    ],
    "debit": [
        "debit", "withdrawal", "dr", "debit amount", "amount (dr)",
        "withdrawals", "payments", "paid out", "money out", "debit(inr)",
        "amount debited", "debit(rs)", "withdrawal amount", "out",
        "withdrawals/debits", "debit amt", "withdrawal amt(inr)",
        "betrag",
    ],
    "credit": [
        "credit", "deposit", "cr", "credit amount", "amount (cr)",
        "deposits", "receipts", "paid in", "money in", "credit(inr)",
        "amount credited", "credit(rs)", "deposit amount", "in",
        "deposits/credits", "credit amt", "deposit amt(inr)",
    ],
    "amount": [
        "amount", "transaction amount", "net amount", "value", "sum",
        "transaction\namount", "amount (gbp)", "amount (usd)", "amount (eur)",
        "amount (inr)", "betrag (eur)", "betrag", "saldo",
    ],
    "balance": [
        "balance", "running balance", "closing balance", "available balance",
        "ledger balance", "bal", "balance (inr)", "balance(rs)",
        "ending daily balance", "running\nbalance", "saldo (eur)",
        "available bal",
    ],
    "reference": [
        "ref", "reference no", "chq no", "cheque number", "utr",
        "transaction id", "txn id", "transaction ref", "cheque no",
        "instrument no", "ref no", "transaction number", "chqno",
        "ref/chq", "ref no/cheque no",
    ],
}

CANONICAL_KEYS = ["date", "description", "debit", "credit", "amount", "balance", "reference"]

# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class Transaction:
    date: Optional[str] = None
    description: Optional[str] = None
    debit: Optional[float] = None
    credit: Optional[float] = None
    amount: Optional[float] = None
    balance: Optional[float] = None
    reference: Optional[str] = None
    raw: dict = field(default_factory=dict)


@dataclass
class StatementMetadata:
    bank: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    currency: Optional[str] = None
    source_file: Optional[str] = None


@dataclass
class ParsedStatement:
    metadata: StatementMetadata
    transactions: list
    schema_map: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    validation: object = None  # ValidationReport, set after parse()


# ---------------------------------------------------------------------------
# Template cache
# ---------------------------------------------------------------------------

_template_cache: dict = {}

def _fingerprint(headers: list) -> str:
    key = "|".join(sorted(h.lower().strip() for h in headers if h))
    return hashlib.md5(key.encode()).hexdigest()

# ---------------------------------------------------------------------------
# PDF Text Extraction
# ---------------------------------------------------------------------------

def _is_scanned(page) -> bool:
    text = page.extract_text() or ""
    return len(text.strip()) < 50


def _ocr_page(page) -> str:
    try:
        import pytesseract
        return pytesseract.image_to_string(page.to_image(resolution=300).original)
    except Exception as e:
        log.warning(f"OCR failed: {e}")
        return ""


def extract_text_from_pdf(pdf_path: str) -> list:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            if _is_scanned(page):
                log.info(f"Page {i+1} appears scanned - using OCR")
                text = _ocr_page(page)
                tables, words = [], []
            else:
                text = page.extract_text() or ""
                tables = page.extract_tables() or []
                words = page.extract_words() or []
            pages.append({"page_num": i+1, "text": text, "tables": tables, "words": words})
    return pages


# ---------------------------------------------------------------------------
# Header Matching
# ---------------------------------------------------------------------------

def match_header(header: str, threshold: int = 72) -> Optional[str]:
    if not header:
        return None
    h = header.lower().strip().replace("\n", " ").strip()

    for canon, aliases in CANONICAL_FIELDS.items():
        if h in aliases:
            return canon

    best_canon, best_score = None, 0
    for canon, aliases in CANONICAL_FIELDS.items():
        result = process.extractOne(h, aliases, scorer=fuzz.token_sort_ratio)
        if result and result[1] > best_score:
            best_score, best_canon = result[1], canon

    if best_score >= threshold:
        return best_canon
    return None


def infer_schema(headers: list) -> dict:
    fp = _fingerprint(headers)
    if fp in _template_cache:
        return _template_cache[fp]

    schema, used = {}, set()
    for i, h in enumerate(headers):
        canon = match_header(h)
        if canon and canon not in used:
            schema[i] = canon
            used.add(canon)

    _template_cache[fp] = schema
    log.info(f"Inferred schema: { {headers[i]: v for i, v in schema.items()} }")
    return schema


# ---------------------------------------------------------------------------
# Amount Parsing
# ---------------------------------------------------------------------------

def parse_amount(value: str) -> Optional[float]:
    """
    Parse amounts in various formats:
      $4,800.00  ->  4800.00
      -$56.32    ->  -56.32
      (2,450.00) ->  -2450.00   (accounting negative)
      1,234.56 Dr -> -1234.56
      1,234.56 Cr ->  1234.56
      1.234,56   ->  1234.56   (European)
      +$150.00   ->  150.00
    """
    if not value:
        return None
    v = str(value).strip()
    if v in ("-", "", "N/A", "nil", "—", "–", " "):
        return None

    negative = False

    # Accounting negative: (xxx)
    if re.match(r'^\(.*\)$', v):
        negative = True
        v = v[1:-1].strip()

    # Dr/Cr suffix
    suffix = ""
    m = re.search(r'\s*(Dr|Cr|DR|CR|dr|cr)$', v)
    if m:
        suffix = m.group(1).upper()
        v = v[:m.start()].strip()

    # Leading sign
    sign = 1
    if v.startswith('+'):
        v = v[1:]
    elif v.startswith('-'):
        sign = -1
        v = v[1:]

    # Strip currency symbols
    v = re.sub(r'[£$€₹\s]', '', v)

    # European format: 1.234,56 (dot-thousands, comma-decimal)
    if re.match(r"^\d{1,3}(\.\d{3})+(,\d{1,2})?$", v):
        v = v.replace(".", "").replace(",", ".")
    elif re.match(r"^\d+,\d{1,2}$", v):
        # Simple European decimal: 89,50 -> 89.50
        v = v.replace(",", ".")
    else:
        v = v.replace(",", "")

    try:
        amount = float(v) * sign
        if negative or suffix == "DR":
            return -abs(amount)
        elif suffix == "CR":
            return abs(amount)
        return amount
    except ValueError:
        return None


def normalize_date(date_str: str) -> Optional[str]:
    if not date_str:
        return None
    s = date_str.strip()
    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y",
        "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
        "%d/%m/%y", "%m/%d/%y", "%d-%m-%y", "%d.%m.%Y", "%d.%m.%y",
        "%Y/%m/%d", "%d-%b-%y", "%d-%b-%Y", "%d %b %y",
        "%d %b", "%b %d",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(s, fmt)
            if parsed.year == 1900:
                parsed = parsed.replace(year=2024)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


# ---------------------------------------------------------------------------
# Single-column merged-row splitter
# ---------------------------------------------------------------------------

_DATE_AT_START = re.compile(
    r'^(\d{1,2}[-./]\d{1,2}[-./]\d{2,4}'
    r'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}'
    r'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b'
    r'|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})',
    re.IGNORECASE
)


def _split_merged_row(row_text: str, n_cols: int) -> list:
    """Split a merged single-string row into n_cols cells."""
    s = row_text.strip()
    date_part, rest = "", s

    dm = _DATE_AT_START.match(s)
    if dm:
        date_part = dm.group(0)
        rest = s[dm.end():].strip()

    # Extract trailing amounts
    amounts = []
    for _ in range(n_cols - 2):
        am = re.search(
            r'\s+([£$€₹]?[+-]?\(?\d[\d,\.]+\)?(?:\s*(?:Dr|Cr|DR|CR))?)$',
            rest, re.IGNORECASE
        )
        if not am:
            break
        amounts.insert(0, am.group(1).strip())
        rest = rest[:am.start()].strip()

    description = rest.strip()
    cells = [""] * n_cols

    if date_part:
        cells[0] = date_part
    if description:
        cells[1] = description

    for j, a in enumerate(reversed(amounts)):
        idx = n_cols - 1 - j
        if idx > 1:
            cells[idx] = a

    return cells


def _split_table_merged_rows(table: list) -> list:
    """If table is single-column, split each row into multiple columns."""
    if not table:
        return table

    if not all(len(row) == 1 for row in table):
        return table

    # Estimate column count from first row
    n_cols = 5
    first = table[0][0] if table[0] else ""
    parts = re.split(r'\s{2,}', first)
    matched = sum(1 for p in parts if match_header(p) is not None)
    if matched >= 2:
        n_cols = max(len(parts), 4)
    else:
        # Guess from data row 1
        if len(table) > 1:
            test = table[1][0] if table[1] else ""
            amounts = re.findall(r'[£$€₹]?[+-]?\(?\d[\d,\.]+\)?(?:\s*(?:Dr|Cr))?', test)
            n_cols = max(3 + len(amounts), 4)

    return [_split_merged_row(row[0] if row else "", n_cols) for row in table]


# ---------------------------------------------------------------------------
# Table Extraction Strategies
# ---------------------------------------------------------------------------

def _extract_from_bordered_tables(tables: list) -> tuple:
    for table in tables:
        if not table or len(table) < 2:
            continue

        table = _split_table_merged_rows(table)

        for i, row in enumerate(table):
            non_empty = [c for c in row if c and str(c).strip()]
            if len(non_empty) < 2:
                continue
            headers = [str(c).strip() if c else "" for c in row]
            matched = sum(1 for h in headers if match_header(h) is not None)
            if matched >= 2:
                data_rows = [
                    [str(c).strip() if c else "" for c in r]
                    for r in table[i+1:]
                    if any(c and str(c).strip() for c in r)
                ]
                return headers, data_rows

    return [], []


def _cluster_by_columns(words: list, row_tolerance: int = 5, col_gap: int = 20) -> tuple:
    if not words:
        return [], []

    rows_dict = {}
    for word in words:
        y = round(word["top"] / row_tolerance) * row_tolerance
        rows_dict.setdefault(y, []).append(word)

    sorted_rows = [sorted(rows_dict[y], key=lambda w: w["x0"]) for y in sorted(rows_dict)]

    if len(sorted_rows) < 2:
        return [], []

    all_x = sorted(set(round(w["x0"]) for row in sorted_rows[:10] for w in row))
    col_buckets = []
    for x in all_x:
        if not col_buckets or x - col_buckets[-1] > col_gap:
            col_buckets.append(x)

    def words_to_cols(row_words, buckets):
        cells = [""] * len(buckets)
        for w in row_words:
            best = min(range(len(buckets)), key=lambda i: abs(buckets[i] - w["x0"]))
            cells[best] = (cells[best] + " " + w["text"]).strip()
        return cells

    all_cell_rows = [words_to_cols(r, col_buckets) for r in sorted_rows]

    header_idx, best_match_count = 0, 0
    for i, row in enumerate(all_cell_rows[:10]):
        matches = sum(1 for cell in row if match_header(cell) is not None)
        if matches > best_match_count:
            best_match_count, header_idx = matches, i

    if best_match_count < 2:
        return [], []

    return all_cell_rows[header_idx], all_cell_rows[header_idx + 1:]


# ---------------------------------------------------------------------------
# Metadata Extraction
# ---------------------------------------------------------------------------

_BANK_PATTERNS = [
    (r"HDFC Bank", "HDFC Bank"),
    (r"State Bank of India|SBI(?!\w)", "SBI"),
    (r"ICICI Bank", "ICICI Bank"),
    (r"Axis Bank", "Axis Bank"),
    (r"Kotak Mahindra|kotak", "Kotak Mahindra Bank"),
    (r"Punjab National Bank|PNB(?!\w)", "PNB"),
    (r"Bank of Baroda", "Bank of Baroda"),
    (r"IDFC FIRST|IDFC First", "IDFC First Bank"),
    (r"Chase|JPMorgan", "Chase"),
    (r"Bank of America|BofA", "Bank of America"),
    (r"Wells Fargo", "Wells Fargo"),
    (r"Citibank|Citi Bank|Citigold", "Citibank"),
    (r"Barclays", "Barclays"),
    (r"HSBC", "HSBC"),
    (r"Lloyds", "Lloyds Bank"),
    (r"NatWest", "NatWest"),
    (r"Nationwide", "Nationwide"),
    (r"Monzo", "Monzo"),
    (r"Starling Bank", "Starling Bank"),
    (r"Deutsche Bank", "Deutsche Bank"),
    (r"Revolut", "Revolut"),
]


def extract_metadata(pages: list, source_file: str) -> StatementMetadata:
    meta = StatementMetadata(source_file=source_file)
    full_text = "\n".join(p["text"] for p in pages[:2])

    for pattern, name in _BANK_PATTERNS:
        if re.search(pattern, full_text, re.IGNORECASE):
            meta.bank = name
            break

    acc_match = re.search(
        r'(?:account\s*(?:number|no|#|:)|a/c\s*no)[:\s]*([\dX*]+)',
        full_text, re.IGNORECASE
    )
    if acc_match:
        meta.account_number = acc_match.group(1).strip()

    holder_match = re.search(
        r'(?:name|account\s*holder|customer\s*name|kontoinhaber)[:\s]+([A-Z][A-Za-z\s\.]+?)(?:\n|$|\|)',
        full_text, re.IGNORECASE
    )
    if holder_match:
        meta.account_holder = holder_match.group(1).strip()

    date_pattern = r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})'
    period_match = re.search(
        rf'(?:from|period|zeitraum)[:\s]+{date_pattern}\s+(?:to|–|-|bis)\s+{date_pattern}',
        full_text, re.IGNORECASE
    )
    if period_match:
        meta.period_from = normalize_date(period_match.group(1))
        meta.period_to = normalize_date(period_match.group(2))

    if re.search(r'[₹]|INR|Rs\.', full_text):
        meta.currency = "INR"
    elif re.search(r'£|GBP', full_text):
        meta.currency = "GBP"
    elif re.search(r'€|EUR|Währung.*EUR', full_text, re.IGNORECASE):
        meta.currency = "EUR"
    elif re.search(r'\$|USD', full_text):
        meta.currency = "USD"

    return meta


# ---------------------------------------------------------------------------
# Row → Transaction
# ---------------------------------------------------------------------------

def row_to_transaction(row: list, schema: dict) -> Optional[Transaction]:
    if not any(c.strip() for c in row):
        return None

    raw = {schema.get(i, f"col_{i}"): v for i, v in enumerate(row)}
    t = Transaction(raw=raw)

    for col_idx, canon in schema.items():
        if col_idx >= len(row):
            continue
        val = row[col_idx].strip()
        if not val:
            continue

        if canon == "date":
            t.date = normalize_date(val)
        elif canon == "description":
            t.description = val
        elif canon == "debit":
            t.debit = parse_amount(val)
        elif canon == "credit":
            t.credit = parse_amount(val)
        elif canon == "amount":
            t.amount = parse_amount(val)
        elif canon == "balance":
            t.balance = parse_amount(val)
        elif canon == "reference":
            t.reference = val

    # Derive signed amount
    if t.amount is None:
        if t.debit is not None and t.debit != 0:
            t.amount = -abs(t.debit)
        elif t.credit is not None and t.credit != 0:
            t.amount = abs(t.credit)

    # For signed-amount columns (e.g. Chase "+$5,500", "-$300")
    if t.amount is not None and t.debit is None and t.credit is None:
        if t.amount < 0:
            t.debit = abs(t.amount)
        elif t.amount > 0:
            t.credit = t.amount

    return t


def _is_valid_transaction(t: Transaction) -> bool:
    return t is not None and (t.date is not None or t.amount is not None or t.balance is not None)


# ---------------------------------------------------------------------------
# Main Parser
# ---------------------------------------------------------------------------

class BankStatementParser:
    """
    Universal bank statement parser.

    Usage:
        parser = BankStatementParser()
        result = parser.parse("statement.pdf")
        parser.to_json(result, "output.json")
        parser.to_csv(result, "output.csv")
    """

    def __init__(self, llm_fallback: bool = False, llm_api_key: str = None):
        self.llm_fallback = llm_fallback
        self.llm_api_key = llm_api_key

    def parse(self, pdf_path: str) -> ParsedStatement:
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        log.info(f"Parsing: {path.name}")
        pages = extract_text_from_pdf(pdf_path)
        metadata = extract_metadata(pages, source_file=path.name)

        if metadata.bank:
            log.info(f"Detected bank: {metadata.bank}")

        transactions, schema_map, warnings = [], {}, []

        for page in pages:
            extracted = False

            # Strategy 1: Bordered / structured tables (incl. merged-row tables)
            if page["tables"]:
                headers, data_rows = _extract_from_bordered_tables(page["tables"])
                if headers:
                    schema = infer_schema(headers)
                    if len(schema) >= 2:
                        log.info(f"Page {page['page_num']}: Table extraction ({len(data_rows)} rows)")
                        schema_map = schema
                        for row in data_rows:
                            t = row_to_transaction(row, schema)
                            if t and _is_valid_transaction(t):
                                transactions.append(t)
                        extracted = True

            # Strategy 2: Whitespace column clustering
            if not extracted and page["words"]:
                headers, data_rows = _cluster_by_columns(page["words"])
                if headers and len(infer_schema(headers)) >= 2:
                    schema = infer_schema(headers)
                    schema_map = schema
                    log.info(f"Page {page['page_num']}: Column clustering ({len(data_rows)} rows)")
                    for row in data_rows:
                        t = row_to_transaction(row, schema)
                        if t and _is_valid_transaction(t):
                            transactions.append(t)
                    extracted = True

            # Strategy 3: Text-line parsing
            if not extracted and page["text"]:
                # Try Kotak Dr/Cr format first (detects (Dr)/(Cr) suffix pattern)
                dr_cr_amounts = re.findall(r'\d[\d,]*\.\d{2}\((Dr|Cr)\)', page["text"], re.IGNORECASE)
                if len(dr_cr_amounts) >= 4:
                    log.info(f"Page {page['page_num']}: Kotak Dr/Cr format detected")
                    txns = self._parse_kotak_dr_cr_format(page["text"])
                else:
                    log.info(f"Page {page['page_num']}: Text-line regex fallback")
                    txns = self._regex_parse_text(page["text"])
                transactions.extend(txns)
                if txns:
                    extracted = True

            # Strategy 4: LLM fallback
            if not extracted and self.llm_fallback and page["text"]:
                log.info(f"Page {page['page_num']}: LLM extraction")
                transactions.extend(self._llm_extract(page["text"]))
                extracted = True

            if not extracted:
                warnings.append(f"Page {page['page_num']}: Could not extract table data")

        # Deduplicate
        seen, unique = set(), []
        for t in transactions:
            key = (t.date, t.description, t.amount, t.balance)
            if key not in seen:
                seen.add(key)
                unique.append(t)

        if unique:
            balances = [t.balance for t in unique if t.balance is not None]
            if balances:
                metadata.opening_balance = balances[0]
                metadata.closing_balance = balances[-1]

        log.info(f"Extracted {len(unique)} transactions")

        # Run balance validation
        validation = validate_balances(unique)

        # Auto-correct sign errors detected by the validator
        corrected, was_corrected = _autocorrect_signs(unique, validation)
        if was_corrected:
            unique = corrected
            validation = validate_balances(unique)
            log.info(f"Re-validated after auto-correction")

        if validation.balance_check_possible:
            log.info(f"Balance validation: {validation.rows_passed}/{validation.rows_checked} rows pass "
                     f"({validation.accuracy_pct:.0f}%)")
            if not validation.is_valid:
                for w in validation.warnings:
                    log.warning(f"Balance check: {w}")

        readable_schema = {f"col_{k}": v for k, v in schema_map.items()} if schema_map else {}
        stmt = ParsedStatement(metadata=metadata, transactions=unique,
                               schema_map=readable_schema, warnings=warnings)
        stmt.validation = validation
        return stmt


    def _parse_kotak_dr_cr_format(self, text: str) -> list:
        """
        Parse Kotak-style statements where every amount ends in (Dr) or (Cr).
        Format per line:
          DD-MM-YYYY  NARRATION  [REF]  AMOUNT(Dr/Cr)  BALANCE(Cr)
        Continuation lines (no date) are merged into the previous transaction.
        """
        DR_CR_AMOUNT = re.compile(r'(\d[\d,]*\.\d{2})\((Dr|Cr)\)', re.IGNORECASE)
        DATE_START   = re.compile(r'^(\d{2}-\d{2}-\d{4})\s+')

        # Pre-merge continuation lines
        raw = [l.rstrip() for l in text.split("\n")]
        merged = []
        for line in raw:
            if not line.strip():
                continue
            if DATE_START.match(line.strip()):
                merged.append(line.strip())
            elif merged:
                merged[-1] += " " + line.strip()
            # else: header / metadata line, skip

        txns = []
        for line in merged:
            dm = DATE_START.match(line)
            if not dm:
                continue

            date = normalize_date(dm.group(1))
            rest = line[dm.end():].strip()

            # Find all (Dr)/(Cr) amounts in this line
            matches = list(DR_CR_AMOUNT.finditer(rest))
            if not matches:
                continue

            # Last amount = balance, second-to-last = transaction amount
            bal_m   = matches[-1]
            amt_m   = matches[-2] if len(matches) >= 2 else None

            balance = parse_amount(bal_m.group(1))   # always Cr for balance

            amount = None
            debit = credit = None
            if amt_m:
                raw_amt = parse_amount(amt_m.group(1))
                suffix  = amt_m.group(2).upper()
                if suffix == "DR":
                    debit  = raw_amt
                    amount = -(raw_amt or 0)
                else:
                    credit = raw_amt
                    amount = raw_amt

            # Description = text before the first amount match, strip trailing ref
            desc_end = matches[0].start()
            desc_raw = rest[:desc_end].strip()

            # Reference: last whitespace-separated token before first amount if it looks like a ref
            ref = None
            parts = desc_raw.rsplit(None, 1)
            if len(parts) == 2:
                candidate = parts[1]
                # Ref tokens: all caps/digits/slashes, or pure digits (account numbers)
                if re.match(r'^[A-Z0-9/\-]{3,}$', candidate) or re.match(r'^\d{5,}$', candidate):
                    ref = candidate
                    desc_raw = parts[0].strip()

            t = Transaction(
                date=date,
                description=desc_raw or None,
                debit=debit,
                credit=credit,
                amount=amount,
                balance=balance,
                reference=ref,
            )
            txns.append(t)

        return txns

    def _regex_parse_text(self, text: str) -> list:
        """Scan text line-by-line for date + amount patterns.
        Handles:
        - Kotak-style Withdrawal (Dr)/Deposit (Cr) combined column
        - Multi-line narration / reference continuation
        - Dr/Cr suffix amounts
        """
        txns = []
        date_re = re.compile(
            r'^(\d{1,2}[-./]\d{1,2}[-./]\d{2,4}'
            r'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}'
            r'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b'
            r'|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})',
            re.IGNORECASE
        )
        amount_re = re.compile(r'[£$€₹]?[+-]?\(?\d[\d,\.]+\)?(?:\s*(?:Dr|Cr|DR|CR))?')

        # Pre-process: join continuation lines (lines with no date and no amounts) 
        # into the previous date-line so wrapped narrations/refs are merged
        raw_lines = text.split("\n")
        merged_lines = []
        for line in raw_lines:
            line = line.strip()
            if not line:
                continue
            if date_re.match(line):
                merged_lines.append(line)
            elif merged_lines and not date_re.match(line):
                # Check if this looks like a continuation (no date at start, has non-amount text)
                amounts_in_line = amount_re.findall(line)
                has_new_amounts = len(amounts_in_line) >= 2  # new txn row has >=2 amounts
                if not has_new_amounts:
                    # Continuation line — append to previous
                    merged_lines[-1] = merged_lines[-1] + " " + line
                else:
                    merged_lines.append(line)
            else:
                merged_lines.append(line)

        for line in merged_lines:
            dm = date_re.match(line)
            if not dm:
                continue
            date = normalize_date(dm.group(1))
            rest = line[dm.end():].strip()

            amounts = amount_re.findall(rest)
            if not amounts:
                continue

            balance = parse_amount(amounts[-1]) if amounts else None
            main_amount = parse_amount(amounts[-2]) if len(amounts) >= 2 else None

            # Description is text before the first amount token
            desc_start = rest.find(amounts[0]) if amounts else len(rest)
            raw_desc = rest[:desc_start].strip()

            # For Kotak-style: description may contain embedded ref (everything before last whitespace-amount)
            # Grab the ref as the token right before the first amount
            ref = None
            desc_parts = raw_desc.rsplit(None, 1)
            if len(desc_parts) == 2:
                # Check if last word looks like a reference number
                candidate = desc_parts[1]
                if re.match(r'^[A-Z0-9/\-]+$', candidate) and len(candidate) > 4 and not re.match(r'^\d+\.\d+$', candidate):
                    description = desc_parts[0].strip()
                    ref = candidate
                else:
                    description = raw_desc
            else:
                description = raw_desc

            t = Transaction(date=date, description=description or None,
                            balance=balance, reference=ref)
            if main_amount is not None:
                if main_amount < 0:
                    t.debit = abs(main_amount)
                    t.amount = main_amount
                else:
                    t.credit = main_amount
                    t.amount = main_amount
            txns.append(t)

        return txns

    def _llm_extract(self, text: str) -> list:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.llm_api_key)
            prompt = f"""Extract all transactions from this bank statement text.
Return ONLY a JSON array with fields: date (YYYY-MM-DD), description, debit, credit, balance, reference.

{text[:4000]}

Return only valid JSON array, no explanation."""
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = re.sub(r"```json|```", "", msg.content[0].text).strip()
            data = json.loads(raw)
            txns = []
            for item in data:
                t = Transaction(
                    date=item.get("date"), description=item.get("description"),
                    debit=item.get("debit"), credit=item.get("credit"),
                    balance=item.get("balance"), reference=item.get("reference"), raw=item
                )
                if t.debit:
                    t.amount = -abs(t.debit)
                elif t.credit:
                    t.amount = abs(t.credit)
                txns.append(t)
            return txns
        except Exception as e:
            log.warning(f"LLM extraction failed: {e}")
            return []

    # -----------------------------------------------------------------------
    # Output methods
    # -----------------------------------------------------------------------

    def to_dict(self, statement: ParsedStatement) -> dict:
        d = {
            "metadata": asdict(statement.metadata),
            "schema_map": statement.schema_map,
            "warnings": statement.warnings,
            "transaction_count": len(statement.transactions),
            "validation": validation_report_to_dict(statement.validation) if statement.validation else None,
            "transactions": [
                {"date": t.date, "description": t.description, "debit": t.debit,
                 "credit": t.credit, "amount": t.amount, "balance": t.balance,
                 "reference": t.reference, "raw": t.raw}
                for t in statement.transactions
            ],
        }
        return d

    def to_json(self, statement: ParsedStatement, output_path: str, indent: int = 2) -> str:
        Path(output_path).write_text(
            json.dumps(self.to_dict(statement), indent=indent, ensure_ascii=False)
        )
        log.info(f"JSON written to: {output_path}")
        return output_path

    def to_csv(self, statement: ParsedStatement, output_path: str) -> str:
        fieldnames = ["date", "description", "amount", "debit", "credit", "balance", "reference"]
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for t in statement.transactions:
                writer.writerow({
                    "date": t.date, "description": t.description, "amount": t.amount,
                    "debit": t.debit, "credit": t.credit,
                    "balance": t.balance, "reference": t.reference
                })
        log.info(f"CSV written to: {output_path}")
        return output_path

    def summary(self, statement: ParsedStatement) -> str:
        m = statement.metadata
        txns = statement.transactions
        lines = [
            "=" * 60, "BANK STATEMENT SUMMARY", "=" * 60,
            f"Bank:            {m.bank or 'Unknown'}",
            f"Account:         {m.account_number or 'Unknown'}",
            f"Account Holder:  {m.account_holder or 'Unknown'}",
            f"Currency:        {m.currency or 'Unknown'}",
            f"Period:          {m.period_from or '?'} --> {m.period_to or '?'}",
            f"Opening Balance: {m.opening_balance}",
            f"Closing Balance: {m.closing_balance}",
            f"Transactions:    {len(txns)}", "-" * 60,
        ]
        if txns:
            total_debit  = sum(t.debit  or 0 for t in txns)
            total_credit = sum(t.credit or 0 for t in txns)
            lines += [f"Total Debits:    {total_debit:,.2f}",
                      f"Total Credits:   {total_credit:,.2f}", "-" * 60,
                      "First 5 Transactions:"]
            for t in txns[:5]:
                lines.append(
                    f"  {t.date or '?':12} | {(t.description or '')[:40]:40} | {t.amount or 0:>12.2f}"
                )
        if statement.warnings:
            lines += ["-" * 60, "Warnings:"] + [f"  !  {w}" for w in statement.warnings]
        if statement.validation:
            lines.append(validation_summary_text(statement.validation))
        else:
            lines.append("=" * 60)
        return "\n".join(lines)


# ===========================================================================
# Balance Validation Engine
# ===========================================================================

TOLERANCE = 0.02  # Accept floating point rounding up to 2 paise/cents


@dataclass
class RowValidation:
    """Per-transaction validation result."""
    index: int
    date: Optional[str]
    description: Optional[str]
    expected_balance: Optional[float]   # balance carried from previous row + this txn
    actual_balance: Optional[float]     # balance as parsed from PDF
    delta: Optional[float]              # actual - expected
    status: str                         # "OK" | "MISMATCH" | "SKIP" | "NO_BALANCE" | "NO_AMOUNT"
    note: str = ""


@dataclass  
class ValidationReport:
    """Full balance validation report for a statement."""
    is_valid: bool                          # True if ALL checkable rows pass
    balance_check_possible: bool            # False if no balance column at all
    rows_checked: int
    rows_passed: int
    rows_failed: int
    rows_skipped: int                       # Opening/closing/header rows
    accuracy_pct: float                     # rows_passed / rows_checked * 100
    opening_balance: Optional[float]
    closing_balance_expected: Optional[float]
    closing_balance_actual: Optional[float]
    closing_balance_match: bool
    row_results: list                       # list[RowValidation]
    warnings: list


def _round2(v: Optional[float]) -> Optional[float]:
    return round(v, 2) if v is not None else None


def _is_summary_row(t: Transaction) -> bool:
    """Skip opening/closing balance rows — they don't represent movements."""
    desc = (t.description or "").lower()
    keywords = [
        "opening balance", "closing balance", "balance b/f", "balance c/f",
        "balance carried forward", "balance brought forward",
        "opening bal", "closing bal", "anfangssaldo", "schlusssaldo",
        "b/f", "c/f",
    ]
    return any(k in desc for k in keywords)


def validate_balances(transactions: list, tolerance: float = TOLERANCE) -> ValidationReport:
    """
    Walk through every transaction and verify:
        previous_balance + credit - debit  ==  current_balance

    Returns a ValidationReport with per-row details and an overall verdict.

    Edge cases handled:
    - Opening/closing balance rows are skipped (no movement)
    - Rows missing a balance are noted but don't fail validation
    - Rows missing both debit and credit are noted as SKIP
    - Floating point rounding within `tolerance` is treated as OK
    - Detects sign-flip errors (amount parsed as debit instead of credit)
    - Detects magnitude errors (e.g., 1,000 parsed as 10,000)
    """
    rows_checked = rows_passed = rows_failed = rows_skipped = 0
    row_results = []
    validation_warnings = []

    # Filter to rows that have a balance — these are the checkable ones
    checkable = [t for t in transactions if t.balance is not None]

    if not checkable:
        return ValidationReport(
            is_valid=False,
            balance_check_possible=False,
            rows_checked=0, rows_passed=0, rows_failed=0, rows_skipped=0,
            accuracy_pct=0.0,
            opening_balance=None,
            closing_balance_expected=None,
            closing_balance_actual=None,
            closing_balance_match=False,
            row_results=[],
            warnings=["No balance column found — cannot validate"],
        )

    # Find opening balance: use first summary row OR first transaction's balance
    opening_balance = None
    start_idx = 0

    for i, t in enumerate(checkable):
        if _is_summary_row(t):
            opening_balance = t.balance
            start_idx = i + 1
            rows_skipped += 1
            row_results.append(RowValidation(
                index=transactions.index(t),
                date=t.date, description=t.description,
                expected_balance=None, actual_balance=t.balance,
                delta=None, status="SKIP", note="Opening/summary row"
            ))
            break

    # If no explicit opening balance row found, infer from first row
    if opening_balance is None and checkable:
        first = checkable[0]
        if first.amount is not None:
            # Work backwards: opening = first_balance - first_amount
            opening_balance = _round2((first.balance or 0) - (first.amount or 0))
        else:
            opening_balance = first.balance
            start_idx = 1

    running_balance = opening_balance

    for t in checkable[start_idx:]:
        txn_idx = transactions.index(t)

        # Skip summary rows
        if _is_summary_row(t):
            rows_skipped += 1
            row_results.append(RowValidation(
                index=txn_idx, date=t.date, description=t.description,
                expected_balance=None, actual_balance=t.balance,
                delta=None, status="SKIP", note="Closing/summary row"
            ))
            continue

        actual_bal = _round2(t.balance)

        # Can we check this row?
        has_movement = (t.debit is not None and t.debit != 0) or \
                       (t.credit is not None and t.credit != 0) or \
                       (t.amount is not None and t.amount != 0)

        if not has_movement:
            row_results.append(RowValidation(
                index=txn_idx, date=t.date, description=t.description,
                expected_balance=_round2(running_balance),
                actual_balance=actual_bal,
                delta=None, status="NO_AMOUNT",
                note="No amount/debit/credit — cannot compute expected balance"
            ))
            # Still trust the printed balance for continuity
            if actual_bal is not None:
                running_balance = actual_bal
            continue

        # Compute expected balance
        if t.debit is not None and t.credit is not None:
            movement = (t.credit or 0) - (t.debit or 0)
        elif t.amount is not None:
            movement = t.amount
        elif t.debit is not None:
            movement = -(t.debit)
        elif t.credit is not None:
            movement = t.credit
        else:
            movement = 0

        expected_bal = _round2((running_balance or 0) + movement)
        delta = _round2((actual_bal or 0) - (expected_bal or 0)) if actual_bal is not None else None

        rows_checked += 1

        if actual_bal is None:
            status = "NO_BALANCE"
            note = "Balance not parsed for this row"
            # Don't update running balance — keep carrying forward
        elif abs(delta) <= tolerance:
            status = "OK"
            note = ""
            rows_passed += 1
            running_balance = actual_bal
        else:
            status = "MISMATCH"
            rows_failed += 1
            # Diagnose the error
            if abs(delta + 2 * movement) <= tolerance:
                note = f"Sign error: amount may be Dr instead of Cr (or vice versa). delta={delta:+.2f}"
            elif movement != 0 and abs(delta / movement - 1) < 0.15:
                note = f"Possible rounding/FP issue. delta={delta:+.2f}"
            elif movement != 0 and abs(abs(delta) / abs(movement) - 10) < 2:
                note = f"Magnitude error: amount may be 10x off. delta={delta:+.2f}"
            else:
                note = f"Balance mismatch. Expected {expected_bal}, got {actual_bal}. delta={delta:+.2f}"
            validation_warnings.append(
                f"Row {txn_idx} ({t.date} | {(t.description or '')[:30]}): {note}"
            )
            # Reset running balance to actual to avoid cascading failures
            running_balance = actual_bal

        row_results.append(RowValidation(
            index=txn_idx, date=t.date, description=t.description,
            expected_balance=expected_bal, actual_balance=actual_bal,
            delta=delta, status=status, note=note
        ))

    # Check closing balance
    closing_actual = checkable[-1].balance if checkable else None
    closing_expected = _round2(running_balance)
    closing_match = (
        closing_actual is not None and
        closing_expected is not None and
        abs(closing_actual - closing_expected) <= tolerance
    )

    accuracy = (rows_passed / rows_checked * 100) if rows_checked > 0 else 0.0

    return ValidationReport(
        is_valid=(rows_failed == 0 and rows_checked > 0),
        balance_check_possible=True,
        rows_checked=rows_checked,
        rows_passed=rows_passed,
        rows_failed=rows_failed,
        rows_skipped=rows_skipped,
        accuracy_pct=round(accuracy, 1),
        opening_balance=_round2(opening_balance),
        closing_balance_expected=closing_expected,
        closing_balance_actual=closing_actual,
        closing_balance_match=closing_match,
        row_results=row_results,
        warnings=validation_warnings,
    )


def validation_report_to_dict(report: ValidationReport) -> dict:
    """Serialize ValidationReport to a plain dict (for JSON output)."""
    return {
        "is_valid": report.is_valid,
        "balance_check_possible": report.balance_check_possible,
        "summary": {
            "rows_checked": report.rows_checked,
            "rows_passed": report.rows_passed,
            "rows_failed": report.rows_failed,
            "rows_skipped": report.rows_skipped,
            "accuracy_pct": report.accuracy_pct,
        },
        "balances": {
            "opening": report.opening_balance,
            "closing_expected": report.closing_balance_expected,
            "closing_actual": report.closing_balance_actual,
            "closing_match": report.closing_balance_match,
        },
        "warnings": report.warnings,
        "row_results": [
            {
                "row": r.index,
                "date": r.date,
                "description": r.description,
                "expected_balance": r.expected_balance,
                "actual_balance": r.actual_balance,
                "delta": r.delta,
                "status": r.status,
                "note": r.note,
            }
            for r in report.row_results
        ],
    }


def validation_summary_text(report: ValidationReport) -> str:
    """Human-readable validation summary."""
    lines = [
        "",
        "=" * 60,
        "BALANCE VALIDATION REPORT",
        "=" * 60,
    ]

    if not report.balance_check_possible:
        lines.append("  ✗ Cannot validate — no balance column in statement")
        lines.append("=" * 60)
        return "\n".join(lines)

    verdict = "✅ VALID" if report.is_valid else "❌ INVALID"
    lines.append(f"  Verdict          : {verdict}")
    lines.append(f"  Accuracy         : {report.accuracy_pct:.1f}%  "
                 f"({report.rows_passed}/{report.rows_checked} rows match)")
    lines.append(f"  Rows checked     : {report.rows_checked}")
    lines.append(f"  Rows passed      : {report.rows_passed}")
    lines.append(f"  Rows failed      : {report.rows_failed}")
    lines.append(f"  Rows skipped     : {report.rows_skipped}  (summary/header rows)")
    lines.append("-" * 60)
    lines.append(f"  Opening balance  : {report.opening_balance}")
    lines.append(f"  Closing (expected): {report.closing_balance_expected}")
    lines.append(f"  Closing (actual)  : {report.closing_balance_actual}")
    closing_icon = "✓" if report.closing_balance_match else "✗"
    lines.append(f"  Closing match    : {closing_icon}")

    if report.warnings:
        lines.append("-" * 60)
        lines.append("  Mismatches:")
        for w in report.warnings:
            lines.append(f"    ✗ {w}")

    if report.rows_failed == 0 and report.rows_checked > 0:
        lines.append("-" * 60)
        lines.append("  All balance checks passed — extraction is accurate.")

    lines.append("=" * 60)
    return "\n".join(lines)


# ===========================================================================
# Auto-correction: use balance validation to fix sign errors
# ===========================================================================

def _autocorrect_signs(transactions: list, report: ValidationReport) -> tuple:
    """
    When validation detects systematic sign errors (all/most rows show
    'Sign error'), flip debit<->credit for the affected transactions.
    Returns (corrected_transactions, was_corrected: bool).
    """
    if not report or not report.balance_check_possible:
        return transactions, False

    # Count sign-error rows
    sign_errors = [r for r in report.row_results if r.status == "MISMATCH"
                   and "Sign error" in r.note]
    checked_mismatches = [r for r in report.row_results if r.status == "MISMATCH"]

    # Only auto-correct if the majority of mismatches are sign errors
    if len(sign_errors) == 0:
        return transactions, False
    if len(checked_mismatches) == 0 or len(sign_errors) / len(checked_mismatches) < 0.6:
        return transactions, False

    log.info(f"Auto-correcting {len(sign_errors)} sign-error rows (debit/credit swap)")

    error_indices = {r.index for r in sign_errors}
    corrected = []
    for i, t in enumerate(transactions):
        if i in error_indices:
            # Swap debit and credit, flip amount sign
            t2 = Transaction(
                date=t.date, description=t.description,
                debit=t.credit,  # swap
                credit=t.debit,  # swap
                amount=-(t.amount) if t.amount is not None else None,
                balance=t.balance,
                reference=t.reference,
                raw=t.raw,
            )
            corrected.append(t2)
        else:
            corrected.append(t)

    return corrected, True