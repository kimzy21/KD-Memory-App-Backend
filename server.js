require('dotenv').config();
var express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

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

app.use(cors({
  origin: "*", // Allow all for local testing
}));
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

/* -------- TIMELINE -------- */
app.get("/timeline", async (req, res) => {
  const timeline = await db
    .collection("Timeline")
    .find({})
    .sort({ date: 1 })
    .toArray();
  res.json(timeline);
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


app.use((req, res) => {
  res.status(404).send("Resource not found");
}); 

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🌸 Server running on port ${PORT}`);
});