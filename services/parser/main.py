"""
FastAPI service wrapping the Universal Bank Statement Parser.
Accepts PDF uploads and returns parsed transactions as JSON or CSV.
"""

import os
import csv
import io
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from bank_parser import BankStatementParser

app = FastAPI(
    title="Bank Statement Parser API",
    description="Upload bank statement PDFs and get structured transaction data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = BankStatementParser()

DATA_DIR = Path(os.getenv("DATA_DIR", "/tmp/bankparser_data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    """
    Upload a bank statement PDF and get parsed transactions back.
    Returns JSON with metadata, transactions, validation report, and warnings.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Save uploaded file temporarily
    suffix = ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        statement = parser.parse(tmp_path)
        result = parser.to_dict(statement)
        result["source_filename"] = file.filename
        result["id"] = str(uuid.uuid4())

        return JSONResponse(content=result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/parse-to-csv")
async def parse_to_csv(file: UploadFile = File(...)):
    """
    Upload a bank statement PDF and get a CSV file back directly.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        statement = parser.parse(tmp_path)

        # Generate CSV in memory
        output = io.StringIO()
        fieldnames = ["date", "description", "amount", "debit", "credit", "balance", "reference"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for t in statement.transactions:
            writer.writerow({
                "date": t.date,
                "description": t.description,
                "amount": t.amount,
                "debit": t.debit,
                "credit": t.credit,
                "balance": t.balance,
                "reference": t.reference,
            })

        csv_content = output.getvalue()
        output.close()

        # Create a streaming response
        csv_filename = file.filename.rsplit(".", 1)[0] + "_transactions.csv"
        return StreamingResponse(
            io.BytesIO(csv_content.encode("utf-8")),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{csv_filename}"'
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
