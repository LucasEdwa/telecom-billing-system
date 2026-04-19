# System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Postman / Frontend)                   │
└─────────────┬───────────────────────────┬───────────────────────────────┘
              │ REST API (JSON)           │
              ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│    Security Layer        │   │    Swagger UI (/api-docs) │
│  ┌────────────────────┐  │   └───────────────────────────┘
│  │ Helmet (headers)   │  │
│  │ Rate Limiting      │  │
│  │ CORS               │  │
│  │ Input Sanitization │  │
│  │ JWT Authentication │  │
│  │ API Key Validation │  │
│  └────────────────────┘  │
└─────────────┬────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONTROLLER LAYER                               │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │    User       │ │    Usage     │ │   Billing    │ │    Rate      │  │
│  │  Controller   │ │  Controller  │ │  Controller  │ │  Controller  │  │
│  │              │ │              │ │              │ │              │  │
│  │ POST signup  │ │ POST /calls  │ │ POST generate│ │ PUT /rates   │  │
│  │ POST login   │ │ POST /sms    │ │ GET  /bills  │ │ GET /rates   │  │
│  │ GET  profile │ │ POST /data   │ │ POST /pay    │ │              │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
│         │                │                │                │         │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     BillingService                                │   │
│  │                                                                   │   │
│  │  calculateBill()  ──► Query only unbilled CDRs (billed=FALSE)    │   │
│  │                   ──► Aggregate by type with Decimal.js           │   │
│  │                   ──► Banker's Rounding (ROUND_HALF_EVEN)         │   │
│  │                   ──► Return logIds for atomic marking            │   │
│  │                                                                   │   │
│  │  createBill()     ──► ATOMIC TRANSACTION:                         │   │
│  │                       1. INSERT bill                              │   │
│  │                       2. UPDATE CDRs SET billed=TRUE              │   │
│  │                       3. INSERT ledger CHARGE entry               │   │
│  │                                                                   │   │
│  │  payBill()        ──► SELECT FOR UPDATE (lock) → PAID             │   │
│  │                   ──► INSERT ledger PAYMENT entry                  │   │
│  │                                                                   │   │
│  │  getLedger()      ──► Read immutable audit trail                   │   │
│  │                                                                   │   │
│  │  reconcileLedger()──► Prove every cent: recompute full balance    │   │
│  │                   ──► Cross-check against unpaid bills            │   │
│  │                   ──► Transactional snapshot (REPEATABLE READ)    │   │
│  │                                                                   │   │
│  │  searchBills()    ──► Multi-filter search (date/amount/status)    │   │
│  │                   ──► Composite index-backed (O(log n))           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    DeadLetterService                               │   │
│  │                                                                   │   │
│  │  enqueue()        ──► Persist failed CDR with error context       │   │
│  │  getPending()     ──► Admin: view PENDING items                   │   │
│  │  resolve()        ──► Mark as RESOLVED after review               │   │
│  │  discard()        ──► Mark as DISCARDED (invalid data)            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Idempotency Layer (Usage Controller)                 │   │
│  │                                                                   │   │
│  │  Validate CDR ──► Valid?  ──YES──► INSERT IGNORE with key         │   │
│  │                   │                                               │   │
│  │                   NO ──► DeadLetterService.enqueue()              │   │
│  │                      ──► Return validation error                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER (MySQL 8)                         │
│                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  users    │  │  user_logs   │  │  bills       │  │ service_rates │  │
│  │          │  │  (CDRs)      │  │              │  │               │  │
│  │ id       │◄─┤ user_id (FK) │  │ user_id (FK) ├─►│ service       │  │
│  │ username │  │ type         │  │ amount       │  │ rate          │  │
│  │ email    │  │ quantity     │  │ period_start │  │ DECIMAL(10,2) │  │
│  │ password │  │ DECIMAL(12,4)│  │ period_end   │  └───────────────┘  │
│  │ acc_type │  │ idempotency  │  │ status       │                     │
│  └──────────┘  │ _key (UNIQUE)│  │ DECIMAL(10,2)│  ┌───────────────┐  │
│                └──────────────┘  └──────────────┘  │login_attempts │  │
│                                                     │ ip, email     │  │
│                                                     │ brute-force   │  │
│                                                     │ protection    │  │
│                                                     └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Billing Pipeline (Mediation → Rating → Invoicing → Ledger)

