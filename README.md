# AICTE Integrated Complaint Monitoring Dashboard - Backend

A single-window monitoring layer that integrates institution-related complaint cases across AICTE Bureaus/Cells (Regulatory Bureau, Public Grievance Redressal Cell, Approval Bureau, Academic Bureau, and Regional Offices). Built with **pure JavaScript (Node.js, Express, ES Modules, MongoDB Atlas, Mongoose)**.

---

## 1. Demo Credentials (All Roles)

Password for all demo accounts: **`Password@123`**

| Role | Email | Scope & Permissions |
| :--- | :--- | :--- |
| **Super Admin** | `admin@aicte.gov.in` | Full system access, all regions, SLA configuration, user management |
| **Senior Management** | `director@aicte.gov.in` | Read-only across all data, dashboards, reports, and escalations |
| **Bureau Officer (RB)** | `officer.rb@aicte.gov.in` | RB cases and overlap alerts, update status, add remarks, transfer |
| **Bureau Officer (PGRC)**| `officer.pgrc@aicte.gov.in`| PGRC grievances and overlap alerts, coordination remarks |
| **Regional Officer** | `ro.north@aicte.gov.in` | Northern region institutions and cases only |
| **Data Operator** | `operator@aicte.gov.in` | Bulk CSV/Excel uploads, institution match review queue |

---

## 2. Server Status & Quick Start

### Start Backend
```bash
cd backend
npm install
npm run seed    # Populates institutions, bureaus, cases, overlaps, SLA alerts (safe for local dev)
npm start       # Starts server on http://localhost:5000
# or
npm run dev     # Starts server with auto-reload (node --watch)
npm test        # Runs all 35 comprehensive automated tests across 5 test suites
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev     # Starts Vite development server on http://localhost:5173
npm run build   # Production bundle validation
```


---

## 3. Core API Endpoints

### Authentication & Current User
- `POST /api/auth/login`: `{ email, password }` -> returns `{ success, token, user }`
- `GET /api/me`: Returns current logged-in user profile (Requires `Authorization: Bearer <token>`)

### Dashboard & Analytics
- `GET /api/dashboard/summary`: Total received, pending, under process, disposed, transferred, escalated, beyond timeline, active overlaps, disposal rate
- `GET /api/dashboard/bureau-workload`: Cases per bureau broken down by status
- `GET /api/dashboard/institution-status`: Top institutions by complaint volume with overlap flags

### Case Management
- `GET /api/cases`: Paginated list with filters (`q`, `institution`, `aicteId`, `caseId`, `bureau`, `region`, `category`, `status`, `dateFrom`, `dateTo`, `page`, `limit`)
- `GET /api/cases/:id`: Complete case detail with institution profile, assigned officer, overlap group, and linked cases
- `GET /api/cases/:id/history`: Chronological audit trail of all actions, remarks, transfers, and status changes
- `PATCH /api/cases/:id`: Update status, assigned officer, next action text, expected disposal date
- `POST /api/cases/:id/actions`: Add remark, action taken, or attachment URL
- `POST /api/cases/:id/transfer`: Transfer case to another Bureau/Cell (`targetBureauId`, `remarks`)
- `POST /api/cases/:id/escalate`: Escalate case to Senior Management (`remarks`)
- `POST /api/cases/link`: Link two related or duplicate cases (`caseAId`, `caseBId`, `linkType`, `remarks`)

### Institution Directory
- `GET /api/institutions`: Search master institutions (`q`, `region`, `state`, `limit`)
- `GET /api/institutions/:id`: Institution details, consolidated cases across all bureaus, and active overlap state

### Cross-Bureau Overlap Centre
- `GET /api/overlaps`: Active cross-bureau overlap groups with severity (`high`, `medium`, `low`) and side-by-side case lists
- `GET /api/overlaps/:id`: Overlap group detail
- `POST /api/overlaps/:id/resolve`: Resolve overlap group (`status: 'coordinated' | 'dismissed'`, `remarks`)

### Alerts & Notifications
- `GET /api/alerts`: List alerts and unread notifications for current user
- `POST /api/alerts/:id/read`: Mark notification or alert as read

### Institution Match Review
- `GET /api/match-review`: Queue of low-confidence or unmatched cases with candidate suggestions
- `POST /api/match-review/:caseId/confirm`: Manually confirm or link case to master institution (`institutionId`, `remarks`)

### Connectors & Ingestion
- `POST /api/import/upload`: Bulk CSV/Excel file upload (multipart form data with `file`)
- `POST /api/sync/run`: Manually trigger connector sync from RB & PGRC mock endpoints

### Reports & Export
- `GET /api/reports/:type`: `bureau`, `region`, `ageing`, `disposal-rate`, `overlaps`, `institution`
  - Query parameter `format=json` (default)
  - Query parameter `format=csv` (downloads CSV file)
  - Query parameter `format=pdf` (downloads PDF document)

### Admin & Configuration
- `GET /api/admin/sla-rules`: View category SLA rules
- `PUT /api/admin/sla-rules`: Update SLA days, reminder days, due soon days, escalation days
- `GET /api/admin/users`: List users and roles
- `GET /api/admin/bureaus`: List all 6 AICTE bureaus and cells

### Mock External Source Endpoints (Demonstration)
- `GET /mock/rb/cases`: Simulates Regulatory Bureau external API
- `GET /mock/pgrc/cases`: Simulates Public Grievance Redressal Cell external API
