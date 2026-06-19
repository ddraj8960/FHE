import sqlite3

db_path = r"c:\Users\ddraj\OneDrive\Desktop\fhe-5\walletshield.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Count records that will be updated
cur.execute("SELECT COUNT(*) FROM verifications WHERE blockchain_confirmed = 0 AND risk_result IS NULL")
count = cur.fetchone()[0]
print(f"Found {count} unconfirmed verification(s) with NULL risk_result to update to CANCELLED.")

# Update all unconfirmed verifications to CANCELLED
cur.execute("UPDATE verifications SET risk_result = 'CANCELLED' WHERE blockchain_confirmed = 0 AND risk_result IS NULL")
conn.commit()

print(f"Successfully updated {cur.rowcount} record(s) to CANCELLED.")

# Verify
cur.execute("SELECT id, risk_result, blockchain_confirmed FROM verifications WHERE risk_result = 'CANCELLED'")
rows = cur.fetchall()
print(f"\nVerification - {len(rows)} total CANCELLED records:")
for row in rows:
    print(f"  ID: {row[0][:8]}... | risk_result: {row[1]} | blockchain_confirmed: {row[2]}")

conn.close()
