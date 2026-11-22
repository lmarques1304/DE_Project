require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const db = require("./database/database");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret:
        process.env.SESSION_SECRET ||
        "instant-democracy-local-secret",

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 4
    }
}));

/* =========================================================
   API ROUTES
   ========================================================= */

const authRoutes = require("./routes/auth");
const proposalRoutes = require("./routes/proposals");
const adminRoutes = require("./routes/admin");
const studentRoutes = require("./routes/student");
const organizationRoutes = require("./routes/organization");
const debateRoutes = require("./routes/debates");

app.use("/api/auth", authRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/debates", debateRoutes);

/* =========================================================
   STATIC FILES
   ========================================================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
    console.log(
        `Instant Democracy running at http://localhost:${PORT}`
    );
});