```
  Raw CDR Input                 Mediation                   Rating                  Invoicing (Atomic)
  ─────────────                 ─────────                   ──────                  ──────────────────

  POST /usage/calls     ──►  Validate CDR          ──►  calculateBill()     ──►  createBill() [TRANSACTION]
  POST /usage/sms            │                           │                       │
  POST /usage/data           ├─ Valid? ── YES ─►         │ 1. Query unbilled     │ 1. INSERT bill
                             │    INSERT IGNORE           │    CDRs (billed=FALSE)│ 2. UPDATE CDRs billed=TRUE
                             │    with idempotency_key    │ 2. Aggregate by type  │ 3. INSERT ledger CHARGE
                             │                           │ 3. Apply rates with   │    (running balance)
                             ├─ Invalid? ── NO ─►        │    Decimal.js         │ 4. COMMIT (all or nothing)
                             │    DLQ.enqueue()           │ 4. Banker's Rounding  │
                             │    Return error            │ 5. Return logIds      │ payBill()
                             │                           └─────────────────┘     │ 1. SELECT FOR UPDATE (lock)
                             ├─ Duplicate?                                        │ 2. UPDATE status = PAID
                             │    200 OK (idempotent)                             │ 3. INSERT ledger PAYMENT
                             │                                                    │ 4. COMMIT
                             └──────────────────                                  └──────────────────
```

## Database Schema (ERD)

```
┌──────────────────────┐       ┌──────────────────────────────┐
│        users          │       │         user_logs (CDRs)      │
├──────────────────────┤       ├──────────────────────────────┤
│ id INT PK            │       │ id INT PK                    │
│ username VARCHAR(100) │       │ user_id INT FK → users.id    │
│ email VARCHAR(100) UQ │◄──┐  │ type ENUM(CALL,SMS,DATA)     │
│ password VARCHAR(255) │   │  │ quantity DECIMAL(12,4)        │
│ account_type ENUM     │   │  │ idempotency_key VARCHAR(64) UQ│
│ created_at TIMESTAMP  │   │  │ billed BOOLEAN DEFAULT FALSE  │
│ updated_at TIMESTAMP  │   │  │ bill_id INT FK → bills.id     │
└──────────────────────┘   │  │ timestamp TIMESTAMP           │
                            │  │ INDEX idx_unbilled            │
                            │  └──────────────────────────────┘
                            │
                            │  ┌──────────────────────────────┐
                            │  │           bills               │
                            │  ├──────────────────────────────┤
                            │  │ id INT PK                    │
                            ├──┤ user_id INT FK → users.id    │
                            │  │ amount DECIMAL(10,2)          │
                            │  │ period_start DATE             │
                            │  │ period_end DATE               │
                            │  │ status ENUM(PAID,UNPAID)      │
                            │  │ created_at TIMESTAMP          │
                            │  │ updated_at TIMESTAMP          │
                            │  └──────────────┬───────────────┘
                            │                 │
                            │  ┌──────────────▼───────────────┐
                            │  │     ledger (Audit Trail)      │
                            │  ├──────────────────────────────┤
                            │  │ id BIGINT PK                 │
                            ├──┤ user_id INT FK → users.id    │
                            │  │ bill_id INT FK → bills.id     │
                            │  │ type ENUM(CHARGE,PAYMENT,     │
                            │  │      ADJUSTMENT,REFUND)       │
                            │  │ amount DECIMAL(10,4)           │
                            │  │ balance_after DECIMAL(10,4)    │
                            │  │ description TEXT               │
                            │  │ reference_id VARCHAR(100)      │
                            │  │ created_at TIMESTAMP(3) [ms]   │
                            │  └──────────────────────────────┘
                            │
                            │  ┌──────────────────────────────┐
                            │  │    dead_letter_queue (DLQ)    │
                            │  ├──────────────────────────────┤
                            │  │ id BIGINT PK                 │
                            │  │ source_type ENUM(CALL,SMS,    │
                            │  │     DATA,UNKNOWN)             │
                            │  │ raw_payload JSON              │
                            │  │ error_message TEXT             │
                            │  │ error_code VARCHAR(50)         │
                            │  │ retry_count INT DEFAULT 0     │
                            │  │ status ENUM(PENDING,RETRIED,  │
                            │  │     RESOLVED,DISCARDED)       │
                            │  │ created_at TIMESTAMP           │
                            │  │ resolved_at TIMESTAMP          │
                            │  │ resolved_by INT                │
                            │  └──────────────────────────────┘
                            │
                            │  ┌──────────────────────────────┐
                            │  │       service_rates           │
                            │  ├──────────────────────────────┤
                            │  │ id INT PK                    │
                            │  │ service ENUM(CALL,SMS,DATA) UQ│
                            │  │ rate DECIMAL(10,2)            │
                            │  └──────────────────────────────┘
                            │
                            │  ┌──────────────────────────────┐
                            └──┤      login_attempts           │
                               ├──────────────────────────────┤
                               │ id INT PK                    │
                               │ ip VARCHAR(45)                │
                               │ email VARCHAR(100)            │
                               │ attempts INT                  │
                               │ created_at TIMESTAMP          │
                               └──────────────────────────────┘
```

