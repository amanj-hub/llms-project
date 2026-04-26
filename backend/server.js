/**
 * ╔════════════════════════════════════════════════════╗
 * ║  LearnSphere — Backend API Server v4.0             ║
 * ║  Public Document Sharing Platform                   ║
 * ║  Node.js + Express + MongoDB + Multer              ║
 * ╚════════════════════════════════════════════════════╝
 */

const express   = require('express');
const mongoose  = require('mongoose');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const cors      = require('cors');
const dotenv    = require('dotenv');
const path      = require('path');
const multer    = require('multer');
const fs        = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'llms_dev_secret_2024_change_in_prod';
const MONGO_URI  = process.env.MONGODB_URI || 'mongodb://localhost:27017/llms_v3';

// ══════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, DOC, PPT, PPTX files are allowed'));
  },
});

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.path}`);
    next();
  });
}

// ══════════════════════════════════════════════════════════
//  DATABASE
// ══════════════════════════════════════════════════════════
mongoose.connect(MONGO_URI)
  .then(() => console.log(`✅  MongoDB connected → ${MONGO_URI}`))
  .catch(err => console.error('❌  MongoDB connection failed:', err.message));

// ══════════════════════════════════════════════════════════
//  SCHEMAS
// ══════════════════════════════════════════════════════════

/* USER — no role field */
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 100 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  username:  { type: String, required: true, unique: true, lowercase: true, trim: true,
               match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers and underscores'] },
  password:  { type: String, required: true, minlength: 6 },
  color:     { type: String, default: '#3b82f6' },
  initials:  { type: String },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
  if (this.isModified('name')) this.initials = this.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  next();
});
UserSchema.methods.verifyPassword = function (pwd) { return bcrypt.compare(pwd, this.password); };
UserSchema.methods.toJSON = function () { const o = this.toObject(); delete o.password; return o; };

/* LESSON */
const LessonSchema = new mongoose.Schema({
  project:    { type: String, required: true, trim: true, maxlength: 200 },
  type:       { type: String, enum: ['Web','AI','Mobile','DevOps','Backend','Data','Security','Other'], required: true },
  tech:       [{ type: String, trim: true }],
  challenge:  { type: String, required: true, maxlength: 5000 },
  solution:   { type: String, required: true, maxlength: 5000 },
  tags:       [{ type: String, lowercase: true, trim: true }],
  visibility: { type: String, enum: ['public','private'], default: 'public' },
  fileUrl:    { type: String },
  fileName:   { type: String },
  impact:     { type: String, enum: ['high','medium','low'], default: 'medium' },
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views:      { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
});

LessonSchema.index({ project: 'text', challenge: 'text', solution: 'text', tags: 'text' });
LessonSchema.pre('save', function (next) { this.updatedAt = Date.now(); next(); });

/* NOTIFICATION */
const NotifSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true },
  text:      { type: String },
  type:      { type: String, default: 'system' },
  read:      { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const User         = mongoose.model('User',         UserSchema);
const Lesson       = mongoose.model('Lesson',       LessonSchema);
const Notification = mongoose.model('Notification', NotifSchema);

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
const signToken = (user) =>
  jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authorization token required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const calcSimilarity = (a, b) => {
  let sc = 0;
  if (a.type === b.type) sc += 30;
  a.tech.forEach(t => { if (b.tech.includes(t)) sc += 20; });
  a.tags.forEach(t => { if (b.tags.includes(t)) sc += 15; });
  return Math.min(sc, 97);
};

// ══════════════════════════════════════════════════════════
//  ROUTES — AUTH
// ══════════════════════════════════════════════════════════

/** POST /api/auth/signup */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    if (!name?.trim() || !email?.trim() || !username?.trim() || !password)
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const uname = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_]+$/.test(uname))
      return res.status(400).json({ error: 'Username can only contain lowercase letters, numbers and underscores' });
    if (await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: uname }] }))
      return res.status(409).json({ error: 'Email or username is already taken' });

    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#f472b6','#22d3ee','#ef4444','#a855f7'];
    const user = new User({
      name: name.trim(), email, username: uname, password,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    await user.save();
    res.status(201).json({ user, token: signToken(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/auth/login */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.verifyPassword(password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    user.lastLogin = new Date();
    await user.save();
    res.json({ user, token: signToken(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/auth/me */
app.get('/api/auth/me', authMiddleware, (req, res) => res.json(req.user));

/** PATCH /api/auth/me */
app.patch('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    const updates = {};
    if (name?.trim()) updates.name = name.trim();
    if (color) updates.color = color;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  ROUTES — LESSONS
// ══════════════════════════════════════════════════════════

/** GET /api/lessons/trending — must be before /:id */
app.get('/api/lessons/trending', authMiddleware, async (req, res) => {
  try {
    const lessons = await Lesson.find({ visibility: 'public' })
      .populate('author', 'name initials color username')
      .sort('-views').limit(10);
    res.json(lessons);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/lessons */
app.get('/api/lessons', authMiddleware, async (req, res) => {
  try {
    const { search, type, tech, tag, impact, authorId, sort = '-createdAt', page = 1, limit = 24 } = req.query;

    // Show all public + current user's own private lessons
    const visibilityFilter = {
      $or: [
        { visibility: 'public' },
        { $and: [{ visibility: 'private' }, { author: req.user._id }] }
      ]
    };
    const query = { $and: [visibilityFilter] };

    if (search?.trim()) {
      query.$and.push({ $or: [
        { project:   { $regex: search, $options: 'i' } },
        { challenge: { $regex: search, $options: 'i' } },
        { solution:  { $regex: search, $options: 'i' } },
        { tech:      { $elemMatch: { $regex: search, $options: 'i' } } },
        { tags:      { $elemMatch: { $regex: search, $options: 'i' } } },
      ]});
    }
    if (type   && type   !== 'all') query.$and.push({ type });
    if (impact && impact !== 'all') query.$and.push({ impact });
    if (tech   && tech   !== 'all') query.$and.push({ tech: { $in: [tech] } });
    if (tag    && tag    !== 'all') query.$and.push({ tags: { $in: [tag.toLowerCase()] } });

    // authorId=me shows all own lessons (including private); other IDs show only public
    if (authorId) {
      const resolvedId = authorId === 'me' ? req.user._id : authorId;
      // Remove visibility filter, replace with author-specific one
      query.$and = query.$and.filter(c => !c.$or?.some(o => o.visibility !== undefined));
      if (authorId === 'me') {
        query.$and.push({ author: resolvedId }); // own lessons: all visibility
      } else {
        query.$and.push({ author: resolvedId, visibility: 'public' });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [lessons, total] = await Promise.all([
      Lesson.find(query).populate('author', 'name initials color username')
        .sort(sort).skip(skip).limit(parseInt(limit)),
      Lesson.countDocuments(query),
    ]);
    res.json({ lessons, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/lessons/:id */
app.get('/api/lessons/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('author', 'name initials color username');
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    if (lesson.visibility === 'private' && lesson.author._id.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'This lesson is private' });
    lesson.views++;
    await lesson.save();
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/lessons */
app.post('/api/lessons', authMiddleware, async (req, res) => {
  try {
    const { project, type, tech, challenge, solution, tags, impact, visibility, fileUrl, fileName } = req.body;
    if (!project?.trim() || !type || !challenge?.trim() || !solution?.trim())
      return res.status(400).json({ error: 'Project, type, challenge, and solution are required' });

    const lesson = new Lesson({
      project: project.trim(), type,
      tech:    (tech  || []).map(t => t.trim()).filter(Boolean),
      tags:    (tags  || []).map(t => t.toLowerCase().trim()).filter(Boolean),
      challenge: challenge.trim(), solution: solution.trim(),
      impact: impact || 'medium', author: req.user._id,
      visibility: visibility === 'private' ? 'private' : 'public',
      fileUrl, fileName,
    });
    await lesson.save();
    await lesson.populate('author', 'name initials color username');

    // Notify others about public lessons only
    if (lesson.visibility === 'public') {
      const others = await User.find({ _id: { $ne: req.user._id } }).select('_id');
      if (others.length) {
        await Notification.insertMany(others.map(u => ({
          user: u._id, title: 'New Lesson Published',
          text: `${req.user.name} (@${req.user.username}) shared: "${lesson.project}"`,
          type: 'lesson_added',
        })));
      }
    }
    res.status(201).json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/lessons/:id — owner only */
app.put('/api/lessons/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Not found' });
    if (lesson.author.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'You can only edit your own lessons' });

    const { project, type, tech, challenge, solution, tags, impact, visibility, fileUrl, fileName } = req.body;
    if (project)    lesson.project    = project.trim();
    if (type)       lesson.type       = type;
    if (tech)       lesson.tech       = tech.map(t => t.trim()).filter(Boolean);
    if (challenge)  lesson.challenge  = challenge.trim();
    if (solution)   lesson.solution   = solution.trim();
    if (tags)       lesson.tags       = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
    if (impact)     lesson.impact     = impact;
    if (visibility) lesson.visibility = visibility;
    if (fileUrl  !== undefined) lesson.fileUrl  = fileUrl;
    if (fileName !== undefined) lesson.fileName = fileName;

    await lesson.save();
    await lesson.populate('author', 'name initials color username');
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/lessons/:id — owner only */
app.delete('/api/lessons/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Not found' });
    if (lesson.author.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'You can only delete your own lessons' });
    // Clean up file if stored
    if (lesson.fileUrl) {
      const filePath = path.join(__dirname, '..', lesson.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await lesson.deleteOne();
    res.json({ success: true, message: 'Lesson deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/lessons/:id/similar */
app.get('/api/lessons/:id/similar', authMiddleware, async (req, res) => {
  try {
    const target = await Lesson.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Not found' });
    const candidates = await Lesson.find({ _id: { $ne: target._id }, visibility: 'public' })
      .populate('author', 'name initials color username');
    const ranked = candidates
      .map(l => {
        const score = calcSimilarity(target, l);
        const sharedTech = target.tech.filter(t => l.tech.includes(t)).length;
        const sharedTags = target.tags.filter(t => l.tags.includes(t)).length;
        return {
          ...l.toObject(), score,
          reason: sharedTech > 0
            ? `Shares ${sharedTech} technolog${sharedTech > 1 ? 'ies' : 'y'}`
            : sharedTags > 0
              ? `${sharedTags} common tag${sharedTags > 1 ? 's' : ''}`
              : 'Related category',
        };
      })
      .filter(l => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    res.json(ranked);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  ROUTES — FILE UPLOAD
// ══════════════════════════════════════════════════════════

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid format' });
  // Return a relative URL path (not the system path)
  res.json({ fileUrl: '/uploads/' + req.file.filename, fileName: req.file.originalname });
});

// ══════════════════════════════════════════════════════════
//  ROUTES — BOOKMARKS
// ══════════════════════════════════════════════════════════

app.get('/api/bookmarks', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'bookmarks',
      populate: { path: 'author', select: 'name initials color username' },
    });
    res.json(user.bookmarks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookmarks/:lessonId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const lid  = new mongoose.Types.ObjectId(req.params.lessonId);
    const idx  = user.bookmarks.findIndex(id => id.equals(lid));
    let added;
    if (idx > -1) { user.bookmarks.splice(idx, 1); added = false; }
    else          { user.bookmarks.push(lid);       added = true;  }
    await user.save();
    res.json({ added, bookmarks: user.bookmarks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  ROUTES — NOTIFICATIONS
// ══════════════════════════════════════════════════════════

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const notifs = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30);
  res.json(notifs);
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ success: true });
});

app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  ROUTES — STATS
// ══════════════════════════════════════════════════════════

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [totalLessons, totalUsers, highImpact, types, topTech, topTags] = await Promise.all([
      Lesson.countDocuments({ visibility: 'public' }),
      User.countDocuments(),
      Lesson.countDocuments({ impact: 'high', visibility: 'public' }),
      Lesson.distinct('type'),
      Lesson.aggregate([
        { $match: { visibility: 'public' } },
        { $unwind: '$tech' },
        { $group: { _id: '$tech', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Lesson.aggregate([
        { $match: { visibility: 'public' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);
    res.json({ totalLessons, totalUsers, highImpact, typeCount: types.length, topTech, topTags });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  ROUTES — AI CHAT
// ══════════════════════════════════════════════════════════

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Context: ${JSON.stringify(context)}\n\nUser: ${prompt}` }] }] })
      }
    );
    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that.";
    res.json({ reply });
  } catch {
    res.status(500).json({ error: 'AI Assistant offline' });
  }
});

// ══════════════════════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════════════════════
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok', uptime: Math.round(process.uptime()),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ts: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════
//  SERVE FRONTEND
// ══════════════════════════════════════════════════════════
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ══════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀  LearnSphere API v4.0 running on http://localhost:${PORT}`);
  console.log(`📚  Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
