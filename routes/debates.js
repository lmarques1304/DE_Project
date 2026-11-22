
const express = require("express");
const db = require("../database/database");

const router = express.Router();

/* =========================================================
   DEBATE CATEGORIES
   ========================================================= */

const CATEGORIES = [
    {
        slug: "academic-life",
        name: "Academic Life"
    },
    {
        slug: "campus-mobility",
        name: "Campus Mobility"
    },
    {
        slug: "canteens-and-food",
        name: "Canteens and Food"
    },
    {
        slug: "events-and-traditions",
        name: "Events and Traditions"
    },
    {
        slug: "sports-and-culture",
        name: "Sports and Culture"
    },
    {
        slug: "student-well-being",
        name: "Student Well-Being"
    },
    {
        slug: "study-spaces",
        name: "Study Spaces"
    },
    {
        slug: "workshops-and-skills",
        name: "Workshops and Skills"
    }
];

const VALID_CATEGORIES = new Set(
    CATEGORIES.map(category => category.slug)
);

/* =========================================================
   HELPERS
   ========================================================= */

function getCurrentUser(req) {
    const userId = req.session?.userId;

    if (!userId) {
        return null;
    }

    return db.prepare(`
        SELECT id, name, role, email_verified
        FROM users
        WHERE id = ?
    `).get(userId) || null;
}

function requireRole(role) {
    return (req, res, next) => {
        const user = getCurrentUser(req);

        if (!user || user.email_verified !== 1) {
            return res.status(401).json({
                error: "Please sign in to continue."
            });
        }

        if (user.role !== role) {
            return res.status(403).json({
                error: "You do not have permission to perform this action."
            });
        }

        req.authUser = user;
        next();
    };
}

function parseId(value) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function getDebate(id) {
    return db.prepare(`
        SELECT
            d.*,
            u.name AS author_name
        FROM debates d
        JOIN users u ON u.id = d.author_id
        WHERE d.id = ?
    `).get(id);
}

function getApprovedDebate(id) {
    return db.prepare(`
        SELECT id, status
        FROM debates
        WHERE id = ?
          AND status = 'approved'
    `).get(id);
}

/* =========================================================
   GET /api/debates/categories

   Eight categories with the three most recent
   approved debates in each category.
   ========================================================= */

router.get("/categories", (req, res) => {
    const countQuery = db.prepare(`
        SELECT COUNT(*) AS total
        FROM debates
        WHERE category = ?
          AND status = 'approved'
    `);

    const recentQuery = db.prepare(`
        SELECT
            d.id,
            d.title,
            d.description,
            d.category,
            d.created_at AS createdAt,

            (
                SELECT COUNT(*)
                FROM debate_comments c
                WHERE c.debate_id = d.id
                  AND c.hidden = 0
            ) AS commentCount,

            (
                SELECT c.content
                FROM debate_comments c
                WHERE c.debate_id = d.id
                  AND c.hidden = 0
                ORDER BY
                    (
                        SELECT COUNT(*)
                        FROM debate_comment_likes l
                        WHERE l.comment_id = c.id
                    ) DESC,
                    c.created_at DESC,
                    c.id DESC
                LIMIT 1
            ) AS topComment

        FROM debates d
        WHERE d.category = ?
          AND d.status = 'approved'

        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 3
    `);

    const categories = CATEGORIES.map(category => {
        const count = countQuery.get(category.slug);

        return {
            ...category,
            totalDebates: count.total,
            recentDebates: recentQuery.all(category.slug)
        };
    });

    return res.json({ categories });
});

/* =========================================================
   GET /api/debates/mine

   Student's own debates, including pending and rejected.
   ========================================================= */

router.get("/mine", requireRole("student"), (req, res) => {
    const debates = db.prepare(`
        SELECT
            id,
            title,
            description,
            category,
            status,
            rejection_reason AS rejectionReason,
            created_at AS createdAt
        FROM debates
        WHERE author_id = ?
        ORDER BY created_at DESC, id DESC
    `).all(req.authUser.id);

    return res.json({ debates });
});

