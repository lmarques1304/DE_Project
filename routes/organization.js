/* =========================================================
   ORGANIZATION ROUTES

   GET /api/organization/dashboard

   Available to:
   - UC
   - Núcleos
   ========================================================= */

const express = require("express");
const db = require("../database/database");

const router = express.Router();

router.use((req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "Please sign in to access this dashboard."
        });
    }

    const user = db.prepare(`
        SELECT
            id,
            name,
            email,
            role,
            organization,
            email_verified
        FROM users
        WHERE id = ?
    `).get(req.session.userId);

    if (
        !user ||
        !["uc", "nuclei"].includes(user.role) ||
        user.email_verified !== 1
    ) {
        return res.status(403).json({
            error: "This dashboard is available to organizations only."
        });
    }

    req.organizationUser = user;
    next();
});

router.get("/dashboard", (req, res) => {
    try {
        const user = req.organizationUser;

        const proposals = db.prepare(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.category,
                p.status,
                p.created_at,
                p.voting_deadline,

                (
                    SELECT COUNT(*)
                    FROM votes v
                    WHERE v.proposal_id = p.id
                      AND v.vote = 'yes'
                ) AS yes_votes,

                (
                    SELECT COUNT(*)
                    FROM votes v
                    WHERE v.proposal_id = p.id
                      AND v.vote = 'no'
                ) AS no_votes

            FROM proposals p
            WHERE p.author_id = ?
              AND p.source = ?
            ORDER BY p.created_at DESC, p.id DESC
        `).all(user.id, user.role);

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        // Use a reliable YYYY-MM-DD date in Portugal.
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const getPart = type =>
            parts.find(part => part.type === type).value;

        const portugalToday =
            `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

        const stats = {
            total_proposals: proposals.length,

            active_votings: proposals.filter(
                p =>
                    p.status === "approved" &&
                    p.voting_deadline >= portugalToday
            ).length,

            completed_votings: proposals.filter(
                p =>
                    p.status === "approved" &&
                    p.voting_deadline < portugalToday
            ).length,

            total_votes_received: proposals.reduce(
                (total, p) =>
                    total +
                    Number(p.yes_votes) +
                    Number(p.no_votes),
                0
            )
        };

        return res.json({
            organization: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organization: user.organization
            },
            stats,
            proposals
        });

    } catch (error) {
        console.error(
            "Organization dashboard error:",
            error
        );

        return res.status(500).json({
            error: "Unable to load organization dashboard."
        });
    }
});

module.exports = router;
