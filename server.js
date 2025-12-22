require('dotenv').config();
var express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const dbPrefix = process.env.DB_PREFIX;
const dbHost = process.env.DB_HOST;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbParams = process.env.DB_PARAMS;

const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}/${dbName}${dbParams}`;

const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let db;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "Assets"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .toLowerCase();

    const uniqueName = `${Date.now()}-${base}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectDB();

let app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

/* ---------- REQUEST LOGGING MIDDLEWARE ---------- */
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ---------- SERVE IMAGES FROM Assets ----------
app.use("/Assets", (req, res, next) => {
  const fullPath = path.join(__dirname, "Assets", req.path);

  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).send("Image not found");
    next();
  });
});

app.use("/Assets", express.static(path.join(__dirname, "Assets")));

/* -------- LOGIN -------- */
app.post("/login", (req, res) => {
  console.log("Login attempt:", req.body);
  if (req.body.password === process.env.APP_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});


/* -------- PHOTOS -------- */
app.get("/photos", async (req, res) => {
  const photos = await db.collection("Photos").find({}).toArray();
  res.json(photos);
});

app.post("/photos", upload.array("photos", 10), async (req, res) => {
  try {
    const { title, description, date } = req.body;

    if (!title || !req.files.length) {
      return res.status(400).json({ error: "Title and photos required" });
    }

    const photoPaths = req.files.map(f => `Assets/${f.filename}`);

    const doc = {
      title,
      description,
      date: new Date(date),
      cover: photoPaths[0],     // 👈 FIRST IMAGE = COVER
      photos: photoPaths
    };

    await db.collection("Photos").insertOne(doc);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* -------- TIMELINE -------- */
app.get("/timeline", async (req, res) => {
  const timeline = await db
    .collection("Timeline")
    .find({})
    .sort({ date: 1 })
    .toArray();
  res.json(timeline);
});

app.post("/timeline", upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, date } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: "Title and date required" });
    }

    const imagePaths = req.files
      ? req.files.map(f => `Assets/${f.filename}`)
      : [];

    const doc = {
      title,
      description,
      date: new Date(date),
      images: imagePaths
    };

    await db.collection("Timeline").insertOne(doc);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Timeline upload failed" });
  }
});

/* -------- NOTES -------- */
app.get("/notes", async (req, res) => {
  const notes = await db
    .collection("Notes")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  res.json(notes);
});

app.post("/notes", async (req, res) => {
  await db.collection("Notes").insertOne({
    sender: req.body.sender,
    message: req.body.message,
    createdAt: new Date()
  });
  res.json({ success: true });
});

/* -------- HEALTH -------- */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.use((req, res) => {
  res.status(404).send("Resource not found");
}); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  if (!process.env.PORT) {
    console.log(`🌐 BrainCart website: http://localhost:${PORT}`);
  }
});