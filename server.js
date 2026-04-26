const express   = require('express');
const mongoose  = require('mongoose');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const cors      = require('cors');
const dotenv    = require('dotenv');
const path      = require('path');
const multer    = require('multer');
const fs        = require('fs');
const session   = require('express-session');
const passport  = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust Render's reverse proxy
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'llms_dev_secret_2024_change_in_prod';
const MONGO_URI  = process.env.MONGODB_URI || 'mongodb://localhost:27017/llms_v3';

// ══════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'llms_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Uploads directory
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.doc', '.ppt', '.pptx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and PPTX files are allowed'));
    }
  }
});
// Request logger (dev)
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
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    console.warn('⚠️   Running without database (use standalone index.html instead)');
  });

// ══════════════════════════════════════════════════════════
//  SCHEMAS
// ══════════════════════════════════════════════════════════

/* USER */
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 100 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  username:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  color:     { type: String, default: '#3b82f6' },
  initials:  { type: String },
  googleId:  { type: String },
  avatar:    { type: String },
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

/* LESSON — supports both "project" and "lesson" categories */
const LessonSchema = new mongoose.Schema({
  // ── Category discriminator ──
  category:    { type: String, enum: ['project', 'lesson'], default: 'project' },

  // ── Project-specific fields (required when category = "project") ──
  project:     { type: String, trim: true, maxlength: 200 },
  type:        { type: String, enum: ['Web', 'AI', 'Mobile', 'DevOps', 'Backend', 'Data', 'Security', 'Other'] },
  tech:        [{ type: String, trim: true }],
  challenge:   { type: String, maxlength: 5000 },
  solution:    { type: String, maxlength: 5000 },
  impact:      { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },

  // ── Lesson-specific fields (required when category = "lesson") ──
  title:       { type: String, trim: true, maxlength: 300 },
  description: { type: String, maxlength: 10000 },
  link:        { type: String, trim: true },

  // ── Common fields ──
  tags:        [{ type: String, lowercase: true, trim: true }],
  visibility:  { type: String, enum: ['public', 'private'], default: 'public' },
  fileUrl:     { type: String },
  fileName:    { type: String },
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

LessonSchema.index({ project: 'text', challenge: 'text', solution: 'text', title: 'text', description: 'text', tags: 'text' });
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
  } catch (e) {
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
    if (!name?.trim() || !email?.trim() || !username?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] })) {
      return res.status(409).json({ error: 'Email or username is already registered' });
    }
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f472b6', '#22d3ee'];
    const user = new User({
      name: name.trim(), email, username: username.trim().toLowerCase(), password,
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
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    user.lastLogin = new Date();
    await user.save();
    res.json({ user, token: signToken(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/auth/me */
app.get('/api/auth/me', authMiddleware, (req, res) => res.json(req.user));

/** PATCH /api/auth/me — update own profile */
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

// ══════════════════════════════════════════════════════════════
//  GOOGLE OAUTH — PASSPORT SETUP
// ══════════════════════════════════════════════════════════════
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); } catch (e) { done(e); }
});

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
  proxy:        true
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email     = profile.emails?.[0]?.value?.toLowerCase();
    const name      = profile.displayName || 'Google User';
    const googleId  = profile.id;
    const avatar    = profile.photos?.[0]?.value;

    if (!email) return done(new Error('No email from Google'), null);

    // Try to find existing user by email
    let user = await User.findOne({ email });

    if (user) {
      // Update Google ID + lastLogin if not already set
      user.googleId = user.googleId || googleId;
      user.avatar   = user.avatar   || avatar;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create brand-new user from Google profile
      const colors   = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f472b6', '#22d3ee'];
      const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() +
                       Math.floor(Math.random() * 1000);
      user = new User({
        name,
        email,
        username,
        password: await bcrypt.hash(googleId + process.env.JWT_SECRET, 10),
        googleId,
        avatar,
        color: colors[Math.floor(Math.random() * colors.length)],
        lastLogin: new Date(),
      });
      await user.save();
    }
    return done(null, user);
  } catch (e) { return done(e, null); }
}));