/* =========================================================
   GET /api/debates/admin/pending

   Pending debates for administrator review.
   ========================================================= */

router.get(
    "/admin/pending",
    requireRole("admin"),
    (req, res) => {
        const debates = db.prepare(`
            SELECT
                d.id,
                d.title,
                d.description,
                d.category,
                d.created_at AS createdAt,

                u.id AS authorId,
                u.name AS authorName,
                u.email AS authorEmail

            FROM debates d
            JOIN users u ON u.id = d.author_id

            WHERE d.status = 'pending'

            ORDER BY d.created_at ASC, d.id ASC
        `).all();

        return res.json({ debates });
    }
);

/* =========================================================
   POST /api/debates/admin/:id/review

   Approve or reject a pending debate.
   ========================================================= */

router.post(
    "/admin/:id/review",
    requireRole("admin"),
    (req, res) => {
        const debateId = parseId(req.params.id);

        const { decision, reason } = req.body || {};

        if (!debateId) {
            return res.status(400).json({
                error: "Invalid debate ID."
            });
        }

        if (!["approved", "rejected"].includes(decision)) {
            return res.status(400).json({
                error: "Invalid review decision."
            });
        }

        const cleanReason =
            typeof reason === "string"
                ? reason.trim()
                : "";

        if (
            decision === "rejected" &&
            (cleanReason.length < 5 || cleanReason.length > 1000)
        ) {
            return res.status(400).json({
                error: "A rejection reason of 5 to 1000 characters is required."
            });
        }

        const result = db.prepare(`
            UPDATE debates

            SET status = ?,
                rejection_reason = ?,
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP

            WHERE id = ?
              AND status = 'pending'
        `).run(
            decision,
            decision === "rejected" ? cleanReason : null,
            req.authUser.id,
            debateId
        );

        if (result.changes === 0) {
            return res.status(404).json({
                error: "Pending debate not found."
            });
        }

        return res.json({
            message:
                decision === "approved"
                    ? "Debate approved successfully."
                    : "Debate rejected successfully."
        });
    }
);

/* =========================================================
   GET /api/debates/admin/reports

   Pending comment reports for administrators.
   ========================================================= */

router.get(
    "/admin/reports",
    requireRole("admin"),
    (req, res) => {
        const reports = db.prepare(`
            SELECT
                r.id,
                r.reason,
                r.created_at AS createdAt,

                c.id AS commentId,
                c.content AS commentContent,
                c.author_id AS commentAuthorId,

                d.id AS debateId,
                d.title AS debateTitle,

                u.name AS reporterName

            FROM debate_comment_reports r

            JOIN debate_comments c
                ON c.id = r.comment_id

            JOIN debates d
                ON d.id = c.debate_id

            JOIN users u
                ON u.id = r.reporter_id

            WHERE r.status = 'pending'

            ORDER BY r.created_at ASC, r.id ASC
        `).all();

        return res.json({ reports });
    }
);

/* =========================================================
   PATCH /api/debates/admin/comments/:commentId/visibility

   Hide or restore a comment.
   ========================================================= */

router.patch(
    "/admin/comments/:commentId/visibility",
    requireRole("admin"),
    (req, res) => {
        const commentId = parseId(req.params.commentId);
        const { hidden } = req.body || {};

        if (!commentId || typeof hidden !== "boolean") {
            return res.status(400).json({
                error: "Invalid comment ID or visibility value."
            });
        }

        const updateVisibility = db.transaction(() => {
            const result = db.prepare(`
                UPDATE debate_comments
                SET hidden = ?
                WHERE id = ?
            `).run(hidden ? 1 : 0, commentId);

            if (result.changes === 0) {
                return false;
            }

            db.prepare(`
                UPDATE debate_comment_reports
                SET status = 'reviewed'
                WHERE comment_id = ?
            `).run(commentId);

            return true;
        });

        if (!updateVisibility()) {
            return res.status(404).json({
                error: "Comment not found."
            });
        }

        return res.json({
            message: hidden
                ? "Comment hidden successfully."
                : "Comment restored successfully."
        });
    }
);

