<<<<<<< HEAD
# LLMS v3 — Lessons Learned Management System

> A premium, production-grade knowledge management platform for engineering teams.
> **Futuristic dark/light UI · AI recommendations · Full CRUD · Export · Admin panel**

---

## ✨ What's New in v3

- **Dark ⇆ Light mode toggle** — persistent, smooth transitions, sidebar + topbar buttons
- **Refined futuristic UI** — Syne + DM Sans typography, animated orbs, grid background
- **Enhanced AI engine** — improved similarity scoring across type, tech, and tags
- **Richer data** — 8 deeply detailed seed lessons across 7 project types
- **Admin table view** — full lesson management table with bulk actions
- **Progress-animated charts** — tech popularity bars animate on page load
- **Keyboard shortcuts** — ⌘K for global search, Esc to close modals

---

## 🚀 Quickstart (Zero Setup)

Open `index.html` directly in any modern browser. Everything runs in-memory with sample data.

```
open index.html
```

**Demo credentials:**
| Role | Email | Password |
|---|---|---|
| Admin | admin@llms.io | admin123 |
| Member | sarah@llms.io | sarah123 |
| Member | marcus@llms.io | marcus123 |
| Member | priya@llms.io | priya123 |

---

## 🖥 Full-Stack Setup

### Requirements
- Node.js 18+
- MongoDB 6+ (local or Atlas)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET

# 3. Seed the database
npm run seed

# 4. Start the server
npm start          # production
npm run dev        # with hot reload (nodemon)
```

### Deploy Frontend

```bash
mkdir -p public
cp index.html public/index.html
# Express will serve it at http://localhost:5000
```

---

## 📁 Project Structure

```
llms-v3/
├── index.html          ← Complete standalone SPA (zero dependencies)
├── server.js           ← Express REST API + MongoDB models
├── seed.js             ← Database seeder (4 users, 8 lessons)
├── package.json        ← Node dependencies
├── .env.example        ← Environment variable template
├── public/             ← Static files (copy index.html here)
└── README.md
```

---

## 🌐 API Reference

All endpoints (except auth) require: `Authorization: Bearer <jwt_token>`

### Auth
```
POST   /api/auth/signup          Register new user
POST   /api/auth/login           Sign in → returns JWT
GET    /api/auth/me              Get current user profile
PATCH  /api/auth/me              Update name/color
```

### Lessons
```
GET    /api/lessons              List (search, type, tech, tag, impact, page, limit, sort)
GET    /api/lessons/:id          Get one (increments view count)
POST   /api/lessons              Create
PUT    /api/lessons/:id          Update (author or Admin)
DELETE /api/lessons/:id          Delete (author or Admin)
GET    /api/lessons/:id/similar  AI similarity recommendations (top 5)
GET    /api/lessons/:id/export   Download as plain-text report
```

### Bookmarks
```
GET    /api/bookmarks            List user's bookmarks (populated)
POST   /api/bookmarks/:lessonId  Toggle bookmark on/off
```

### Notifications
```
GET    /api/notifications        List recent (30)
PATCH  /api/notifications/:id/read    Mark one read
PATCH  /api/notifications/read-all   Mark all read
```

### Stats & Admin
```
GET    /api/stats                System statistics (totals, tech/tag breakdowns)
GET    /api/admin/users          List all users (Admin only)
PATCH  /api/admin/users/:id/role  Change user role (Admin only)
DELETE /api/admin/users/:id       Remove user (Admin only)
GET    /api/health               Server + DB health check
```

---

## 🗃 Database Schemas

### User
```js
{
  name:      String,
  email:     String (unique),
  password:  String (bcrypt, 12 rounds),
  role:      'Admin' | 'Team Member',
  color:     String (hex),
  initials:  String (auto-generated),
  bookmarks: [ObjectId → Lesson],
  createdAt: Date,
  lastLogin: Date
}
```

### Lesson
```js
{
  project:   String,
  type:      'Web'|'AI'|'Mobile'|'DevOps'|'Backend'|'Data'|'Security'|'Other',
  tech:      [String],
  challenge: String,
  solution:  String,
  tags:      [String] (lowercase),
  impact:    'high' | 'medium' | 'low',
  author:    ObjectId → User,
  views:     Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification
```js
{
  user:      ObjectId → User,
  title:     String,
  text:      String,
  type:      String,
  read:      Boolean,
  createdAt: Date
}
```

---

## 🎨 Design System

| Token | Dark | Light |
|---|---|---|
| Background | `#06070d` | `#f0f4fc` |
| Surface | `#0c0f1a` | `#e8edf8` |
| Card | `#131929` | `#ffffff` |
| Accent | `#60a5fa` | `#2563eb` |
| Success | `#34d399` | `#059669` |
| Purple | `#a78bfa` | `#7c3aed` |

**Fonts:** Syne (display, 800w headlines) + DM Sans (body) + Fira Code (monospace tags)

**Key effects:**
- Animated floating orbs with blur (blur: 100px)
- Subtle grid lines at 2% opacity
- Glassmorphism panels: `backdrop-filter: blur(24px)`
- Gradient borders on modal tops and stat cards
- Progress bars animate from 0 on page entry
- Page transitions: 220ms fade + translateY

---

## 🤖 AI Similarity Algorithm

```
score = 0
if lesson.type === target.type      → +30 pts
per shared technology               → +20 pts each
per shared tag                      → +15 pts each
score = min(score, 97)              // cap — avoid false certainty
```

Lessons with score > 0, sorted descending, top 5 returned.

---

## 🔒 Security

- **bcrypt** password hashing (12 rounds)
- **JWT** auth, 7-day expiry
- **Role-based** access (Admin / Team Member)
- **Input validation** on all write endpoints
- **CORS** restricted to configured CLIENT_URL

---

## 🐳 Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t llms-v3 .
docker run -p 5000:5000 --env-file .env llms-v3
```

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Focus global search |
| `Esc` | Close modal / search / notifications |

---

## 📝 License

MIT — Free to use, modify, and distribute.
=======
# llms-project
A full-stack knowledge management platform for documenting project insights and learning resources with AI-powered features.
>>>>>>> b8514b15d88d502d4d44952a9f530a6feb7920a4
