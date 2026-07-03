# SaaS-PM — Project Management Tool

> A full-stack, multi-tenant SaaS project management platform built with React, Node.js, PostgreSQL, and Socket.io. Think Jira/Trello — but built from scratch.

🚀 **Live Demo:** [saas-pm-amber.vercel.app](https://saas-pm-amber.vercel.app)  
🔗 **API:** [saas-pm-production.up.railway.app](https://saas-pm-production.up.railway.app/health)

---

## ✨ Features

- 🔐 **JWT Authentication** — Access + refresh token rotation with HTTP-only cookies
- 🏢 **Multi-tenant Workspaces** — Isolated data per workspace, invite members via email
- 👥 **Role-Based Access Control** — Owner, Admin, Member, Viewer permissions
- 📋 **Kanban Boards** — Drag-and-drop task management with dnd-kit
- ⚡ **Real-time Collaboration** — Live task updates via WebSockets (Socket.io)
- 💬 **Comments & Activity Log** — Per-task comments and full project activity feed
- 🌙 **Dark / Light Mode** — System-aware theme toggle
- 📁 **File Attachments** — Upload files to tasks via Cloudinary
- 📧 **Email Invites** — Invite team members with role-scoped tokens
- 🐳 **Dockerized Dev Environment** — PostgreSQL + Redis via Docker Compose

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework and build tool |
| TailwindCSS v3 | Utility-first styling |
| React Query | Server state management and caching |
| Zustand | Global client state (auth, theme) |
| dnd-kit | Drag-and-drop Kanban board |
| Socket.io-client | Real-time WebSocket connection |
| React Router v6 | Client-side routing |
| Axios | HTTP client with interceptors |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| TypeScript | Type-safe backend code |
| Prisma ORM v5 | Type-safe database queries and migrations |
| Socket.io | WebSocket server for real-time events |
| JWT + bcryptjs | Authentication and password hashing |
| Zod | Request validation |
| Nodemailer | Email delivery for invites |
| Multer + Cloudinary | File upload pipeline |

### Infrastructure
| Technology | Purpose |
|---|---|
| PostgreSQL | Primary relational database (9 tables) |
| Redis | Session store and Socket.io adapter |
| Docker Compose | Local development environment |
| Railway | Backend + database deployment |
| Vercel | Frontend deployment with CDN |

---

## 🗄️ Database Schema

```
Users ──< WorkspaceMembers >── Workspaces
                                    │
                               Projects
                                    │
                               Columns
                                    │
                               Tasks ──< Comments
                                    │
                               Attachments
                                    │
                               ActivityLogs
                                    │
                               Invites
```

9 normalized tables with foreign key constraints, cascading deletes, and indexed queries.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### 1. Clone the repository
```bash
git clone https://github.com/angadevgan/saas-pm.git
cd saas-pm
```

### 2. Start the database
```bash
docker-compose up -d
```

### 3. Setup the backend
```bash
cd server
npm install
cp .env.example .env   # Fill in your environment variables
npx prisma migrate dev
npm run dev
```

### 4. Setup the frontend
```bash
cd client
npm install
npm run dev
```

### 5. Open the app
```
http://localhost:5173
```

---

## 🔑 Environment Variables

### Server (`server/.env`)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/saaspm_db
REDIS_URL=redis://localhost:6379
PORT=5000
NODE_ENV=development
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
CLIENT_URL=http://localhost:5173
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout and clear token |
| GET | `/api/auth/me` | Get current user |

### Workspaces
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | Get all user workspaces |
| GET | `/api/workspaces/:slug` | Get workspace by slug |
| PUT | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/workspace/:id` | Create project |
| GET | `/api/projects/workspace/:id` | Get workspace projects |
| GET | `/api/projects/:id` | Get project with Kanban data |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tasks/:projectId/column/:columnId` | Create task |
| GET | `/api/tasks/:taskId` | Get task details |
| PUT | `/api/tasks/:taskId` | Update task |
| PATCH | `/api/tasks/:taskId/move` | Move task between columns |
| DELETE | `/api/tasks/:taskId` | Delete task |
| POST | `/api/tasks/:taskId/comments` | Add comment |
| DELETE | `/api/tasks/comments/:id` | Delete comment |

---

## 🏗️ Project Structure

```
SaaS-PM/
├── server/                  # Node.js + Express backend
│   ├── prisma/
│   │   ├── schema.prisma    # 9-table database schema
│   │   └── migrations/      # Database migrations
│   └── src/
│       ├── modules/         # Feature modules (auth, workspace, project, task...)
│       ├── middlewares/     # JWT auth, RBAC, error handling
│       ├── utils/           # JWT, email, response helpers
│       └── config/          # DB, Redis, Cloudinary config
│
├── client/                  # React + Vite frontend
│   └── src/
│       ├── pages/           # Login, Register, Dashboard, Workspace, Project
│       ├── components/      # Kanban board, modals, layout, UI
│       ├── hooks/           # useAuth, useSocket
│       ├── store/           # Zustand stores (auth, theme)
│       └── api/             # Axios instance with interceptors
│
└── docker-compose.yml       # PostgreSQL + Redis containers
```

---

## 🔄 Real-time Events (Socket.io)

| Event | Trigger | Payload |
|---|---|---|
| `task:created` | New task added | Task object |
| `task:updated` | Task edited | Updated task |
| `task:moved` | Task dragged to column | Task with new column |
| `task:deleted` | Task removed | `{ taskId, projectId }` |
| `task:commented` | Comment posted | `{ taskId, comment }` |

---

## 👨‍💻 Author

**Angad Devgan**  
Final Year CSE Student — CCET Chandigarh  
[GitHub](https://github.com/angadevgan) · [LinkedIn](https://linkedin.com/in/angad-devgan)

---

## 📄 License

MIT License — feel free to use this project as a reference.
