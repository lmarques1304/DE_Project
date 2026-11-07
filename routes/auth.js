/* =========================================================
   AUTH ROUTES

   POST /api/auth/login
   POST /api/auth/register
   GET  /api/auth/verify-email
   GET  /api/auth/me
   POST /api/auth/logout
   ========================================================= */

const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const db = require("../database/database");
const { sendEmail } = require("../services/email");

const router = express.Router();

const VERIFICATION_DURATION = 60 * 60 * 1000;

function createVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

router.post("/login", (req, res) => {
    const { email, password } = req.body || {};

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: "Email and password are required."
        });
    }

    const user = db.prepare(`
        SELECT
            id,
            name,
            email,
            password,
            role,
            organization,
            email_verified
        FROM users
        WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({
            error: "Invalid email or password."
        });
    }

    if (user.email_verified !== 1) {
        return res.status(403).json({
            error: "Please verify your email before signing in."
        });
    }

    req.session.regenerate((error) => {
        if (error) {
            return res.status(500).json({
                error: "Could not start session."
            });
        }

        req.session.userId = user.id;

        req.session.save((saveError) => {
            if (saveError) {
                return res.status(500).json({
                    error: "Could not save session."
                });
            }

            return res.json({
                message: "Login successful.",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organization: user.organization
                }
            });
        });
    });
});

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body || {};

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            error: "All fields are required."
        });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
        return res.status(400).json({
            error: "All fields are required."
        });
    }

    if (cleanName.length < 2 || cleanName.length > 100) {
        return res.status(400).json({
            error: "Name must contain between 2 and 100 characters."
        });
    }

    if (
        cleanEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
        return res.status(400).json({
            error: "Please enter a valid email address."
        });
    }

    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({
            error: "Password must contain between 8 and 72 characters."
        });
    }

    const existingUser = db.prepare(`
        SELECT id
        FROM users
        WHERE email = ?
    `).get(cleanEmail);

    if (existingUser) {
        return res.status(409).json({
            error: "An account with this email already exists."
        });
    }

    let newUserId = null;

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const token = createVerificationToken();
        const tokenHash = hashToken(token);
        const expiresAt = Date.now() + VERIFICATION_DURATION;

        const createAccount = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO users (
                    name,
                    email,
                    password,
                    role,
                    email_verified
                )
                VALUES (?, ?, ?, 'student', 0)
            `).run(cleanName, cleanEmail, hashedPassword);

            const userId = Number(result.lastInsertRowid);

            db.prepare(`
                INSERT INTO email_verifications (
                    user_id,
                    token_hash,
                    expires_at
                )
                VALUES (?, ?, ?)
            `).run(userId, tokenHash, expiresAt);

            return userId;
        });

        newUserId = createAccount();

        const baseUrl = (
            process.env.APP_URL || "http://localhost:3000"
        ).replace(/\/+$/, "");

        const verificationLink =
            `${baseUrl}/api/auth/verify-email?token=${token}`;

        await sendEmail({
            to: cleanEmail,
            subject: "Verify your email — Instant Democracy",

            text: `
Hello ${cleanName},

Welcome to Instant Democracy!

To activate your account, open this link:

${verificationLink}

This link expires in 1 hour.

If you did not create this account, you can ignore this email.

Instant Democracy
            `.trim(),

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 560px;
                    margin: auto;
                    padding: 32px;
                    color: #222;
                ">
                    <h1 style="color: #28db25;">
                        Instant Democracy
                    </h1>

                    <h2>Verify your email</h2>

                    <p>
                        Hello ${escapeHtml(cleanName)},
                    </p>

                    <p>
                        Welcome to Instant Democracy!
                        Please confirm your email address
                        to activate your account.
                    </p>

                    <p style="margin: 32px 0;">
                        <a href="${verificationLink}"
                           style="
                               background: #28db25;
                               color: #111;
                               text-decoration: none;
                               padding: 14px 24px;
                               border-radius: 8px;
                               font-weight: bold;
                           ">
                            Verify my email
                        </a>
                    </p>

                    <p>
                        This link expires in 1 hour.
                    </p>

                    <p style="color: #666; font-size: 13px;">
                        If you did not create this account,
                        you can ignore this email.
                    </p>
                </div>
            `
        });

        return res.status(201).json({
            message:
                "Account created! Check your email to verify your account."
        });

    } catch (error) {
        console.error("Registration error:", error);

        if (newUserId !== null) {
            try {
                db.prepare(`
                    DELETE FROM users
                    WHERE id = ?
                      AND email_verified = 0
                `).run(newUserId);
            } catch (cleanupError) {
                console.error(
                    "Registration cleanup error:",
                    cleanupError
                );
            }

            return res.status(503).json({
                error:
                    "We could not send the verification email. Please try again."
            });
        }

        if (
            error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
        ) {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        return res.status(500).json({
            error: "Unable to create account. Please try again."
        });
    }
});

router.get("/verify-email", (req, res) => {
    const { token } = req.query;

    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token)
    ) {
        return res.status(400).send(
            "Invalid verification link."
        );
    }

    const tokenHash = hashToken(token);

    try {
        const verifyAccount = db.transaction(() => {
            const verification = db.prepare(`
                SELECT
                    ev.user_id,
                    ev.expires_at,
                    u.email_verified
                FROM email_verifications ev
                JOIN users u ON u.id = ev.user_id
                WHERE ev.token_hash = ?
            `).get(tokenHash);

            if (!verification) {
                return "invalid";
            }

            if (verification.expires_at < Date.now()) {
                return "expired";
            }

            if (verification.email_verified === 1) {
                return "already_verified";
            }

            db.prepare(`
                UPDATE users
                SET email_verified = 1
                WHERE id = ?
            `).run(verification.user_id);

            db.prepare(`
                DELETE FROM email_verifications
                WHERE user_id = ?
            `).run(verification.user_id);

            return "success";
        });

        const result = verifyAccount();

        if (result === "invalid") {
            return res.status(400).send(
                "This verification link is invalid or has already been used."
            );
        }

        if (result === "expired") {
            return res.status(410).send(
                "This verification link has expired."
            );
        }

        if (result === "already_verified") {
            return res.redirect("/login.html");
        }

        return res.redirect(
            "/login.html?verified=1"
        );

    } catch (error) {
        console.error("Email verification error:", error);

        return res.status(500).send(
            "Unable to verify your email. Please try again."
        );
    }
});

router.get("/me", (req, res) => {
    if (!req.session.userId) {
        return res.json({ user: null });
    }

    const user = db.prepare(`
        SELECT
            id,
            name,
            email,
            role,
            organization
        FROM users
        WHERE id = ?
          AND email_verified = 1
    `).get(req.session.userId);

    if (!user) {
        return res.json({ user: null });
    }

    return res.json({ user });
});

router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "Could not log out."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            message: "Logout successful."
        });
    });
});

module.exports = router;
