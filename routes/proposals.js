/* =========================================================
   PROPOSALS ROUTES

   GET  /api/proposals
   GET  /api/proposals/approved
   POST /api/proposals
   POST /api/proposals/:id/vote

   IMPORTANT:
   Publication authorization and community approval
   are two different processes.
   ========================================================= */

const express = require("express");
const db = require("../database/database");

const router = express.Router();

function getPortugalDate() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const get = type =>
        parts.find(part => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
}

function getMinimumDeadline() {
    const today = getPortugalDate();
    const tomorrow = new Date(`${today}T12:00:00Z`);

    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return tomorrow.toISOString().slice(0, 10);
}

function isValidDeadline(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T12:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        value >= getMinimumDeadline()
    );
}

function isVotingOpen(deadline) {
    return (
        typeof deadline === "string" &&
        getPortugalDate() <= deadline
    );
}

const allowedCategories = [
    "Academic",
    "Campus Life",
    "Sports",
    "Sustainability",
    "Accessibility",
    "Culture",
    "Other"
];

const proposalRoles = [
    "student",
    "uc",
    "nuclei"
];

function getCurrentUser(req) {
    if (!req.session || !req.session.userId) {
        return null;
    }

    const user = db.prepare(`
        SELECT
            id,
            name,
            role,
            organization,
            email_verified
        FROM users
        WHERE id = ?
    `).get(req.session.userId);

    if (!user || user.email_verified !== 1) {
        return null;
    }

    return user;
}

function getStudent(req) {
    const user = getCurrentUser(req);

    return user && user.role === "student"
        ? user
        : null;
}

/* =========================================================
   GET COMMUNITY-APPROVED PROPOSALS

   A proposal is approved by the community only when:
   1. It was authorized for publication
   2. Its voting period has ended
   3. Yes votes are greater than No votes

   Publication authorization alone is NOT approval.
   ========================================================= */

router.get("/approved", (req, res) => {
    try {
        const today = getPortugalDate();

        const proposals = db.prepare(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.category,
                p.source,
                p.anonymous,
                p.created_at,
                p.voting_deadline,

                CASE
                    WHEN p.anonymous = 1 THEN NULL
                    WHEN p.source IN ('uc', 'nuclei')
                        THEN COALESCE(u.organization, u.name)
                    ELSE u.name
                END AS author_name,

                CASE
                    WHEN p.source = 'nuclei'
                        THEN u.organization
                    ELSE NULL
                END AS organization,

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
            JOIN users u ON u.id = p.author_id

            WHERE p.status = 'approved'
              AND p.voting_deadline IS NOT NULL
              AND p.voting_deadline < ?

            ORDER BY
                p.voting_deadline DESC,
                p.id DESC
        `).all(today);

        const approvedProposals = proposals
            .filter(proposal =>
                proposal.yes_votes > proposal.no_votes
            )
            .map(proposal => {
                const totalVotes =
                    proposal.yes_votes + proposal.no_votes;

                return {
                    ...proposal,
                    total_votes: totalVotes,
                    yes_percentage: Math.round(
                        (proposal.yes_votes / totalVotes) * 100
                    ),
                    no_percentage: Math.round(
                        (proposal.no_votes / totalVotes) * 100
                    ),
                    voting_open: false,
                    voting_result: "approved"
                };
            });

        return res.json({
            proposals: approvedProposals
        });

    } catch (error) {
        console.error(
            "Error loading community-approved proposals:",
            error
        );

        return res.status(500).json({
            error: "Unable to load approved proposals."
        });
    }
});

/* =========================================================
   GET PUBLICLY AVAILABLE PROPOSALS

   These proposals were authorized for publication.

   They may still be:
   - Open for voting
   - Closed and approved by the community
   - Closed and not approved by the community

   ========================================================= */

router.get("/", (req, res) => {
    try {
        const student = getStudent(req);

        const proposals = db.prepare(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.category,
                p.source,
                p.anonymous,
                p.created_at,
                p.voting_deadline,

                CASE
                    WHEN p.anonymous = 1 THEN NULL
                    WHEN p.source IN ('uc', 'nuclei')
                        THEN COALESCE(u.organization, u.name)
                    ELSE u.name
                END AS author_name,

                CASE
                    WHEN p.source = 'nuclei'
                        THEN u.organization
                    ELSE NULL
                END AS organization,

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
            JOIN users u ON u.id = p.author_id

            WHERE p.status = 'approved'

            ORDER BY
                p.created_at DESC,
                p.id DESC
        `).all();

        let voteMap = new Map();

        if (student) {
            const ownVotes = db.prepare(`
                SELECT
                    proposal_id,
                    vote
                FROM votes
                WHERE user_id = ?
            `).all(student.id);

            voteMap = new Map(
                ownVotes.map(v => [v.proposal_id, v.vote])
            );
        }

        for (const proposal of proposals) {
            proposal.user_vote =
                voteMap.get(proposal.id) || null;

            proposal.voting_open =
                isVotingOpen(proposal.voting_deadline);

            if (proposal.voting_open) {
                proposal.voting_result = "ongoing";
            } else if (proposal.yes_votes > proposal.no_votes) {
                proposal.voting_result = "approved";
            } else {
                proposal.voting_result = "not_approved";
            }
        }

        return res.json({ proposals });

    } catch (error) {
        console.error("Error loading proposals:", error);

        return res.status(500).json({
            error: "Unable to load proposals."
        });
    }
});

