/**
 * LLMS v3 — Seed Script
 * Run: npm run seed
 * Seeds MongoDB with 4 users and 8 rich lessons
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/llms_v3';

// ── Inline schemas (portable, no model imports needed) ──────────────
const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true, lowercase: true },
  password: String, role: String, color: String, initials: String,
  bookmarks: [], createdAt: { type: Date, default: Date.now },
});
const LessonSchema = new mongoose.Schema({
  project: String, type: String, tech: [String], challenge: String,
  solution: String, tags: [String], impact: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now },
});
const User   = mongoose.model('User',   UserSchema);
const Lesson = mongoose.model('Lesson', LessonSchema);

// ── Users ──────────────────────────────────────────────────────────
const USERS = [
  { name: 'AMAN',     email: 'aman@llms.io',     pass: 'admin123',  role: 'Admin',       color: '#3b82f6' },
  { name: 'YASH',     email: 'yash@llms.io',     pass: 'yash123',   role: 'Team Member', color: '#8b5cf6' },
  { name: 'HIMANSHU', email: 'himanshu@llms.io', pass: 'himan123',  role: 'Team Member', color: '#10b981' },
  { name: 'AYUSH',    email: 'ayush@llms.io',    pass: 'ayush123',  role: 'Team Member', color: '#f59e0b' },
  { name: 'DEVANSHU', email: 'devanshu@llms.io', pass: 'devan123',  role: 'Team Member', color: '#f472b6' },
  { name: 'ABHAY',    email: 'abhay@llms.io',    pass: 'abhay123',  role: 'Team Member', color: '#0ea5e9' },
  { name: 'AYUSHI',   email: 'ayushi@llms.io',   pass: 'ayushi123', role: 'Team Member', color: '#ec4899' },
  { name: 'KHUSHI',   email: 'khushi@llms.io',   pass: 'khushi123', role: 'Team Member', color: '#14b8a6' },
  { name: 'RUHI',     email: 'ruhi@llms.io',     pass: 'ruhi123',   role: 'Team Member', color: '#a855f7' },
  { name: 'AAKRITI',  email: 'aakriti@llms.io',  pass: 'aakriti123',role: 'Team Member', color: '#f43f5e' },
  { name: 'SNEHA',    email: 'sneha@llms.io',    pass: 'sneha123',  role: 'Team Member', color: '#f97316' },
];

// ── Lessons factory ────────────────────────────────────────────────
const lessons = (users) => [
  {
    project: 'ECommerce Platform Rebuild', type: 'Web',
    tech: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Nginx'],
    challenge: 'Database queries were timing out under heavy load during Black Friday events, causing site-wide outages affecting 40,000+ concurrent users. P99 latency hit 12 seconds and the cart service became completely unresponsive.',
    solution: 'Implemented a multi-layer caching strategy: Redis for hot product data (TTL 5 min), CDN edge caching for static assets, and PostgreSQL read replicas for SELECT queries. Added connection pooling with PgBouncer, fixed N+1 ORM queries using eager loading, and introduced a circuit breaker for downstream payment calls. P99 latency dropped from 12s to 190ms.',
    tags: ['performance', 'database', 'caching', 'scalability', 'redis'],
    impact: 'high', author: users[0]._id, createdAt: new Date('2024-11-15'),
  },
  {
    project: 'ML Pipeline Automation', type: 'AI',
    tech: ['Python', 'TensorFlow', 'Docker', 'Kubernetes', 'MLflow'],
    challenge: 'Model drift was silently degrading recommendation accuracy in production. We had no alerting, no retraining triggers, and discovered the problem only when revenue dropped 18% — three weeks after the model had started to degrade.',
    solution: 'Built a continuous monitoring platform using PSI and KL-divergence drift detectors running every 6 hours. Set automated retraining pipelines in Kubeflow that trigger when drift exceeds thresholds. Implemented A/B shadow mode for new models with statistical significance gates before full promotion.',
    tags: ['mlops', 'monitoring', 'drift-detection', 'automation', 'mlflow'],
    impact: 'high', author: users[1]._id, createdAt: new Date('2024-10-22'),
  },
  {
    project: 'Mobile Banking App', type: 'Mobile',
    tech: ['React Native', 'TypeScript', 'Firebase', 'Redux Toolkit', 'SQLite'],
    challenge: 'App crashed on ~34% of Android devices (<3GB RAM) when scrolling transaction history with 500+ entries. Caused a 2.1★ App Store rating and significant user churn.',
    solution: 'Replaced FlatList with react-native-flash-list (recycled viewports), implemented cursor-based pagination (50 items/page), stored compressed transaction snapshots in SQLite for offline access, and pre-fetched only visible date ranges. Memory dropped 67%, crash rate went from 34% to 0.3%.',
    tags: ['mobile', 'performance', 'memory', 'android', 'virtualization'],
    impact: 'high', author: users[2]._id, createdAt: new Date('2024-09-08'),
  },
  {
    project: 'DevOps Pipeline Migration', type: 'DevOps',
    tech: ['GitLab CI', 'Terraform', 'AWS', 'Docker', 'ArgoCD'],
    challenge: 'Jenkins CI/CD pipelines took 45–60 min per build. Developers were waiting for feedback, merge queues were 8+ hours long, and deployment frequency had dropped to twice a week.',
    solution: 'Migrated to GitLab CI with parallel test sharding across 12 runners. Introduced Docker layer caching, S3-backed dependency caching, incremental Terraform plan/apply, and ArgoCD for GitOps deployments. Build time: 47 min → 7 min. Deploy frequency: 2/week → 15/day.',
    tags: ['cicd', 'devops', 'docker', 'gitops', 'terraform'],
    impact: 'high', author: users[0]._id, createdAt: new Date('2024-08-30'),
  },
  {
    project: 'API Gateway Redesign', type: 'Backend',
    tech: ['Go', 'gRPC', 'Istio', 'Prometheus', 'Jaeger'],
    challenge: '28 microservices communicated directly with each other via HTTP, creating a spaghetti dependency graph. Cascading failures were common — one slow service brought down 6 others. Zero observability into inter-service latency or error budgets.',
    solution: 'Introduced Istio service mesh for mTLS, traffic shaping, and automatic circuit breaking. Migrated inter-service calls from REST to gRPC (60% bandwidth reduction). Added Jaeger distributed tracing and Prometheus + Grafana SLO dashboards. MTTR from cascading failures: 45 min → 4 min.',
    tags: ['microservices', 'observability', 'grpc', 'service-mesh', 'resilience'],
    impact: 'high', author: users[1]._id, createdAt: new Date('2024-07-14'),
  },
  {
    project: 'Data Analytics Dashboard', type: 'Data',
    tech: ['Vue 3', 'D3.js', 'FastAPI', 'ClickHouse', 'WebSocket'],
    challenge: 'Analytics dashboard loaded in 2–3 minutes for datasets >500k rows. Executives would close the tab mid-presentation. Underlying PostgreSQL OLAP queries were timing out at the 60-second limit.',
    solution: 'Migrated aggregation workload to ClickHouse (columnar, 120× faster on large scans). Pre-materialised hourly rollups for common dimensions. Introduced WebSocket streaming to progressively render chart segments. Load time: 140s → 4.2s for the same dataset.',
    tags: ['analytics', 'clickhouse', 'olap', 'streaming', 'd3'],
    impact: 'medium', author: users[2]._id, createdAt: new Date('2024-06-19'),
  },
  {
    project: 'Security Auth Overhaul', type: 'Security',
    tech: ['OAuth2', 'PKCE', 'Node.js', 'Redis', 'Vault'],
    challenge: 'Legacy session-based auth was vulnerable to CSRF and session fixation. Penetration test revealed 3 high-severity issues including predictable session IDs stored in cookies without Secure/HttpOnly flags.',
    solution: 'Migrated to OAuth2 + PKCE flow with short-lived JWTs (15 min) and rotating refresh tokens. Stored tokens in Redis with device fingerprinting. Integrated HashiCorp Vault for secret rotation. Enforced SameSite=Strict cookies and added MFA via TOTP. Zero auth incidents since.',
    tags: ['security', 'oauth2', 'jwt', 'vault', 'authentication'],
    impact: 'high', author: users[3]._id, createdAt: new Date('2024-05-11'),
  },
  {
    project: 'Real-time Collaboration Tool', type: 'Web',
    tech: ['React', 'WebSocket', 'Y.js', 'Redis Pub/Sub', 'PostgreSQL'],
    challenge: 'Collaborative document editing caused data loss when multiple users edited simultaneously. Merge conflicts corrupted documents ~8% of the time under load, with no conflict resolution strategy.',
    solution: 'Adopted CRDT-based sync using Y.js for conflict-free merges. Backend broadcasts operations via Redis Pub/Sub to all connected sessions. Implemented awareness protocol to show live cursors. Periodic snapshots to PostgreSQL every 30 seconds. Data loss incidents: 0 since launch.',
    tags: ['realtime', 'crdt', 'websocket', 'collaboration', 'yjs'],
    impact: 'medium', author: users[0]._id, createdAt: new Date('2024-04-02'),
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('\n✅  MongoDB connected\n');

  // Clear
  await Promise.all([User.deleteMany({}), Lesson.deleteMany({})]);
  console.log('🗑   Cleared existing data');

  // Users
  const hashedUsers = await Promise.all(USERS.map(async u => ({
    name: u.name, email: u.email, role: u.role, color: u.color,
    initials: u.name.split(' ').map(w => w[0]).join('').toUpperCase(),
    password: await bcrypt.hash(u.pass, 12),
    isVerified: true,
  })));
  const createdUsers = await User.insertMany(hashedUsers);
  console.log(`👥  Seeded ${createdUsers.length} users`);

  // Lessons
  const lessonDocs = await Lesson.insertMany(lessons(createdUsers));
  console.log(`📚  Seeded ${lessonDocs.length} lessons`);

  console.log('\n🎉  Seed complete! Login credentials:');
  console.log('──────────────────────────────────────');
  USERS.forEach(u => {
    console.log(`  ${u.role.padEnd(12)} ${u.email.padEnd(22)} / ${u.pass}`);
  });
  console.log('──────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
