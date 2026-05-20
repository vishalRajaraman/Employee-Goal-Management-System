# ATOMQUEST Goal Tracker Portal

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Web Browser                               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │   │
│  │  │   HTML5     │  │    CSS3      │  │  Vanilla JS     │    │   │
│  │  │  (Structure)│  │  (Styling)   │  │  (Application)  │    │   │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Node.js + Express 5                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │   │
│  │  │   Auth      │  │    Goals     │  │   Achievements  │    │   │
│  │  │   Routes    │  │    Routes    │  │     Routes      │    │   │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘    │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │   │
│  │  │   Reports   │  │  Escalations │  │    Analytics    │    │   │
│  │  │   Routes    │  │    Routes    │  │     Routes      │    │   │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘    │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │              Middleware Layer                         │   │   │
│  │  │  • JWT Authentication  • Role Authorization          │   │   │
│  │  │  • CORS              • Body Parser                   │   │   │
│  │  │  • Audit Logging     • Error Handling                │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Queries
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 sql.js (SQLite in-memory)                    │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────┐  │   │
│  │  │  Users  │ │  Goals   │ │ Cycles │ │  Achievements    │  │   │
│  │  │  Table  │ │  Table   │ │ Table  │ │     Table        │  │   │
│  │  └─────────┘ └──────────┘ └────────┘ └──────────────────┘  │   │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ Checkins │ │Escalations│ │Audit Logs│ │Thrust Areas  │ │   │
│  │  │  Table   │ │  Table    │ │  Table   │ │    Table     │ │   │
│  │  └──────────┘ └───────────┘ └──────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          ▼                                          │
│              ┌───────────────────────┐                             │
│              │  goal_tracker.db      │                             │
│              │  (Persistent File)    │                             │
│              └───────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICES                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  node-cron Scheduler                         │   │
│  │  • Daily Escalation Checks (9:00 AM)                        │   │
│  │  • Goal Submission Reminders                                │   │
│  │  • Approval Overdue Notifications                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **HTML5** - Semantic structure
- **CSS3** - Modern styling with CSS variables
- **Vanilla JavaScript** - No framework dependencies for cost optimization

### Backend
- **Node.js v20** - Runtime environment
- **Express 5** - Web framework
- **sql.js** - SQLite compiled to WebAssembly (zero native dependencies)
- **JWT** - Stateless authentication
- **bcryptjs** - Password hashing
- **node-cron** - Scheduled tasks

### Security
- JWT-based authentication with 24-hour expiry
- Role-based access control (RBAC)
- Password hashing with bcrypt (10 rounds)
- CORS enabled for cross-origin requests
- Input validation on all endpoints

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Hosting                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Option 1: VPS/Droplet                   │ │
│  │  • Ubuntu 22.04                                   │ │
│  │  • 1GB RAM, 1 CPU                                 │ │
│  │  • ~$5/month                                      │ │
│  │  • PM2 for process management                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Option 2: Container (Docker)            │ │
│  │  • Docker Compose setup                           │ │
│  │  • Kubernetes ready                               │ │
│  │  • Auto-scaling capable                           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Option 3: PaaS (Render/Railway)         │ │
│  │  • Zero DevOps overhead                           │ │
│  │  • Auto-deploy from Git                           │ │
│  │  • Free tier available                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Cost Optimization Strategies

1. **No External Database**: Using sql.js eliminates database hosting costs
2. **Static Frontend**: Vanilla JS removes framework bundle size and CDN costs
3. **Efficient Caching**: JWT tokens reduce database lookups
4. **Minimal Dependencies**: Only essential npm packages
5. **Single Server**: All components run on one instance
6. **File-based Storage**: SQLite database stored as file (no DB service)

## Estimated Monthly Costs

| Component | Free Tier | Paid Tier |
|-----------|-----------|-----------|
| Hosting   | $0 (Render free) | $5-10 (VPS) |
| Domain    | $0 (subdomain) | $10-15/year |
| Database  | $0 (file-based) | $0 |
| SSL       | $0 (Let's Encrypt) | $0 |
| **Total** | **$0** | **~$5-15/month** |

## User Flow Diagrams

### Goal Creation & Approval Flow
```
Employee                    Manager                    System
   │                          │                          │
   ├─ Create Goals ─────────► │                          │
   │  (Draft Status)          │                          │
   │                          │                          │
   ├─ Submit ───────────────► │                          │
   │  (Submitted Status)      │                          │
   │                          │                          │
   │                          ├─ Review & Edit           │
   │                          │  (Inline)                │
   │                          │                          │
   │                          ├─ Approve ──────────────► │
   │                          │  (Locked Status)         │
   │                          │                          │
   ◄─ Notification ───────────┤                          │
   │                          │                          │
```

### Quarterly Check-in Flow
```
Employee                    Manager                    System
   │                          │                          │
   ├─ Update Achievement ───► │                          │
   │  (Actual vs Target)      │                          │
   │                          │                          │
   │                          ├─ View Progress           │
   │                          │  (Dashboard)             │
   │                          │                          │
   │                          ├─ Conduct Check-in ─────► │
   │                          │  (Add Comments)          │
   │                          │                          │
   ◄─ Feedback ───────────────┤                          │
   │                          │                          │
```

## API Endpoints Summary

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | Public | User authentication |
| GET | /api/users/me | Auth | Current user profile |
| GET | /api/cycles | Auth | Get goal cycles |
| GET | /api/goals/my-goals | Auth | Employee's goals |
| POST | /api/goals | Employee | Create goal |
| PUT | /api/goals/:id | Auth | Update goal |
| POST | /api/goals/submit | Employee | Submit for approval |
| POST | /api/goals/approve | Manager | Approve/reject goal |
| POST | /api/goals/achievements | Auth | Update achievement |
| POST | /api/checkins | Manager | Conduct check-in |
| GET | /api/reports/achievements | Auth | Export report (CSV) |
| GET | /api/reports/audit-logs | Admin | View audit trail |
| GET | /api/escalations | Manager | View escalations |
| GET | /api/analytics/trends | Auth | View analytics |

## Security Features

1. **Authentication**: JWT tokens with 24-hour expiration
2. **Authorization**: Role-based middleware (employee/manager/admin)
3. **Password Security**: bcrypt hashing with salt rounds
4. **Input Validation**: Server-side validation on all inputs
5. **Audit Trail**: Complete logging of all data changes
6. **CORS**: Configured for production deployment

## Scalability Considerations

- Horizontal scaling via load balancer (stateless JWT auth)
- Database migration path to PostgreSQL for enterprise scale
- Redis caching layer for frequently accessed data
- Microservices architecture ready (modular codebase)
