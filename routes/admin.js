const express = require("express");
const db = require("../database/database");

const router = express.Router();

const debateColumns = db.prepare(
    "PRAGMA table_info(debates)"
).all();

if (
    debateColumns.length > 0 &&
    !debateColumns.some(
        column => column.name === "rejection_reason"
    )
) {
    db.exec(`
        ALTER TABLE debates
        ADD COLUMN rejection_reason TEXT
    `);

    console.log(
        "Debates rejection reason column added."
    );
}

const hasDebateAnonymousColumn = debateColumns.some(
    column => column.name === "anonymous"
);

function getPortugalDate() {
    const parts = new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).formatToParts(new Date());

    const get = type =>
        parts.find(part => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
}

function validId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function getRejectionReason(body) {
    return typeof body?.rejectionReason === "string"
        ? body.rejectionReason.trim()
        : "";
}

router.use((req, res, next) => {

    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "You must be signed in."
        });
    }

    const user = db.prepare(`
        SELECT id, role, email_verified
        FROM users
        WHERE id = ?
    `).get(req.session.userId);

    if (!user || user.email_verified !== 1) {
        return res.status(401).json({
            error: "Your account is not authenticated."
        });
    }

    if (user.role !== "admin") {
        return res.status(403).json({
            error: "Administrator access required."
        });
    }

    next();
});

