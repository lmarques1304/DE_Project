
const express = require("express");
const db = require("../database/database");

const router = express.Router();

function getPortugalDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Lisbon",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

// Only authenticated administrators can use these routes.
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

// GET /api/admin/proposals
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
            JOIN users u ON u.id = p.author_id
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
            pending: proposals.filter(p => p.status === "pending").length,
            approved: proposals.filter(p => p.status === "approved").length,
            rejected: proposals.filter(p => p.status === "rejected").length
        };

        res.json({ proposals, stats });
    } catch (error) {
        console.error("Admin proposals error:", error);

        res.status(500).json({
            error: "Unable to load proposals."
        });
    }
});

// PATCH /api/admin/proposals/:id/status
router.patch("/proposals/:id/status", (req, res) => {
    const id = Number(req.params.id);
    const { status, rejectionReason } = req.body || {};

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid proposal ID."
        });
    }

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
            error: "Invalid moderation decision."
        });
    }

    const reason = typeof rejectionReason === "string"
        ? rejectionReason.trim()
        : "";

    if (status === "rejected") {
        if (reason.length < 10 || reason.length > 500) {
            return res.status(400).json({
                error: "A rejection reason between 10 and 500 characters is required."
            });
        }
    }

    try {
        const proposal = db.prepare(`
            SELECT id, status, source, voting_deadline
            FROM proposals
            WHERE id = ?
        `).get(id);

        if (!proposal || proposal.status !== "pending") {
            return res.status(409).json({
                error: "Proposal not found or already reviewed."
            });
        }

        if (proposal.source !== "student") {
            return res.status(403).json({
                error: "Only student proposals require publication moderation."
            });
        }

        if (status === "approved") {
            const today = getPortugalDate();

            if (
                !proposal.voting_deadline ||
                proposal.voting_deadline < today
            ) {
                return res.status(409).json({
                    error: "This proposal cannot be published because its voting deadline has expired or is missing."
                });
            }
        }

        const result = db.prepare(`
            UPDATE proposals
            SET
                status = ?,
                rejection_reason = ?
            WHERE id = ? AND status = 'pending'
        `).run(
            status,
            status === "rejected" ? reason : null,
            id
        );

        if (result.changes === 0) {
            return res.status(409).json({
                error: "Proposal not found or already reviewed."
            });
        }

        res.json({
            message: status === "approved"
                ? "Proposal published successfully."
                : "Proposal publication rejected successfully.",
            proposal: {
                id,
                status,
                rejection_reason: status === "rejected" ? reason : null
            }
        });
    } catch (error) {
        console.error("Moderation error:", error);

        res.status(500).json({
            error: "Unable to update proposal."
        });
    }
});

module.exports = router;
