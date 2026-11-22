const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// DATABASE CONFIGURATION
const databaseFolder = __dirname;
const databasePath = path.join(databaseFolder, "instantDemocracy.db");

if (!fs.existsSync(databaseFolder)) {
    fs.mkdirSync(databaseFolder, { recursive: true });
}

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

// USERS TABLE
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (
            role IN ('student', 'admin', 'uc', 'nuclei')
        ),
        organization TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0
            CHECK (email_verified IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

const userColumns = db.prepare(
    "PRAGMA table_info(users)"
).all();

const hasEmailVerified = userColumns.some(
    column => column.name === "email_verified"
);

if (!hasEmailVerified) {
    db.exec(`
        ALTER TABLE users
        ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1
            CHECK (email_verified IN (0, 1))
    `);

    console.log("Email verification column added.");
}

// EMAIL VERIFICATIONS TABLE
db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

// PROPOSALS TABLE
db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        author_id INTEGER NOT NULL,

        source TEXT NOT NULL CHECK (
            source IN ('student', 'uc', 'nuclei')
        ),

        anonymous INTEGER NOT NULL DEFAULT 0,

        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (
                status IN ('pending', 'approved', 'rejected')
            ),

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        voting_deadline TEXT,

        rejection_reason TEXT,

        FOREIGN KEY (author_id)
            REFERENCES users(id)
    );
`);

// PROPOSALS TABLE — DATABASE MIGRATIONS
const proposalColumns = db.prepare(
    "PRAGMA table_info(proposals)"
).all();

// VOTING DEADLINE MIGRATION
if (!proposalColumns.some(
    column => column.name === "voting_deadline"
)) {
    db.exec(`
        ALTER TABLE proposals
        ADD COLUMN voting_deadline TEXT
    `);

    console.log("Voting deadline column added.");
}

// REJECTION REASON MIGRATION
if (!proposalColumns.some(
    column => column.name === "rejection_reason"
)) {
    db.exec(`
        ALTER TABLE proposals
        ADD COLUMN rejection_reason TEXT
    `);

    console.log("Rejection reason column added.");
}

// DEFAULT VOTING DEADLINE FOR EXISTING PROPOSALS
function portugalDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const get = type =>
        parts.find(part => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
}

const tomorrow = new Date(
    `${portugalDate()}T12:00:00Z`
);

tomorrow.setUTCDate(
    tomorrow.getUTCDate() + 1
);

const defaultDeadline = tomorrow
    .toISOString()
    .slice(0, 10);

db.prepare(`
    UPDATE proposals
    SET voting_deadline = ?
    WHERE voting_deadline IS NULL
`).run(defaultDeadline);

// VOTES TABLE
db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,
        proposal_id INTEGER NOT NULL,

        vote TEXT NOT NULL CHECK (
            vote IN ('yes', 'no')
        ),

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id, proposal_id),

        FOREIGN KEY (user_id)
            REFERENCES users(id),

        FOREIGN KEY (proposal_id)
            REFERENCES proposals(id)
    );
`);


/* =========================================================
   DEBATES TABLE
   ========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS debates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,

        author_id INTEGER NOT NULL,

        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (
                status IN ('pending', 'approved', 'rejected')
            ),

        rejection_reason TEXT,

        reviewed_by INTEGER,
        reviewed_at TEXT,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (author_id)
            REFERENCES users(id),

        FOREIGN KEY (reviewed_by)
            REFERENCES users(id)
    );
`);

/* =========================================================
   DEBATE COMMENTS TABLE
   ========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS debate_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        debate_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,

        content TEXT NOT NULL,

        anonymous INTEGER NOT NULL DEFAULT 0
            CHECK (anonymous IN (0, 1)),

        hidden INTEGER NOT NULL DEFAULT 0
            CHECK (hidden IN (0, 1)),

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (debate_id)
            REFERENCES debates(id)
            ON DELETE CASCADE,

        FOREIGN KEY (author_id)
            REFERENCES users(id)
    );
`);

/* =========================================================
   DEBATE COMMENT LIKES TABLE
   ========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS debate_comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(comment_id, user_id),

        FOREIGN KEY (comment_id)
            REFERENCES debate_comments(id)
            ON DELETE CASCADE,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
    );
`);

/* =========================================================
   COMMENT REPORTS TABLE
   ========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS debate_comment_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        comment_id INTEGER NOT NULL,
        reporter_id INTEGER NOT NULL,

        reason TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'reviewed')),

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(comment_id, reporter_id),

        FOREIGN KEY (comment_id)
            REFERENCES debate_comments(id)
            ON DELETE CASCADE,

        FOREIGN KEY (reporter_id)
            REFERENCES users(id)
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_debates_category_status
    ON debates(category, status, created_at);

    CREATE INDEX IF NOT EXISTS idx_debate_comments_debate
    ON debate_comments(debate_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_debate_likes_comment
    ON debate_comment_likes(comment_id);

    CREATE INDEX IF NOT EXISTS idx_debate_reports_status
    ON debate_comment_reports(status);
`);

// DATABASE READY
console.log("Database initialized successfully.");
module.exports = db;