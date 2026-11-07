/* =========================================================
   STUDENT ROUTES

   GET /api/student/dashboard

   - Student profile
   - Own proposals
   - Own voting history
   - Voting statistics
   ========================================================= */

const express = require("express");
const db = require("../database/database");

const router = express.Router();

router.use((req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "Please sign in to access your dashboard."
        });
    }

    const student = db.prepare(`
        SELECT
            id,
            name,
            email,
            role,
            email_verified
        FROM users
        WHERE id = ?
    `).get(req.session.userId);

    if (
        !student ||
        student.role !== "student" ||
        student.email_verified !== 1
    ) {
        return res.status(403).json({
            error: "This dashboard is available to students only."
        });
    }

    req.student = student;
    next();
});

router.get("/dashboard", (req, res) => {
    try {
        const student = req.student;

        const proposals = db.prepare(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.category,
                p.anonymous,
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
              AND p.source = 'student'
            ORDER BY p.created_at DESC, p.id DESC
        `).all(student.id);

        const votes = db.prepare(`
            SELECT
                v.id,
                v.vote,
                v.created_at AS voted_at,

                p.id AS proposal_id,
                p.title,
                p.category,
                p.source,
                p.status AS proposal_status,
                p.voting_deadline,

                (
                    SELECT COUNT(*)
                    FROM votes other
                    WHERE other.proposal_id = p.id
                      AND other.vote = 'yes'
                ) AS yes_votes,

                (
                    SELECT COUNT(*)
                    FROM votes other
                    WHERE other.proposal_id = p.id
                      AND other.vote = 'no'
                ) AS no_votes

            FROM votes v
            JOIN proposals p ON p.id = v.proposal_id
            WHERE v.user_id = ?
            ORDER BY v.created_at DESC, v.id DESC
        `).all(student.id);

        const stats = {
            total_proposals: proposals.length,

            pending_proposals: proposals.filter(
                proposal => proposal.status === "pending"
            ).length,

            approved_proposals: proposals.filter(
                proposal => proposal.status === "approved"
            ).length,

            rejected_proposals: proposals.filter(
                proposal => proposal.status === "rejected"
            ).length,

            total_votes: votes.length
        };

        return res.json({
            student: {
                id: student.id,
                name: student.name,
                email: student.email
            },
            stats,
            proposals,
            votes
        });

    } catch (error) {
        console.error("Student dashboard error:", error);

        return res.status(500).json({
            error: "Unable to load student dashboard."
        });
    }
});

module.exports = router;