## Security Architecture

```
Request ──► Helmet ──► Rate Limiter ──► Body Parser ──► Sanitizer ──► JWT Auth ──► Role Check ──► Controller
                                                                        │              │
                                                                        ▼              ▼
                                                                   login_attempts   account_type
                                                                   (brute force)    (admin/user)
```

### Security Features
- **Helmet**: HTTP security headers (HSTS, CSP, X-Frame-Options)
- **Rate Limiting**: General (100/15min), Auth (5/15min), Billing (10/5min)
- **Input Sanitization**: XSS pattern removal on request bodies
- **JWT Authentication**: Token-based auth with configurable expiry
- **Role-Based Access**: Admin-only endpoints protected by middleware
- **Brute Force Protection**: IP + email based login attempt tracking
- **API Key Validation**: Additional layer for admin endpoints

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│               Kubernetes Cluster                 │
│                                                  │
│  ┌────────────┐      ┌───────────────────────┐  │
│  │  Ingress    │──────│  Service (ClusterIP)  │  │
│  │  (nginx)    │      └───────────┬───────────┘  │
│  └────────────┘                  │              │
│                                  ▼              │
│                    ┌──────────────────────────┐  │
│                    │  Deployment (2-5 pods)   │  │
│                    │  ┌──────┐  ┌──────┐      │  │
│                    │  │ Pod  │  │ Pod  │ ...  │  │
│                    │  │ :8080│  │ :8080│      │  │
│                    │  └──────┘  └──────┘      │  │
│                    │  HPA: CPU 70% / Mem 80%  │  │
│                    └──────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  NetworkPolicy: Only ingress → app       │   │
│  │                  Only app → db (3306)    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
              │
              ▼
    ┌──────────────────┐
    │  MySQL Database   │
    │  (Cloud SQL or    │
    │   containerized)  │
    └──────────────────┘
```

## Audit Trail (Ledger) Flow

```
  Every financial event writes an immutable ledger entry:

  Bill Created ($25.50)                    Payment Received ($25.50)
  ─────────────────────                    ────────────────────────

  ┌──────────────────────────────┐         ┌──────────────────────────────┐
  │ type:          CHARGE        │         │ type:          PAYMENT       │
  │ amount:        25.5000       │         │ amount:        25.5000       │
  │ balance_after: 25.5000       │         │ balance_after: 0.0000        │
  │ reference_id:  BILL-42       │         │ reference_id:  PAY-42        │
  │ description:   Bill #42:     │         │ description:   Payment for   │
  │   CALL=$16.65, SMS=$8.85     │         │   Bill #42                   │
  │ created_at:    (ms precision)│         │ created_at:    (ms precision)│
  └──────────────────────────────┘         └──────────────────────────────┘

  The ledger is APPEND-ONLY — entries are never updated or deleted.
  Running balance is computed at write time and verifiable at read time.
  TIMESTAMP(3) provides millisecond precision for audit ordering.
```

## Dead Letter Queue (DLQ) Flow

```
  CDR Ingestion                                    Admin Review
  ──────────────                                   ────────────

  POST /usage/calls ──► validateCDR() ──FAIL──►  dead_letter_queue
       { userId: "abc",                           ┌─────────────────┐
         duration: -5 }                           │ PENDING          │
                                                  │ raw_payload: ... │
                                                  │ error: "duration │
                                                  │  must be positive"│
                                                  └────────┬────────┘
                                                           │
                                             ┌─────────────┼──────────────┐
                                             │             │              │
                                             ▼             ▼              ▼
                                         GET /dlq     PUT /dlq/:id    PUT /dlq/:id
                                         (list all)   /resolve        /discard
                                                      (fix & reprocess)(drop bad data)
