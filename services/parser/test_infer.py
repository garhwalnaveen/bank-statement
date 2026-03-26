import sys

def main():
    try:
        from bank_parser import CANONICAL_FIELDS, match_header, infer_schema, row_to_transaction
        
        headers = ["Date", "Description", "Debit", "Credit", "Balance"]
        schema = infer_schema(headers)
        print("Schema:", schema)
        
        row1 = ["01/01/2026", "Test Withdrawal", "150.00", "", "1000.00"]
        row2 = ["02/01/2026", "Test Deposit", "", "200.00", "1200.00"]
        
        t1 = row_to_transaction(row1, schema)
        t2 = row_to_transaction(row2, schema)
        
        print("T1:", t1)
        print("T2:", t2)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
