require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
const db = require("./db");

const authRoutes = require("./routes/auth");
const { search } = require("./slackbot");
const { getEvents, getShips } = require("./unified");

const app = express();
const PORT = process.env.PORT || 3000;

nunjucks.configure(path.join(__dirname, "views"), {
  autoescape: true,
  express: app,
  watch: process.env.NODE_ENV !== "production",
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new pgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  })
);

async function loadUser(req, res, next) {
  if (req.session.userId) {
    try {
      const user = await db("users").where("id", req.session.userId).first();
      req.user = user || null;
      res.locals.user = req.user;
    } catch (err) {
      console.error("Error loading user:", err);
      req.user = null;
      res.locals.user = null;
    }
  } else {
    req.user = null;
    res.locals.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect("/auth/login");
  }
  next();
}

app.use(loadUser);

const limiter = rateLimit({
  windowMs: 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});

app.use(limiter);

app.use("/auth", authRoutes);

app.get("/", async (req, res) => {
  try {
    const events = await getEvents();
    const projects = events.map((name) => ({ name }));
    res.render("index.njk", { title: "Meta Ship Rate", projects });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.render("index.njk", { title: "Meta Ship Rate", projects: [] });
  }
});

app.get("/event/:eventName", async (req, res) => {
  try {
    const eventName = req.params.eventName;
    const useAll = req.query.useAll === 'true';
    const [ships, metaResult] = await Promise.all([
      getShips(eventName),
      search(eventName),
    ]);
    
    const rawMetaPosts = metaResult.rawPostCount;
    const metaPosts = useAll ? rawMetaPosts : metaResult.metaPostCount;
    const effectiveCount = metaPosts > 0 ? metaPosts : rawMetaPosts;
    const rate = effectiveCount > 0 ? (ships / effectiveCount).toFixed(2) : 0;
    
    res.render("event.njk", {
      eventName,
      ships: ships || 0,
      metaPosts: metaResult.metaPostCount,
      rawMetaPosts,
      rate,
      useAll,
    });
  } catch (err) {
    console.error("Error fetching event data:", err);
    res.status(500).send("Error loading event data");
  }
});

app.get("/event/:eventName/posts", requireAuth, async (req, res) => {
  try {
    const eventName = req.params.eventName;
    const result = await search(eventName);
    res.render("posts.njk", { eventName, posts: result.posts });
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).send("Error loading posts");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
