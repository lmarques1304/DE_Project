
(() => {

    /* =====================================================
       PAGE ELEMENTS
       ===================================================== */

    const pageNotice =
        document.getElementById("pageNotice");

    const debateContent =
        document.getElementById("debateContent");

    const debateError =
        document.getElementById("debateError");

    const categoryBackLink =
        document.getElementById("categoryBackLink");

    const debateCategory =
        document.getElementById("debateCategory");

    const debateTitle =
        document.getElementById("debateTitle");

    const debateAuthor =
        document.getElementById("debateAuthor");

    const debateDate =
        document.getElementById("debateDate");

    const debateDescription =
        document.getElementById("debateDescription");

    const debateTopicActions =
        document.getElementById("debateTopicActions");

    const createProposalLink =
        document.getElementById("createProposalLink");

    const moderationNotice =
        document.getElementById("moderationNotice");

    const moderationTitle =
        document.getElementById("moderationTitle");

    const moderationText =
        document.getElementById("moderationText");

    const discussionSection =
        document.getElementById("discussionSection");

    const commentsCount =
        document.getElementById("commentsCount");

    const commentsSort =
        document.getElementById("commentsSort");

    const commentsList =
        document.getElementById("commentsList");

    const commentForm =
        document.getElementById("commentForm");

    const commentContent =
        document.getElementById("commentContent");

    const commentAnonymous =
        document.getElementById("commentAnonymous");

    const commentCharacterCount =
        document.getElementById("commentCharacterCount");

    const submitCommentButton =
        document.getElementById("submitCommentButton");

    const commentMessage =
        document.getElementById("commentMessage");

    const participationPrompt =
        document.getElementById("participationPrompt");

    const participationText =
        document.getElementById("participationText");

    const participationLogin =
        document.getElementById("participationLogin");

    const reportDialog =
        document.getElementById("reportDialog");

    const reportForm =
        document.getElementById("reportForm");

    const reportReason =
        document.getElementById("reportReason");

    const reportMessage =
        document.getElementById("reportMessage");

    const submitReportButton =
        document.getElementById("submitReportButton");

    const closeReportDialog =
        document.getElementById("closeReportDialog");

    const cancelReportButton =
        document.getElementById("cancelReportButton");

    /* =====================================================
       CATEGORIES
       ===================================================== */

    const CATEGORIES = {
        "academic-life": "Academic Life",
        "campus-mobility": "Campus Mobility",
        "canteens-and-food": "Canteens and Food",
        "events-and-traditions": "Events and Traditions",
        "sports-and-culture": "Sports and Culture",
        "student-well-being": "Student Well-Being",
        "study-spaces": "Study Spaces",
        "workshops-and-skills": "Workshops and Skills"
    };

    /* =====================================================
       PAGE STATE
       ===================================================== */

    const params = new URLSearchParams(
        window.location.search
    );

    const debateId = Number(
        params.get("id")
    );

    let currentUser = null;
    let authFailed = false;

    let currentDebate = null;
    let commentsController = null;

    let reportingCommentId = null;

    /* =====================================================
       HELPERS
       ===================================================== */

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        let normalized = value;

        // SQLite CURRENT_TIMESTAMP uses UTC.
        if (
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
        ) {
            normalized = value.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function commentCountText(count) {
        return count === 1
            ? "1 comment"
            : `${count} comments`;
    }

    function likeCountText(count) {
        return count === 1
            ? "1 like"
            : `${count} likes`;
    }

    function canComment() {
        return currentUser?.role === "student";
    }

    function isAdmin() {
        return currentUser?.role === "admin";
    }

    function setCommentMessage(message, isError = false) {
        commentMessage.textContent = message;

        commentMessage.classList.toggle(
            "is-error",
            isError
        );
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        const data = await response.json().catch(
            () => ({})
        );

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Something went wrong. Please try again."
            );
        }

        return data;
    }

    function showError(message) {
        pageNotice.textContent = message;
        pageNotice.classList.add("is-error");

        debateContent.hidden = true;
        debateError.hidden = false;
    }

    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    async function loadCurrentUser() {
        try {
            const data = await fetchJSON(
                "/api/auth/me"
            );

            currentUser = data.user || null;

        } catch (error) {
            currentUser = null;
            authFailed = true;
        }
    }

    function updateParticipation() {
        if (!currentDebate) {
            return;
        }

        if (currentDebate.status !== "approved") {
            commentForm.hidden = true;
            participationPrompt.hidden = true;
            return;
        }

        if (canComment()) {
            commentForm.hidden = false;
            participationPrompt.hidden = true;
            return;
        }

        commentForm.hidden = true;
        participationPrompt.hidden = false;

        if (authFailed) {
            participationText.textContent =
                "Unable to verify your session. Please refresh the page.";

            participationLogin.hidden = true;

        } else if (!currentUser) {
            participationText.textContent =
                "Sign in with a student account to join the discussion.";

            participationLogin.hidden = false;

        } else {
            participationText.textContent =
                "Only student accounts can publish comments and react to discussions.";

            participationLogin.hidden = true;
        }
    }

    /* =====================================================
       RENDER DEBATE
       ===================================================== */

    function renderDebate(debate) {
        currentDebate = debate;

        const categoryName =
            CATEGORIES[debate.category] || "Debates";

        categoryBackLink.textContent =
            categoryName;

        categoryBackLink.href =
            `debates.html?category=${encodeURIComponent(debate.category)}`;

        debateCategory.textContent =
            categoryName;

        debateTitle.textContent =
            debate.title;

        debateAuthor.textContent =
            `Started by ${debate.authorName}`;

        debateDate.textContent =
            formatDate(debate.createdAt);

        debateDescription.textContent =
            debate.description;

        document.title =
            `${debate.title} | Instant Democracy`;

        createProposalLink.href =
            `createProposal.html?category=${encodeURIComponent(debate.category)}`;

        debateContent.hidden = false;
        pageNotice.textContent = "";

        /* -------------------------------------
           PENDING OR REJECTED DEBATES
           ------------------------------------- */

        if (debate.status !== "approved") {
            discussionSection.hidden = true;
            debateTopicActions.hidden = true;

            moderationNotice.hidden = false;

            moderationNotice.classList.toggle(
                "is-rejected",
                debate.status === "rejected"
            );

            if (debate.status === "pending") {
                moderationTitle.textContent =
                    "Pending Review";

                moderationText.textContent =
                    "This debate is waiting for administrator approval. It is not publicly visible yet.";

            } else {
                moderationTitle.textContent =
                    "Debate Rejected";

                moderationText.textContent =
                    debate.rejectionReason
                        ? `Reason: ${debate.rejectionReason}`
                        : "This debate was not approved for publication.";
            }

            return;
        }

        /* -------------------------------------
           APPROVED DEBATES
           ------------------------------------- */

        moderationNotice.hidden = true;
        debateTopicActions.hidden = false;
        discussionSection.hidden = false;

        updateParticipation();
    }

    /* =====================================================
       CREATE COMMENT CARD
       ===================================================== */

    function createCommentCard(comment) {
        const card = createElement(
            "article",
            "debate-comment-card"
        );

        if (comment.hidden) {
            card.classList.add("is-hidden");
        }

        /* -------------------------------------
           COMMENT HEADER
           ------------------------------------- */

        const header = createElement(
            "div",
            "debate-comment-header"
        );

        const identity = createElement(
            "div",
            "debate-comment-identity"
        );

        const author = createElement(
            "strong",
            "debate-comment-author",
            comment.author
        );

        identity.append(author);

        if (comment.anonymous) {
            identity.append(
                createElement(
                    "span",
                    "debate-anonymous-badge",
                    "Anonymous"
                )
            );
        }

        if (comment.hidden) {
            identity.append(
                createElement(
                    "span",
                    "debate-hidden-badge",
                    "Hidden"
                )
            );
        }

        const date = createElement(
            "time",
            "debate-comment-date",
            formatDate(comment.createdAt)
        );

        header.append(identity, date);

        /* -------------------------------------
           COMMENT CONTENT
           ------------------------------------- */

        const content = createElement(
            "p",
            "debate-comment-text",
            comment.content
        );

        card.append(header, content);

        /* -------------------------------------
           ADMIN-ONLY AUTHOR INFORMATION
           ------------------------------------- */

        if (
            isAdmin() &&
            comment.anonymous &&
            comment.realAuthorName
        ) {
            const identityInfo = createElement(
                "p",
                "debate-admin-identity",
                `Administrator only — Real author: ${comment.realAuthorName}`
            );

            card.append(identityInfo);
        }

        /* -------------------------------------
           COMMENT ACTIONS
           ------------------------------------- */

        const actions = createElement(
            "div",
            "debate-comment-actions"
        );

        if (canComment() && !comment.hidden) {

            // Like / Unlike
            const likeButton = createElement(
                "button",
                "debate-like-button",
                comment.likedByMe
                    ? `♥ Liked · ${comment.likes}`
                    : `♡ Like · ${comment.likes}`
            );

            likeButton.type = "button";

            likeButton.dataset.action = "like";
            likeButton.dataset.commentId = comment.id;

            if (comment.likedByMe) {
                likeButton.classList.add("is-liked");
            }

            actions.append(likeButton);

            // Report
            const reportButton = createElement(
                "button",
                "debate-report-button",
                "Report"
            );

            reportButton.type = "button";

            reportButton.dataset.action = "report";
            reportButton.dataset.commentId = comment.id;

            actions.append(reportButton);

        } else {

            actions.append(
                createElement(
                    "span",
                    "debate-likes-text",
                    likeCountText(comment.likes)
                )
            );

        }

        /* -------------------------------------
           ADMIN MODERATION
           ------------------------------------- */

        if (isAdmin()) {
            const visibilityButton = createElement(
                "button",
                "debate-visibility-button",
                comment.hidden
                    ? "Restore Comment"
                    : "Hide Comment"
            );

            visibilityButton.type = "button";

            visibilityButton.dataset.action =
                "visibility";

            visibilityButton.dataset.commentId =
                comment.id;

            visibilityButton.dataset.hidden =
                String(Boolean(comment.hidden));

            if (!comment.hidden) {
                visibilityButton.classList.add(
                    "is-danger"
                );
            }

            actions.append(visibilityButton);
        }

        card.append(actions);

        return card;
    }

    /* =====================================================
       LOAD COMMENTS
       ===================================================== */

    async function loadComments() {
        if (!currentDebate) {
            return;
        }

        if (commentsController) {
            commentsController.abort();
        }

        const controller = new AbortController();

        commentsController = controller;

        commentsList.replaceChildren(
            createElement(
                "p",
                "debate-empty-comments",
                "Loading comments..."
            )
        );

        try {
            const sort = commentsSort.value;

            const data = await fetchJSON(
                `/api/debates/${debateId}/comments?sort=${encodeURIComponent(sort)}`,
                {
                    signal: controller.signal
                }
            );

            if (commentsController !== controller) {
                return;
            }

            commentsList.replaceChildren();

            const comments = data.comments || [];

            const visibleCount = comments.filter(
                comment => !comment.hidden
            ).length;

            commentsCount.textContent =
                commentCountText(visibleCount);

            if (comments.length === 0) {
                commentsList.append(
                    createElement(
                        "p",
                        "debate-empty-comments",
                        "No comments yet. Be the first to share your thoughts!"
                    )
                );

                return;
            }

            comments.forEach(comment => {
                commentsList.append(
                    createCommentCard(comment)
                );
            });

        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            if (commentsController !== controller) {
                return;
            }

            commentsList.replaceChildren(
                createElement(
                    "p",
                    "debate-empty-comments",
                    "Unable to load comments. Please try again."
                )
            );

            setCommentMessage(
                error.message,
                true
            );

        } finally {
            if (commentsController === controller) {
                commentsController = null;
            }
        }
    }

    /* =====================================================
       SORT COMMENTS
       ===================================================== */

    commentsSort.addEventListener(
        "change",
        () => {
            setCommentMessage("");
            loadComments();
        }
    );

    /* =====================================================
       COMMENT CHARACTER COUNTER
       ===================================================== */

    commentContent.addEventListener(
        "input",
        () => {
            commentCharacterCount.textContent =
                `${commentContent.value.length} / 1500`;
        }
    );

    /* =====================================================
       SUBMIT COMMENT
       ===================================================== */

    commentForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!canComment()) {
                setCommentMessage(
                    "Only students can post comments.",
                    true
                );
                return;
            }

            const content =
                commentContent.value.trim();

            const anonymous =
                commentAnonymous.checked;

            if (!content || content.length > 1500) {
                setCommentMessage(
                    "Please enter a comment of up to 1500 characters.",
                    true
                );
                return;
            }

            submitCommentButton.disabled = true;
            submitCommentButton.textContent =
                "Publishing...";

            setCommentMessage("");

            try {
                await fetchJSON(
                    `/api/debates/${debateId}/comments`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            content,
                            anonymous
                        })
                    }
                );

                commentForm.reset();

                commentCharacterCount.textContent =
                    "0 / 1500";

                // Show the newly published comment first.
                commentsSort.value = "recent";

                await loadComments();

                setCommentMessage(
                    "Your comment has been published successfully."
                );

            } catch (error) {
                setCommentMessage(
                    error.message,
                    true
                );

            } finally {
                submitCommentButton.disabled = false;
                submitCommentButton.textContent =
                    "Post Comment";
            }
        }
    );

    /* =====================================================
       COMMENT ACTIONS
       ===================================================== */

    commentsList.addEventListener(
        "click",
        async event => {
            const button = event.target.closest(
                "button[data-action]"
            );

            if (
                !button ||
                !commentsList.contains(button)
            ) {
                return;
            }

            const commentId = Number(
                button.dataset.commentId
            );

            const action =
                button.dataset.action;

            if (
                !Number.isSafeInteger(commentId) ||
                commentId <= 0
            ) {
                return;
            }

            /* ---------------------------------
               LIKE / UNLIKE
               --------------------------------- */

            if (action === "like") {
                if (!canComment()) {
                    return;
                }

                button.disabled = true;
                setCommentMessage("");

                try {
                    await fetchJSON(
                        `/api/debates/${debateId}/comments/${commentId}/like`,
                        {
                            method: "POST"
                        }
                    );

                    await loadComments();

                } catch (error) {
                    setCommentMessage(
                        error.message,
                        true
                    );

                    button.disabled = false;
                }
            }

            /* ---------------------------------
               REPORT COMMENT
               --------------------------------- */

            if (action === "report") {
                if (!canComment()) {
                    return;
                }

                reportingCommentId = commentId;

                reportForm.reset();
                reportMessage.textContent = "";

                reportDialog.showModal();
            }

            /* ---------------------------------
               ADMIN: HIDE / RESTORE
               --------------------------------- */

            if (action === "visibility") {
                if (!isAdmin()) {
                    return;
                }

                const currentlyHidden =
                    button.dataset.hidden === "true";

                button.disabled = true;

                try {
                    await fetchJSON(
                        `/api/debates/admin/comments/${commentId}/visibility`,
                        {
                            method: "PATCH",

                            headers: {
                                "Content-Type": "application/json"
                            },

                            body: JSON.stringify({
                                hidden: !currentlyHidden
                            })
                        }
                    );

                    await loadComments();

                    setCommentMessage(
                        currentlyHidden
                            ? "Comment restored successfully."
                            : "Comment hidden successfully."
                    );

                } catch (error) {
                    setCommentMessage(
                        error.message,
                        true
                    );

                    button.disabled = false;
                }
            }
        }
    );

    /* =====================================================
       REPORT DIALOG
       ===================================================== */

    function closeReport() {
        reportDialog.close();
        reportingCommentId = null;
    }

    closeReportDialog.addEventListener(
        "click",
        closeReport
    );

    cancelReportButton.addEventListener(
        "click",
        closeReport
    );

    reportDialog.addEventListener(
        "close",
        () => {
            reportingCommentId = null;
        }
    );

    /* =====================================================
       SUBMIT COMMENT REPORT
       ===================================================== */

    reportForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!canComment()) {
                return;
            }

            if (!reportingCommentId) {
                return;
            }

            const reason =
                reportReason.value.trim();

            if (
                reason.length < 5 ||
                reason.length > 500
            ) {
                reportMessage.textContent =
                    "Please provide a reason between 5 and 500 characters.";

                return;
            }

            submitReportButton.disabled = true;
            submitReportButton.textContent =
                "Submitting...";

            reportMessage.textContent = "";

            try {
                await fetchJSON(
                    `/api/debates/${debateId}/comments/${reportingCommentId}/report`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            reason
                        })
                    }
                );

                closeReport();

                setCommentMessage(
                    "Your report has been submitted. An administrator will review it."
                );

            } catch (error) {
                reportMessage.textContent =
                    error.message;

            } finally {
                submitReportButton.disabled = false;
                submitReportButton.textContent =
                    "Submit Report";
            }
        }
    );

    /* =====================================================
       LOAD DEBATE
       ===================================================== */

    async function loadDebate() {
        if (
            !Number.isSafeInteger(debateId) ||
            debateId <= 0
        ) {
            showError(
                "Invalid debate link."
            );

            return;
        }

        pageNotice.textContent =
            "Loading debate...";

        try {
            const data = await fetchJSON(
                `/api/debates/${debateId}`
            );

            renderDebate(data.debate);

            if (data.debate.status === "approved") {
                await loadComments();
            }

        } catch (error) {
            showError(
                error.message
            );
        }
    }

    /* =====================================================
       INITIALIZE PAGE
       ===================================================== */

    async function initializePage() {
        await loadCurrentUser();
        await loadDebate();
    }

    initializePage();

})();