/* =========================================================
   GET /api/debates

   Public list of approved debates.
   Supports category, search and sorting.
   ========================================================= */

router.get("/", (req, res) => {
    const category =
        typeof req.query.category === "string"
            ? req.query.category.trim()
            : "";

    const search =
        typeof req.query.search === "string"
            ? req.query.search.trim()
            : "";

    const sort =
        req.query.sort === "popular"
            ? "popular"
            : "recent";

    if (category && !VALID_CATEGORIES.has(category)) {
        return res.status(400).json({
            error: "Invalid debate category."
        });
    }

    if (search.length > 100) {
        return res.status(400).json({
            error: "Search text is too long."
        });
    }

    const conditions = ["d.status = 'approved'"];
    const params = [];

    if (category) {
        conditions.push("d.category = ?");
        params.push(category);
    }

    if (search) {
        conditions.push(`
            (d.title LIKE ? OR d.description LIKE ?)
        `);

        params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(" AND ");

    const orderClause =
        sort === "popular"
            ? "commentCount DESC, d.created_at DESC, d.id DESC"
            : "d.created_at DESC, d.id DESC";

    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 30)
    );

    const offset = Math.max(
        0,
        Number.parseInt(req.query.offset, 10) || 0
    );

    const total = db.prepare(`
        SELECT COUNT(*) AS total
        FROM debates d
        WHERE ${whereClause}
    `).get(...params).total;

    const debates = db.prepare(`
        SELECT
            d.id,
            d.title,
            d.description,
            d.category,
            d.created_at AS createdAt,

            (
                SELECT COUNT(*)
                FROM debate_comments c
                WHERE c.debate_id = d.id
                  AND c.hidden = 0
            ) AS commentCount,

            (
                SELECT c.content
                FROM debate_comments c
                WHERE c.debate_id = d.id
                  AND c.hidden = 0
                ORDER BY
                    (
                        SELECT COUNT(*)
                        FROM debate_comment_likes l
                        WHERE l.comment_id = c.id
                    ) DESC,
                    c.created_at DESC,
                    c.id DESC
                LIMIT 1
            ) AS topComment

        FROM debates d
        WHERE ${whereClause}

        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.json({
        debates,
        total,
        limit,
        offset
    });
});

/* =========================================================
   POST /api/debates

   Students submit debates for admin approval.
   ========================================================= */

router.post("/", requireRole("student"), (req, res) => {
    const { title, description, category } = req.body || {};

    if (
        typeof title !== "string" ||
        typeof description !== "string" ||
        typeof category !== "string"
    ) {
        return res.status(400).json({
            error: "All fields are required."
        });
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanCategory = category.trim();

    if (cleanTitle.length < 5 || cleanTitle.length > 140) {
        return res.status(400).json({
            error: "Title must contain between 5 and 140 characters."
        });
    }

    if (
        cleanDescription.length < 15 ||
        cleanDescription.length > 3000
    ) {
        return res.status(400).json({
            error: "Description must contain between 15 and 3000 characters."
        });
    }

    if (!VALID_CATEGORIES.has(cleanCategory)) {
        return res.status(400).json({
            error: "Please select a valid category."
        });
    }

    const result = db.prepare(`
        INSERT INTO debates (
            title,
            description,
            category,
            author_id,
            status
        )
        VALUES (?, ?, ?, ?, 'pending')
    `).run(
        cleanTitle,
        cleanDescription,
        cleanCategory,
        req.authUser.id
    );

    return res.status(201).json({
        message: "Your debate has been submitted for review.",
        debate: {
            id: Number(result.lastInsertRowid),
            status: "pending"
        }
    });
});

/* =========================================================
   GET /api/debates/:id

   Approved debates are public.
   Pending/rejected debates are private.
   ========================================================= */

router.get("/:id", (req, res) => {
    const debateId = parseId(req.params.id);

    if (!debateId) {
        return res.status(400).json({
            error: "Invalid debate ID."
        });
    }

    const debate = getDebate(debateId);
    const user = getCurrentUser(req);

    const isAdmin =
        user?.email_verified === 1 &&
        user.role === "admin";

    const isAuthor =
        user?.email_verified === 1 &&
        user.id === debate?.author_id;

    if (
        !debate ||
        (
            debate.status !== "approved" &&
            !isAdmin &&
            !isAuthor
        )
    ) {
        return res.status(404).json({
            error: "Debate not found."
        });
    }

    const commentCount = db.prepare(`
        SELECT COUNT(*) AS total
        FROM debate_comments
        WHERE debate_id = ?
          AND hidden = 0
    `).get(debateId).total;

    const responseDebate = {
        id: debate.id,
        title: debate.title,
        description: debate.description,
        category: debate.category,
        authorName: debate.author_name,
        status: debate.status,
        createdAt: debate.created_at,
        commentCount
    };

    if (isAdmin || isAuthor) {
        responseDebate.rejectionReason =
            debate.rejection_reason;

        responseDebate.authorId = debate.author_id;
    }

    return res.json({
        debate: responseDebate
    });
});

/* =========================================================
   GET /api/debates/:id/comments

   Public comments on approved debates.
   Administrators can also inspect hidden comments.
   ========================================================= */

router.get("/:id/comments", (req, res) => {
    const debateId = parseId(req.params.id);

    if (!debateId) {
        return res.status(400).json({
            error: "Invalid debate ID."
        });
    }

    const debate = getDebate(debateId);
    const user = getCurrentUser(req);

    const isAdmin =
        user?.email_verified === 1 &&
        user.role === "admin";

    if (
        !debate ||
        (debate.status !== "approved" && !isAdmin)
    ) {
        return res.status(404).json({
            error: "Debate not found."
        });
    }

    const sort =
        req.query.sort === "popular"
            ? "popular"
            : "recent";

    const orderClause =
        sort === "popular"
            ? "likes DESC, c.created_at DESC, c.id DESC"
            : "c.created_at DESC, c.id DESC";

    const rows = db.prepare(`
        SELECT
            c.id,
            c.content,
            c.anonymous,
            c.hidden,
            c.created_at AS createdAt,
            c.author_id AS authorId,

            u.name AS authorName,

            (
                SELECT COUNT(*)
                FROM debate_comment_likes l
                WHERE l.comment_id = c.id
            ) AS likes,

            EXISTS (
                SELECT 1
                FROM debate_comment_likes l
                WHERE l.comment_id = c.id
                  AND l.user_id = ?
            ) AS likedByMe

        FROM debate_comments c

        JOIN users u
            ON u.id = c.author_id

        WHERE c.debate_id = ?
          AND (c.hidden = 0 OR ? = 1)

        ORDER BY ${orderClause}
    `).all(
        user?.email_verified === 1 ? user.id : -1,
        debateId,
        isAdmin ? 1 : 0
    );

    const comments = rows.map(comment => {
        const result = {
            id: comment.id,
            content: comment.content,
            author: comment.anonymous
                ? "Anonymous"
                : comment.authorName,
            anonymous: comment.anonymous === 1,
            createdAt: comment.createdAt,
            likes: comment.likes,
            likedByMe: comment.likedByMe === 1
        };

        if (isAdmin) {
            result.authorId = comment.authorId;
            result.realAuthorName = comment.authorName;
            result.hidden = comment.hidden === 1;
        }

        return result;
    });

    return res.json({ comments });
});

/* =========================================================
   POST /api/debates/:id/comments

   Students comment on approved debates.
   ========================================================= */

router.post(
    "/:id/comments",
    requireRole("student"),
    (req, res) => {
        const debateId = parseId(req.params.id);

        if (!debateId || !getApprovedDebate(debateId)) {
            return res.status(404).json({
                error: "Debate not found."
            });
        }

        const { content, anonymous } = req.body || {};

        if (typeof content !== "string") {
            return res.status(400).json({
                error: "Comment content is required."
            });
        }

        const cleanContent = content.trim();

        if (
            cleanContent.length < 1 ||
            cleanContent.length > 1500
        ) {
            return res.status(400).json({
                error: "Comment must contain between 1 and 1500 characters."
            });
        }

        const result = db.prepare(`
            INSERT INTO debate_comments (
                debate_id,
                author_id,
                content,
                anonymous
            )
            VALUES (?, ?, ?, ?)
        `).run(
            debateId,
            req.authUser.id,
            cleanContent,
            anonymous === true ? 1 : 0
        );

        return res.status(201).json({
            message: "Comment published successfully.",
            commentId: Number(result.lastInsertRowid)
        });
    }
);

/* =========================================================
   POST /api/debates/:id/comments/:commentId/like

   Toggle a like.
   One like per student per comment.
   ========================================================= */

router.post(
    "/:id/comments/:commentId/like",
    requireRole("student"),
    (req, res) => {
        const debateId = parseId(req.params.id);
        const commentId = parseId(req.params.commentId);

        if (!debateId || !commentId) {
            return res.status(400).json({
                error: "Invalid debate or comment ID."
            });
        }

        const comment = db.prepare(`
            SELECT c.id
            FROM debate_comments c

            JOIN debates d
                ON d.id = c.debate_id

            WHERE c.id = ?
              AND c.debate_id = ?
              AND c.hidden = 0
              AND d.status = 'approved'
        `).get(commentId, debateId);

        if (!comment) {
            return res.status(404).json({
                error: "Comment not found."
            });
        }

        const toggleLike = db.transaction(() => {
            const existing = db.prepare(`
                SELECT id
                FROM debate_comment_likes
                WHERE comment_id = ?
                  AND user_id = ?
            `).get(commentId, req.authUser.id);

            let liked;

            if (existing) {
                db.prepare(`
                    DELETE FROM debate_comment_likes
                    WHERE comment_id = ?
                      AND user_id = ?
                `).run(commentId, req.authUser.id);

                liked = false;
            } else {
                db.prepare(`
                    INSERT INTO debate_comment_likes (
                        comment_id,
                        user_id
                    )
                    VALUES (?, ?)
                `).run(commentId, req.authUser.id);

                liked = true;
            }

            const count = db.prepare(`
                SELECT COUNT(*) AS total
                FROM debate_comment_likes
                WHERE comment_id = ?
            `).get(commentId);

            return {
                liked,
                likes: count.total
            };
        });

        return res.json(toggleLike());
    }
);

/* =========================================================
   POST /api/debates/:id/comments/:commentId/report

   Students can report inappropriate comments.
   ========================================================= */

router.post(
    "/:id/comments/:commentId/report",
    requireRole("student"),
    (req, res) => {
        const debateId = parseId(req.params.id);
        const commentId = parseId(req.params.commentId);

        const reason =
            typeof req.body?.reason === "string"
                ? req.body.reason.trim()
                : "";

        if (!debateId || !commentId) {
            return res.status(400).json({
                error: "Invalid debate or comment ID."
            });
        }

        if (reason.length < 5 || reason.length > 500) {
            return res.status(400).json({
                error: "Please provide a reason between 5 and 500 characters."
            });
        }

        const comment = db.prepare(`
            SELECT c.id, c.author_id AS authorId

            FROM debate_comments c

            JOIN debates d
                ON d.id = c.debate_id

            WHERE c.id = ?
              AND c.debate_id = ?
              AND c.hidden = 0
              AND d.status = 'approved'
        `).get(commentId, debateId);

        if (!comment) {
            return res.status(404).json({
                error: "Comment not found."
            });
        }

        if (comment.authorId === req.authUser.id) {
            return res.status(400).json({
                error: "You cannot report your own comment."
            });
        }

        const existingReport = db.prepare(`
            SELECT id
            FROM debate_comment_reports
            WHERE comment_id = ?
              AND reporter_id = ?
        `).get(commentId, req.authUser.id);

        if (existingReport) {
            return res.status(409).json({
                error: "You have already reported this comment."
            });
        }

        db.prepare(`
            INSERT INTO debate_comment_reports (
                comment_id,
                reporter_id,
                reason
            )
            VALUES (?, ?, ?)
        `).run(
            commentId,
            req.authUser.id,
            reason
        );

        return res.status(201).json({
            message: "Report submitted successfully."
        });
    }
);

module.exports = router;
