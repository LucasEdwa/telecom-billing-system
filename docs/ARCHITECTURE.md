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
│  │  calculateBill()  ──► Mediation: Aggregate CDRs by type          │   │
│  │                   ──► Rating:    Apply rates with Decimal.js      │   │
│  │                   ──► Invoice:   Sum totals with precision        │   │
│  │                                                                   │   │
│  │  createBill()     ──► Persist invoice to bills table              │   │
│  │  payBill()        ──► Transition: UNPAID → PAID                   │   │
│  │  getBillsByUserId() ─► Paginated bill retrieval                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Idempotency Layer (Usage Controller)                 │   │
│  │                                                                   │   │
│  │  INSERT IGNORE with idempotency_key                               │   │
│  │  Prevents duplicate CDR processing on retries                     │   │
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

## Billing Pipeline (Mediation → Rating → Invoicing)

```
  Raw CDR Input                 Mediation                   Rating                  Invoicing
  ─────────────                 ─────────                   ──────                  ─────────

  POST /usage/calls     ──►  Validate & Store      ──►  calculateBill()     ──►  createBill()
  POST /usage/sms            with idempotency            │                       │
  POST /usage/data           key (INSERT IGNORE)         │ 1. Aggregate CDRs     │ 1. Check total > 0
                                                         │    by type (GROUP BY) │ 2. INSERT into bills
                             ┌──────────────────┐        │ 2. Fetch rates        │ 3. Return billId
                             │ Dedup Check:      │        │ 3. Multiply with      │
                             │ If idempotency_key│        │    Decimal.js         │ ┌──────────────┐
                             │ exists → 200 OK   │        │ 4. Sum all costs      │ │ State Machine│
                             │ (no duplicate)     │        │    (precise)          │ │              │
                             └──────────────────┘        └─────────────────┘     │ UNPAID → PAID │
                                                                                  │ (via payBill) │
                                                                                  └──────────────┘
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
│ created_at TIMESTAMP  │   ├──┤ timestamp TIMESTAMP           │
│ updated_at TIMESTAMP  │   │  └──────────────────────────────┘
└──────────────────────┘   │
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

## Monetary Precision Strategy

This system uses **Decimal.js** for all monetary calculations to avoid the classic
IEEE 754 floating-point precision issues (e.g., `0.1 + 0.2 !== 0.3` in JavaScript).

| Layer | Approach |
|-------|----------|
| Database | `DECIMAL(10,2)` for amounts/rates, `DECIMAL(12,4)` for quantities |
| Service | `Decimal.js` with `ROUND_HALF_UP` for multiplication and summation |
| API | Numbers serialized as JSON after rounding to 2 decimal places |

**Why this matters**: In a billing system processing thousands of transactions,
floating-point rounding errors accumulate. A $0.01 error per transaction across
100,000 transactions = $1,000 discrepancy.