/** GET /auth/google — initiate OAuth flow */
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/** GET /auth/google/callback — Google redirects here */
app.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google_auth_failed' }),
  (req, res) => {
    const token = signToken(req.user);
    // Redirect to frontend with token in URL — SPA picks it up
    res.redirect(`/?token=${token}`);
  }
);

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
    const { search, type, tech, tag, impact, authorId, category, sort = '-createdAt', page = 1, limit = 24 } = req.query;

    // Correctly show: all public lessons + current user's own private lessons
    const visibilityFilter = {
      $or: [
        { visibility: 'public' },
        { $and: [{ visibility: 'private' }, { author: req.user._id }] }
      ]
    };

    const query = { $and: [visibilityFilter] };

    // Category filter
    if (category && ['project', 'lesson'].includes(category)) {
      query.$and.push({ category });
    }

    if (search?.trim()) {
      query.$and.push({
        $or: [
          { project:     { $regex: search, $options: 'i' } },
          { challenge:   { $regex: search, $options: 'i' } },
          { solution:    { $regex: search, $options: 'i' } },
          { title:       { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tech:        { $elemMatch: { $regex: search, $options: 'i' } } },
          { tags:        { $elemMatch: { $regex: search, $options: 'i' } } },
        ]
      });
    }
    if (type   && type   !== 'all') query.$and.push({ type });
    if (impact && impact !== 'all') query.$and.push({ impact });
    if (tech   && tech   !== 'all') query.$and.push({ tech:  { $in: [tech] } });
    if (tag    && tag    !== 'all') query.$and.push({ tags:  { $in: [tag.toLowerCase()] } });

    // authorId=me is a shorthand for the logged-in user's own lessons (includes private)
    if (authorId) {
      const resolvedId = authorId === 'me' ? req.user._id : authorId;
      // When filtering by author, override visibility: show all their lessons
      query.$and = query.$and.filter(c => !c.$or?.some(o => o.visibility)); // remove visibility filter
      query.$and.push({ author: resolvedId });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [lessons, total] = await Promise.all([
      Lesson.find(query)
        .populate('author', 'name initials color username')
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
    if (lesson.visibility === 'private' && lesson.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Private lesson' });
    }
    lesson.views++;
    await lesson.save();
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/lessons */
app.post('/api/lessons', authMiddleware, async (req, res) => {
  try {
    const { category, project, type, tech, challenge, solution, tags, impact, visibility, fileUrl, fileName, title, description, link } = req.body;
    const cat = category === 'lesson' ? 'lesson' : 'project';
    const commonFields = {
      category: cat,
      tags:       (tags || []).map(t => t.toLowerCase().trim()).filter(Boolean),
      visibility: visibility === 'private' ? 'private' : 'public',
      fileUrl, fileName,
      author:     req.user._id,
    };

    let lesson;
    if (cat === 'project') {
      // ── Project validation ──
      if (!project?.trim() || !type || !challenge?.trim() || !solution?.trim()) {
        return res.status(400).json({ error: 'Project, type, challenge, and solution are required' });
      }
      lesson = new Lesson({
        ...commonFields,
        project: project.trim(), type,
        tech:      (tech || []).map(t => t.trim()).filter(Boolean),
        challenge: challenge.trim(), solution: solution.trim(),
        impact:    impact || 'medium',
      });
    } else {
      // ── Lesson validation ──
      if (!title?.trim() || !description?.trim()) {
        return res.status(400).json({ error: 'Title and description are required for lessons' });
      }
      if (link && !/^https?:\/\/.+/i.test(link.trim())) {
        return res.status(400).json({ error: 'Link must be a valid URL (http:// or https://)' });
      }
      lesson = new Lesson({
        ...commonFields,
        title: title.trim(),
        description: description.trim(),
        link: link?.trim() || undefined,
      });
    }

    await lesson.save();
    await lesson.populate('author', 'name initials color username');

    // Notify others
    const entryName = cat === 'lesson' ? lesson.title : lesson.project;
    const others = await User.find({ _id: { $ne: req.user._id } }).select('_id');
    if (others.length) {
      await Notification.insertMany(others.map(u => ({
        user:  u._id,
        title: cat === 'lesson' ? 'New Learning Resource' : 'New Lesson Published',
        text:  `${req.user.name} shared: "${entryName}"`,
        type:  'lesson_added',
      })));
    }
    res.status(201).json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/lessons/:id */
app.put('/api/lessons/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Not found' });
    
    // Strict ownership check
    if (lesson.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own lessons' });
    }

    const { project, type, tech, challenge, solution, tags, impact, visibility, fileUrl, fileName, title, description, link } = req.body;
    const cat = lesson.category || 'project';

    if (cat === 'project') {
      if (project)   lesson.project   = project.trim();
      if (type)      lesson.type      = type;
      if (tech)      lesson.tech      = tech.map(t => t.trim()).filter(Boolean);
      if (challenge) lesson.challenge = challenge.trim();
      if (solution)  lesson.solution  = solution.trim();
      if (impact)    lesson.impact    = impact;
    } else {
      if (title)       lesson.title       = title.trim();
      if (description) lesson.description = description.trim();
      if (link !== undefined) {
        if (link && !/^https?:\/\/.+/i.test(link.trim())) {
          return res.status(400).json({ error: 'Link must be a valid URL' });
        }
        lesson.link = link?.trim() || undefined;
      }
    }

    // Common fields
    if (tags)      lesson.tags      = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
    if (visibility)lesson.visibility= visibility;
    if (fileUrl !== undefined) lesson.fileUrl = fileUrl;
    if (fileName !== undefined) lesson.fileName = fileName;
    await lesson.save();
    await lesson.populate('author', 'name initials color username');
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/lessons/:id */
app.delete('/api/lessons/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Not found' });

    // Strict ownership check
    if (lesson.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own lessons' });
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
    const candidates = await Lesson.find({ _id: { $ne: target._id }, visibility: { $ne: 'private' } })
      .populate('author', 'name initials color username');
    const ranked = candidates
      .map(l => {
        const score = calcSimilarity(target, l);
        const sharedTech = target.tech.filter(t => l.tech.includes(t)).length;
        const sharedTags = target.tags.filter(t => l.tags.includes(t)).length;
        return {
          ...l.toObject(),
          score,
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
//  ROUTES — BOOKMARKS
// ══════════════════════════════════════════════════════════

/** GET /api/bookmarks */
app.get('/api/bookmarks', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'bookmarks',
      populate: { path: 'author', select: 'name initials color username' },
    });
    res.json(user.bookmarks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/bookmarks/:lessonId — toggle */
app.post('/api/bookmarks/:lessonId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const lid  = new mongoose.Types.ObjectId(req.params.lessonId);
    const idx  = user.bookmarks.findIndex(id => id.equals(lid));
    let added;
    if (idx > -1) { user.bookmarks.splice(idx, 1); added = false; }
    else          { user.bookmarks.push(lid);        added = true;  }
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
//  ROUTES — FILE UPLOAD
// ══════════════════════════════════════════════════════════

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid format' });
  res.json({ fileUrl: '/uploads/' + req.file.filename, fileName: req.file.originalname });
});



// ══════════════════════════════════════════════════════════
//  ROUTES — STATS
// ══════════════════════════════════════════════════════════

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [totalLessons, totalUsers, highImpact, types, topTech] = await Promise.all([
      Lesson.countDocuments(),
      User.countDocuments(),
      Lesson.countDocuments({ impact: 'high' }),
      Lesson.distinct('type'),
      Lesson.aggregate([
        { $unwind: '$tech' },
        { $group: { _id: '$tech', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    res.json({ totalLessons, totalUsers, highImpact, typeCount: types.length, topTech });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  SERVE FRONTEND
// ══════════════════════════════════════════════════════════
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀  LLMS Platform running on http://localhost:${PORT}\n`);
});
