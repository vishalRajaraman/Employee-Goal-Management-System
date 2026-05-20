# 🎯 Goal Setting & Tracking Portal
### AtomQuest Hackathon 1.0

A comprehensive web-based portal for employee goal setting, tracking, and performance management with quarterly check-ins and manager approval workflows.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [User Roles](#user-roles)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Quarterly Check-in Schedule](#quarterly-check-in-schedule)
- [Validation Rules](#validation-rules)
- [Good-to-Have Features](#good-to-have-features)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 Overview

This portal addresses the challenges organizations face with manual or fragmented goal-tracking methods. It provides a structured, digital solution that supports the full lifecycle of employee goals — from creation and alignment to quarterly check-ins and performance visibility.

### Problem Solved
- ❌ Eliminates blind spots in team progress monitoring
- ❌ Provides clarity on how work connects to organizational priorities
- ❌ Removes manual data piecing at appraisal time
- ✅ Real-time visibility and accountability
- ✅ Structured approval workflows
- ✅ Audit-ready system

---

## ✨ Features

### Phase 1 — Goal Creation & Approval (Must-Have)

#### Employee Capabilities
- ✅ Create and submit Goal Sheets
- ✅ Select Thrust Area and define Goal Title/Description
- ✅ Assign Unit of Measurement (UoM): Numeric, %, Timeline, or Zero-based
- ✅ Set Targets and Weightage per goal
- ✅ View locked goals post-approval
- ✅ Input quarterly actuals

#### Manager (L1) Capabilities
- ✅ Review submitted goals
- ✅ Edit targets/weightages inline during approval
- ✅ Return goals for rework
- ✅ Lock goals on approval
- ✅ Conduct quarterly check-ins
- ✅ Add structured check-in comments

#### Admin/HR Capabilities
- ✅ Configure cycles
- ✅ Manage org hierarchy
- ✅ Oversee completion rates
- ✅ Exception handling
- ✅ Audit logs
- ✅ Goal unlock capability

#### System Validations
- ✅ Total weightage across all goals must equal **100%**
- ✅ Minimum weightage per individual goal: **10%**
- ✅ Maximum number of goals per employee: **8**

#### Shared Goals
- ✅ Admin/manager can push departmental KPIs to multiple employees
- ✅ Recipients adjust weightage only (Title and Target are read-only)
- ✅ Achievement updates sync across all linked goal sheets

### Phase 2 — Achievement Tracking & Quarterly Check-ins (Must-Have)

#### Quarterly Updates
- ✅ Log Actual Achievement against Planned Targets
- ✅ Status selection: Not Started / On Track / Completed
- ✅ Manager view of Planned vs. Achievement data
- ✅ Structured Check-in Comments

#### Progress Score Calculations

| UoM Type | Description | Formula |
|----------|-------------|---------|
| **Min (Numeric / %)** | Higher is better (e.g., Sales Revenue) | Achievement ÷ Target |
| **Max (Numeric / %)** | Lower is better (e.g., TAT, Cost) | Target ÷ Achievement |
| **Timeline** | Date-based completion | Completion date vs. Deadline |
| **Zero** | Zero = Success (e.g., Safety incidents) | If 0 → 100%, else 0% |

---

## 👥 User Roles

| Role | Responsibilities | System Capabilities |
|------|------------------|---------------------|
| **Employee** | Draft goals; enter quarterly achievement; update progress status | Create & edit goals pre-submission; view locked goals; input actuals |
| **Manager (L1)** | Review & approve goals; conduct quarterly check-ins; log feedback | Team dashboard; inline editing during approval; comment/feedback logs |
| **Admin / HR** | Configure cycles; manage org hierarchy; oversee completion rates | Cycle management; exception handling; audit logs; goal unlock capability |

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React.js / Next.js
- **UI Library**: Material-UI / Tailwind CSS
- **State Management**: Redux / Zustand
- **Charts**: Chart.js / Recharts

### Backend
- **Runtime**: Node.js / Python (FastAPI/Django)
- **API**: RESTful API / GraphQL
- **Authentication**: JWT / Microsoft Entra ID (SSO)

### Database
- **Primary**: PostgreSQL / MongoDB
- **Caching**: Redis

### DevOps & Hosting
- **Container**: Docker
- **Orchestration**: Kubernetes (optional)
- **Cloud**: AWS / Azure / GCP
- **CI/CD**: GitHub Actions

### Integrations (Good-to-Have)
- **Microsoft Entra ID**: SSO and org hierarchy sync
- **Email Service**: SendGrid / Azure Communication Services
- **Microsoft Teams**: Bot notifications and adaptive cards

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ or Python 3.9+
- PostgreSQL / MongoDB
- npm / yarn or pip

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/goal-tracking-portal.git
cd goal-tracking-portal

# Install dependencies
npm install  # or pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate  # or python manage.py migrate

# Start development server
npm run dev  # or python manage.py runserver
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/goaldb

# Authentication
JWT_SECRET=your-secret-key
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id

# Email (Optional)
SENDGRID_API_KEY=your-api-key

# Teams (Optional)
TEAMS_WEBHOOK_URL=your-webhook-url
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Employee   │  │   Manager   │  │    Admin    │          │
│  │   Portal    │  │   Dashboard │  │   Console   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│              (Authentication & Rate Limiting)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │   Goal   │ │Achieve-  │ │  Check-  │ │  Report  │        │
│  │ Service  │ │ ment     │ │  in      │ │  Engine  │        │
│  │          │ │ Service  │ │ Service  │ │          │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ PostgreSQL  │  │    Redis    │  │Audit Logs   │          │
│  │  (Primary)  │  │   (Cache)   │  │  (MongoDB)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 API Documentation

### Key Endpoints

#### Goals
- `POST /api/goals` - Create new goal
- `GET /api/goals` - List employee goals
- `PUT /api/goals/:id` - Update goal
- `POST /api/goals/:id/submit` - Submit for approval
- `POST /api/goals/:id/approve` - Approve goal (Manager)
- `POST /api/goals/:id/reject` - Reject goal (Manager)

#### Achievements
- `POST /api/achievements` - Log achievement
- `GET /api/achievements/:quarter` - Get quarterly achievements
- `PUT /api/achievements/:id` - Update achievement

#### Check-ins
- `POST /api/checkins` - Create check-in
- `GET /api/checkins/team` - Get team check-ins (Manager)
- `PUT /api/checkins/:id` - Update check-in comment

#### Reports
- `GET /api/reports/achievement` - Export achievement report (CSV/Excel)
- `GET /api/reports/completion` - Get completion dashboard
- `GET /api/reports/audit` - Get audit trail

---

## 📅 Quarterly Check-in Schedule

| Period | Window Opens | Action |
|--------|--------------|--------|
| **Phase 1 — Goal Setting** | 1st May | Goal Creation, Submission & Approval |
| **Q1 Check-in** | July | Progress Update — Planned vs. Actual |
| **Q2 Check-in** | October | Progress Update — Planned vs. Actual |
| **Q3 Check-in** | January | Progress Update — Planned vs. Actual |
| **Q4 / Annual** | March / April | Final Achievement Capture |

---

## ✅ Validation Rules

| Rule | Constraint | Enforcement |
|------|------------|-------------|
| **Total Weightage** | Must equal 100% | System-enforced on submission |
| **Minimum Weightage** | ≥ 10% per goal | Validated per goal |
| **Maximum Goals** | ≤ 8 goals per employee | Hard limit enforced |
| **Goal Lock** | Locked after approval | Edit requires Admin intervention |
| **Shared Goals** | Read-only Title & Target | Weightage adjustable by recipient |

---

## 🎁 Good-to-Have Features (Bonus)

### 5.1 Microsoft Entra ID Integration
- ✅ Single Sign-On (SSO) via Microsoft Entra ID
- ✅ Automatic org hierarchy sync from Azure AD attributes
- ✅ Role assignment mapped from Azure AD group membership

### 5.2 Email & Microsoft Teams Integration
- ✅ Automated email notifications for:
  - Goal submission
  - Approval/rejection
  - Check-in reminders
- ✅ Teams bot/adaptive card notifications for managers
- ✅ Deep-link support from Teams to goal sheets

### 5.3 Escalation Module
- ✅ Configurable escalation rules:
  - Employee hasn't submitted goals within N days
  - Manager hasn't approved within N days
  - Quarterly check-in not completed in window
- ✅ Escalation chain: Employee → Manager → Skip-level/HR
- ✅ Escalation log visible to Admin/HR

### 5.4 Analytics Module
- ✅ Quarter-on-Quarter (QoQ) achievement trends
- ✅ Heatmaps/progress charts for completion rates
- ✅ Goal distribution analysis (Thrust Area, UoM, Status)
- ✅ Manager effectiveness dashboard

---

## 🧪 Testing

```bash
# Run unit tests
npm test  # or pytest

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

---

## 📊 Reporting & Governance

### Achievement Report
- Exportable format: CSV / Excel
- Shows: Planned Target vs. Actual Achievement for all employees

### Completion Dashboard
- Real-time view of quarterly check-in completion
- Tracks employees and managers

### Audit Trail
- Logs all changes after lock date
- Captures: Who changed what and when

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

For questions or issues, please contact the development team or open an issue in the repository.

---

## 🏆 Hackathon Submission Deliverables

1. ✅ Live/hosted demo URL
2. ✅ Source code repository
3. ✅ Architecture diagram
4. ✅ Login credentials for all 3 roles (Employee, Manager, Admin)

---

<div align="center">

**Built with ❤️ for AtomQuest Hackathon 1.0**

</div>