```

## Scalability Architecture

```
  Current (single-node, MVP):

    Client ──► Express (10 conn pool) ──► MySQL

  Production (horizontal scaling):

                      ┌──────────────────┐
   CDR Sources ──────►│  Message Queue    │──────► CDR Workers (N pods)
   (Network Elements) │  (RabbitMQ /      │        ├── Validate
                      │   Redis Streams / │        ├── DLQ on failure
                      │   Kafka)          │        └── INSERT IGNORE
                      └──────────────────┘
                                                         │
                                                         ▼
                      ┌──────────────────┐         ┌──────────┐
                      │  Billing Workers  │◄── cron │  MySQL   │
                      │  (per-user jobs)  │         │ (Sharded │
                      │                   │────────►│  by user)│
                      │  Idempotent:      │         └──────────┘
                      │  billed=FALSE     │
                      │  flag ensures     │
                      │  crash-safe retry │
                      └──────────────────┘

  Key scaling properties:
  ┌────────────────────────────────────────────────────────────────┐
  │ CDR Ingestion   : Stateless, horizontally scalable             │
  │ Billing Runs    : Per-user, idempotent (billed flag)           │
  │ Ledger          : Append-only, shardable by user_id            │
  │ DLQ             : Decoupled from hot path, async processing    │
  │ Rate Limiting   : Redis-backed for distributed rate limits     │
  └────────────────────────────────────────────────────────────────┘
```

## Monetary Precision Strategy

This system uses **Decimal.js** for all monetary calculations to avoid the classic
IEEE 754 floating-point precision issues (e.g., `0.1 + 0.2 !== 0.3` in JavaScript).

| Layer | Approach |
|-------|----------|
| TypeScript | Branded types (`Cents`, `Money`, `UserId`) — compile-time safety |
| Database | `DECIMAL(10,2)` for amounts, `DECIMAL(12,4)` for quantities, `CHECK` constraints |
| Service | `Decimal.js` with `ROUND_HALF_EVEN` (Banker's Rounding) |
| Ledger | `DECIMAL(10,4)` for running balance, `TIMESTAMP(3)` for ms precision |
| Reconciliation | `reconcileLedger()` proves `SUM(charges) - SUM(payments) == running_balance` |
| API | Numbers serialized as JSON after rounding to 2 decimal places |

**Why this matters**: In a billing system processing thousands of transactions,
floating-point rounding errors accumulate. A $0.01 error per transaction across
100,000 transactions = $1,000 discrepancy.

## Data Integrity — Defense-in-Depth

```
Layer 1: Compile-Time    │ Branded types (Cents, Money, UserId, BillId)
Layer 2: Input Validation │ express-validator + CDR validation rules
Layer 3: Decimal.js       │ ROUND_HALF_EVEN, precision: 20, no floats
Layer 4: DB Constraints   │ CHECK (amount >= 0), NOT NULL, FOREIGN KEY
Layer 5: Reconciliation   │ reconcileLedger() — prove every cent on demand
```

### CHECK Constraints (Database-Level Invariants)

```sql
-- No negative/zero usage
quantity DECIMAL(12,4) NOT NULL CHECK (quantity > 0)

-- No negative rates
rate DECIMAL(10,4) NOT NULL CHECK (rate >= 0)

-- No negative bill amounts
amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0)

-- Every ledger entry must have a positive amount
amount DECIMAL(10,4) NOT NULL CHECK (amount > 0)

-- Billing period must be logically valid
CHECK (period_end >= period_start)
```

### Reconciliation Endpoint

```
GET /billing/reconcile/:userId    (Admin only)

Response:
{
  "isConsistent": true,
  "ledgerBalance": 250.00,
  "recomputedBalance": 250.00,
  "totalCharges": 400.00,
  "totalPayments": 150.00,
  "unpaidBillsTotal": 250.00,
  "discrepancy": 0
}
```

Uses a transactional snapshot (REPEATABLE READ) to prevent read skew during verification.