/* =========================================================
   CREATE PROPOSAL

   Students:
   - Require administrator moderation
   - May choose anonymity

   UC / Núcleos:
   - Published immediately
   - Always publicly identified

   Publishing does NOT mean community approval.
   ========================================================= */

router.post("/", (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "Please sign in before submitting a proposal."
        });
    }

    const user = getCurrentUser(req);

    if (!user || !proposalRoles.includes(user.role)) {
        return res.status(403).json({
            error: "Your account cannot submit proposals."
        });
    }

    const {
        title,
        description,
        category,
        anonymous,
        votingDeadline
    } = req.body || {};

    if (
        typeof title !== "string" ||
        typeof description !== "string" ||
        typeof category !== "string"
    ) {
        return res.status(400).json({
            error: "Invalid proposal information."
        });
    }

    if (
        user.role === "student" &&
        typeof anonymous !== "boolean"
    ) {
        return res.status(400).json({
            error: "Invalid anonymity selection."
        });
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (
        cleanTitle.length < 5 ||
        cleanTitle.length > 120
    ) {
        return res.status(400).json({
            error: "Title must contain between 5 and 120 characters."
        });
    }

    if (
        cleanDescription.length < 30 ||
        cleanDescription.length > 3000
    ) {
        return res.status(400).json({
            error: "Description must contain between 30 and 3000 characters."
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({
            error: "Please select a valid category."
        });
    }

    if (!isValidDeadline(votingDeadline)) {
        return res.status(400).json({
            error:
                "Voting deadline must be a valid date " +
                "of tomorrow or later."
        });
    }

    const isStudent = user.role === "student";

    const source = user.role;

    const isAnonymous = isStudent && anonymous === true ? 1 : 0;
        
    const status = isStudent ? "pending" : "approved";

    try {
        const result = db.prepare(`
            INSERT INTO proposals (
                title,
                description,
                category,
                author_id,
                source,
                anonymous,
                status,
                voting_deadline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            cleanTitle,
            cleanDescription,
            category,
            user.id,
            source,
            isAnonymous,
            status,
            votingDeadline
        );

        const message = isStudent
            ? "Proposal submitted successfully! " +
              "It is now waiting for administrator review " +
              "before publication."
            : "Proposal published successfully! " +
              "Students can now vote on it.";

        return res.status(201).json({
            message,

            proposal: {
                id: Number(result.lastInsertRowid),
                title: cleanTitle,
                category,
                source,
                anonymous: Boolean(isAnonymous),
                status,
                voting_deadline: votingDeadline
            }
        });

    } catch (error) {
        console.error("Proposal creation error:", error);

        return res.status(500).json({
            error: "Unable to submit proposal."
        });
    }
});

/* =========================================================
   VOTE ON A PUBLISHED PROPOSAL

   Only verified students may vote.
   Each student can vote once per proposal.
   Voting is only allowed before the deadline ends.
   ========================================================= */

router.post("/:id/vote", (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "Please sign in to vote."
        });
    }

    const student = getStudent(req);

    if (!student) {
        return res.status(403).json({
            error: "Only verified students can vote."
        });
    }

    const proposalId = Number(req.params.id);
    const { vote } = req.body || {};

    if (
        !Number.isSafeInteger(proposalId) ||
        proposalId <= 0
    ) {
        return res.status(400).json({
            error: "Invalid proposal ID."
        });
    }

    if (vote !== "yes" && vote !== "no") {
        return res.status(400).json({
            error: "Vote must be yes or no."
        });
    }

    try {
        const proposal = db.prepare(`
            SELECT
                id,
                status,
                voting_deadline
            FROM proposals
            WHERE id = ?
        `).get(proposalId);

        if (
            !proposal ||
            proposal.status !== "approved"
        ) {
            return res.status(404).json({
                error:
                    "This proposal is not available for voting."
            });
        }

        if (!isVotingOpen(proposal.voting_deadline)) {
            return res.status(403).json({
                error:
                    "Voting has closed for this proposal."
            });
        }

        const result = db.prepare(`
            INSERT OR IGNORE INTO votes (
                user_id,
                proposal_id,
                vote
            )
            VALUES (?, ?, ?)
        `).run(
            student.id,
            proposalId,
            vote
        );

        if (result.changes === 0) {
            return res.status(409).json({
                error:
                    "You have already voted on this proposal."
            });
        }

        const results = db.prepare(`
            SELECT
                COUNT(
                    CASE WHEN vote = 'yes' THEN 1 END
                ) AS yes_votes,

                COUNT(
                    CASE WHEN vote = 'no' THEN 1 END
                ) AS no_votes

            FROM votes
            WHERE proposal_id = ?
        `).get(proposalId);

        return res.status(201).json({
            message:
                "Your vote has been recorded successfully.",

            proposal_id: proposalId,
            user_vote: vote,
            yes_votes: results.yes_votes,
            no_votes: results.no_votes
        });

    } catch (error) {
        console.error("Voting error:", error);

        return res.status(500).json({
            error: "Unable to record your vote."
        });
    }
});

module.exports = router;