router.get("/proposals", (req, res) => {

    try {

        const proposals = db.prepare(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.category,
                p.source,
                p.anonymous,
                p.status,
                p.created_at,
                p.voting_deadline,
                p.rejection_reason,

                u.id AS author_id,
                u.name AS author_name,
                u.email AS author_email,
                u.role AS author_role

            FROM proposals p

            JOIN users u
                ON u.id = p.author_id

            ORDER BY
                CASE p.status
                    WHEN 'pending' THEN 0
                    WHEN 'approved' THEN 1
                    ELSE 2
                END,
                p.created_at DESC,
                p.id DESC
        `).all();

        const stats = {
            total: proposals.length,

            pending: proposals.filter(
                p => p.status === "pending"
            ).length,

            approved: proposals.filter(
                p => p.status === "approved"
            ).length,

            rejected: proposals.filter(
                p => p.status === "rejected"
            ).length
        };

        res.json({
            proposals,
            stats
        });

    } catch (error) {

        console.error(
            "Admin proposals error:",
            error
        );

        res.status(500).json({
            error: "Unable to load proposals."
        });
    }
});

router.patch(
    "/proposals/:id/status",
    (req, res) => {

        const id = validId(req.params.id);

        const { status } = req.body || {};

        const reason = getRejectionReason(req.body);

        if (!id) {
            return res.status(400).json({
                error: "Invalid proposal ID."
            });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                error: "Invalid moderation decision."
            });
        }

        if (
            status === "rejected" &&
            (reason.length < 10 || reason.length > 500)
        ) {
            return res.status(400).json({
                error:
                    "A rejection reason between 10 and 500 characters is required."
            });
        }

        try {

            const proposal = db.prepare(`
                SELECT
                    id,
                    status,
                    source,
                    voting_deadline

                FROM proposals
                WHERE id = ?
            `).get(id);

            if (
                !proposal ||
                proposal.status !== "pending"
            ) {
                return res.status(409).json({
                    error:
                        "Proposal not found or already reviewed."
                });
            }

            if (proposal.source !== "student") {
                return res.status(403).json({
                    error:
                        "Only student proposals require publication moderation."
                });
            }

            if (status === "approved") {

                const today = getPortugalDate();

                if (
                    !proposal.voting_deadline ||
                    proposal.voting_deadline < today
                ) {
                    return res.status(409).json({
                        error:
                            "This proposal cannot be published because its voting deadline has expired or is missing."
                    });
                }
            }

            const result = db.prepare(`
                UPDATE proposals

                SET
                    status = ?,
                    rejection_reason = ?

                WHERE id = ?
                  AND status = 'pending'
            `).run(
                status,
                status === "rejected" ? reason : null,
                id
            );

            if (result.changes === 0) {
                return res.status(409).json({
                    error:
                        "Proposal not found or already reviewed."
                });
            }

            res.json({
                message:
                    status === "approved"
                        ? "Proposal published successfully."
                        : "Proposal publication rejected successfully.",

                proposal: {
                    id,
                    status,

                    rejection_reason:
                        status === "rejected"
                            ? reason
                            : null
                }
            });

        } catch (error) {

            console.error(
                "Proposal moderation error:",
                error
            );

            res.status(500).json({
                error: "Unable to update proposal."
            });
        }
    }
);

/* =========================================================
   GET ALL DEBATES
   GET /api/admin/debates
   ========================================================= */

router.get("/debates", (req, res) => {

    try {

        const anonymousSelect =
            hasDebateAnonymousColumn
                ? "d.anonymous"
                : "0 AS anonymous";

        const debates = db.prepare(`
            SELECT
                d.id,
                d.title,
                d.description,
                d.category,
                d.status,
                d.created_at,
                d.rejection_reason,

                ${anonymousSelect},

                u.id AS author_id,
                u.name AS author_name,
                u.email AS author_email,
                u.role AS author_role

            FROM debates d

            JOIN users u
                ON u.id = d.author_id

            ORDER BY
                CASE d.status
                    WHEN 'pending' THEN 0
                    WHEN 'approved' THEN 1
                    ELSE 2
                END,
                d.created_at DESC,
                d.id DESC
        `).all();

        const stats = {
            total: debates.length,

            pending: debates.filter(
                debate => debate.status === "pending"
            ).length,

            approved: debates.filter(
                debate => debate.status === "approved"
            ).length,

            rejected: debates.filter(
                debate => debate.status === "rejected"
            ).length
        };

        res.json({
            debates,
            stats
        });

    } catch (error) {

        console.error(
            "Admin debates error:",
            error
        );

        res.status(500).json({
            error: "Unable to load debates."
        });
    }
});

/* =========================================================
   MODERATE DEBATE
   PATCH /api/admin/debates/:id/status
   ========================================================= */

router.patch(
    "/debates/:id/status",
    (req, res) => {

        const id = validId(req.params.id);

        const { status } = req.body || {};

        const reason = getRejectionReason(req.body);

        if (!id) {
            return res.status(400).json({
                error: "Invalid debate ID."
            });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                error: "Invalid moderation decision."
            });
        }

        if (
            status === "rejected" &&
            (reason.length < 10 || reason.length > 500)
        ) {
            return res.status(400).json({
                error:
                    "A rejection reason between 10 and 500 characters is required."
            });
        }

        try {

            const debate = db.prepare(`
                SELECT
                    d.id,
                    d.status,
                    u.role AS author_role

                FROM debates d

                JOIN users u
                    ON u.id = d.author_id

                WHERE d.id = ?
            `).get(id);

            if (
                !debate ||
                debate.status !== "pending"
            ) {
                return res.status(409).json({
                    error:
                        "Debate not found or already reviewed."
                });
            }

            if (debate.author_role !== "student") {
                return res.status(403).json({
                    error:
                        "Only student debates can be submitted for moderation."
                });
            }

            const result = db.prepare(`
                UPDATE debates

                SET
                    status = ?,
                    rejection_reason = ?

                WHERE id = ?
                  AND status = 'pending'
            `).run(
                status,
                status === "rejected" ? reason : null,
                id
            );

            if (result.changes === 0) {
                return res.status(409).json({
                    error:
                        "Debate not found or already reviewed."
                });
            }

            res.json({
                message:
                    status === "approved"
                        ? "Debate published successfully."
                        : "Debate rejected successfully.",

                debate: {
                    id,
                    status,

                    rejection_reason:
                        status === "rejected"
                            ? reason
                            : null
                }
            });

        } catch (error) {

            console.error(
                "Debate moderation error:",
                error
            );

            res.status(500).json({
                error: "Unable to update debate."
            });
        }
    }
);

module.exports = router;
