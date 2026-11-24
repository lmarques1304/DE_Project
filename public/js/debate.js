(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const categories = {
        "academic-life": "Academic Life",
        "campus-mobility": "Campus Mobility",
        "canteens-and-food": "Canteens and Food",
        "events-and-traditions": "Events and Traditions",
        "sports-and-culture": "Sports and Culture",
        "student-well-being": "Student Well-Being",
        "study-spaces": "Study Spaces",
        "workshops-and-skills": "Workshops and Skills"
    };

    const debateId = Number(new URLSearchParams(window.location.search).get("id"));
    const debateEndpoint = `/api/debates/${debateId}`;
    const commentsEndpoint = `${debateEndpoint}/comments`;

    const pageNotice = $("pageNotice");
    const debateContent = $("debateContent");
    const debateError = $("debateError");
    const commentsCount = $("commentsCount");
    const commentsSort = $("commentsSort");
    const commentsList = $("commentsList");
    const commentForm = $("commentForm");
    const commentContent = $("commentContent");
    const commentAnonymous = $("commentAnonymous");
    const commentCharacterCount = $("commentCharacterCount");
    const submitCommentButton = $("submitCommentButton");
    const commentMessage = $("commentMessage");
    const participationPrompt = $("participationPrompt");
    const participationText = $("participationText");
    const participationLogin = $("participationLogin");
    const reportDialog = $("reportDialog");
    const reportForm = $("reportForm");
    const reportReason = $("reportReason");
    const reportMessage = $("reportMessage");
    const submitReportButton = $("submitReportButton");
    const closeReportDialog = $("closeReportDialog");
    const cancelReportButton = $("cancelReportButton");

    const MAX_COMMENT_LENGTH = 1500;

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    let currentUser = null;
    let currentDebate = null;
    let authFailed = false;
    let commentsController = null;
    let reportingCommentId = null;

    const canComment = () => currentUser?.role === "student";
    const isAdmin = () => currentUser?.role === "admin";
    const isApproved = () => currentDebate?.status === "approved";

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);

        return element;
    }

    function formatDate(value) {
        if (!value) return "";

        let normalized = String(value).trim();

        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime())
            ? ""
            : dateFormatter.format(date);
    }

    function countText(value, singular) {
        const count = Number(value) || 0;

        return `${count} ${singular}${count === 1 ? "" : "s"}`;
    }

    function setMessage(element, message = "", isError = false) {
        element.textContent = message;
        element.classList.toggle("is-error", isError);
    }

    function setCommentMessage(message = "", isError = false) {
        setMessage(commentMessage, message, isError);
    }

    function setBusy(button, busy, text) {
        button.disabled = busy;

        if (text !== undefined) button.textContent = text;
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error || "Something went wrong. Please try again."
            );
        }

        return data;
    }

    function sendRequest(url, method = "POST", body) {
        const options = { method };

        if (body !== undefined) {
            options.headers = {
                "Content-Type": "application/json"
            };

            options.body = JSON.stringify(body);
        }

        return fetchJSON(url, options);
    }

    function showError(message) {
        setMessage(pageNotice, message, true);

        debateContent.hidden = true;
        debateError.hidden = false;
    }

    async function loadCurrentUser() {
        try {
            const data = await fetchJSON("/api/auth/me");
            currentUser = data.user || null;
        } catch {
            currentUser = null;
            authFailed = true;
        }
    }

    function updateParticipation() {
        const approved = isApproved();
        const student = canComment();

        commentForm.hidden = !approved || !student;
        participationPrompt.hidden = !approved || student;

        if (!approved || student) return;

        participationLogin.hidden = authFailed || Boolean(currentUser);

        if (authFailed) {
            participationText.textContent =
                "Unable to verify your session. Please refresh the page.";
        } else if (!currentUser) {
            participationText.textContent =
                "Sign in with a student account to join the discussion.";
        } else {
            participationText.textContent =
                "Only student accounts can publish comments and react to discussions.";
        }
    }

    function renderDebate(debate) {
        currentDebate = debate;

        const categoryName = Object.hasOwn(categories, debate.category)
            ? categories[debate.category]
            : "Debates";

        const category = encodeURIComponent(debate.category);
        const approved = isApproved();
        const rejected = debate.status === "rejected";

        $("categoryBackLink").textContent = categoryName;
        $("categoryBackLink").href = `debates.html?category=${category}`;

        $("debateCategory").textContent = categoryName;
        $("debateTitle").textContent = debate.title;
        $("debateAuthor").textContent = `Started by ${debate.authorName}`;
        $("debateDate").textContent = formatDate(debate.createdAt);
        $("debateDescription").textContent = debate.description;

        $("createProposalLink").href = `createProposal.html?category=${category}`;

        document.title = `${debate.title} | Instant Democracy`;

        debateContent.hidden = false;
        debateError.hidden = true;

        setMessage(pageNotice);

        $("discussionSection").hidden = !approved;
        $("debateTopicActions").hidden = !approved;

        const moderationNotice = $("moderationNotice");

        moderationNotice.hidden = approved;
        moderationNotice.classList.toggle("is-rejected", rejected);

        if (!approved) {
            const pending = debate.status === "pending";

            $("moderationTitle").textContent = pending
                ? "Pending Review"
                : "Debate Rejected";

            $("moderationText").textContent = pending
                ? "This debate is waiting for administrator approval. It is not publicly visible yet."
                : debate.rejectionReason
                    ? `Reason: ${debate.rejectionReason}`
                    : "This debate was not approved for publication.";
        }

        updateParticipation();
    }

    function createActionButton(action, commentId, text, className) {
        const button = createElement("button", className, text);

        button.type = "button";
        button.dataset.action = action;
        button.dataset.commentId = commentId;

        return button;
    }

    function createCommentCard(comment) {
        const card = createElement("article", "debate-comment-card");
        const header = createElement("div", "debate-comment-header");
        const identity = createElement("div", "debate-comment-identity");
        const actions = createElement("div", "debate-comment-actions");

        card.classList.toggle("is-hidden", Boolean(comment.hidden));

        identity.append(
            createElement("strong", "debate-comment-author", comment.author)
        );

        if (comment.anonymous) {
            identity.append(
                createElement("span", "debate-anonymous-badge", "Anonymous")
            );
        }

        if (comment.hidden) {
            identity.append(
                createElement("span", "debate-hidden-badge", "Hidden")
            );
        }

        header.append(
            identity,
            createElement("time", "debate-comment-date", formatDate(comment.createdAt))
        );

        card.append(
            header,
            createElement("p", "debate-comment-text", comment.content)
        );

        if (isAdmin() && comment.anonymous && comment.realAuthorName) {
            card.append(
                createElement(
                    "p",
                    "debate-admin-identity",
                    `Administrator only — Real author: ${comment.realAuthorName}`
                )
            );
        }

        if (canComment() && !comment.hidden) {
            const liked = Boolean(comment.likedByMe);

            const likeButton = createActionButton(
                "like",
                comment.id,
                `${liked ? "♥ Liked" : "♡ Like"} · ${comment.likes}`,
                "debate-like-button"
            );

            likeButton.classList.toggle("is-liked", liked);
            likeButton.setAttribute("aria-pressed", String(liked));

            actions.append(
                likeButton,
                createActionButton(
                    "report",
                    comment.id,
                    "Report",
                    "debate-report-button"
                )
            );
        } else {
            actions.append(
                createElement("span", "debate-likes-text", countText(comment.likes, "like"))
            );
        }

        if (isAdmin()) {
            const visibilityButton = createActionButton(
                "visibility",
                comment.id,
                comment.hidden ? "Restore Comment" : "Hide Comment",
                "debate-visibility-button"
            );

            visibilityButton.dataset.hidden = String(Boolean(comment.hidden));
            visibilityButton.classList.toggle("is-danger", !comment.hidden);

            actions.append(visibilityButton);
        }

        card.append(actions);

        return card;
    }

    function showCommentsState(message) {
        commentsList.replaceChildren(
            createElement("p", "debate-empty-comments", message)
        );
    }

    async function loadComments() {
        if (!isApproved()) return false;

        commentsController?.abort();

        const controller = new AbortController();
        commentsController = controller;

        showCommentsState("Loading comments...");

        try {
            const sort = encodeURIComponent(commentsSort.value);

            const data = await fetchJSON(`${commentsEndpoint}?sort=${sort}`, {
                signal: controller.signal
            });

            if (commentsController !== controller) return false;

            if (!Array.isArray(data.comments)) {
                throw new Error("Invalid comments response.");
            }

            const comments = data.comments;
            const visibleCount = comments.filter(comment => !comment.hidden).length;

            commentsCount.textContent = countText(visibleCount, "comment");

            if (comments.length) {
                commentsList.replaceChildren(...comments.map(createCommentCard));
            } else {
                showCommentsState(
                    "No comments yet. Be the first to share your thoughts!"
                );
            }

            return true;

        } catch (error) {
            if (error.name === "AbortError" || commentsController !== controller) {
                return false;
            }

            commentsCount.textContent = "Unable to load comments.";

            showCommentsState("Unable to load comments. Please try again.");
            setCommentMessage(error.message, true);

            return false;

        } finally {
            if (commentsController === controller) {
                commentsController = null;
            }
        }
    }

    function updateCharacterCount() {
        commentCharacterCount.textContent =
            `${commentContent.value.length} / ${MAX_COMMENT_LENGTH}`;
    }

    commentsSort.addEventListener("change", () => {
        setCommentMessage();
        loadComments();
    });

    commentContent.addEventListener("input", updateCharacterCount);

    commentForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (submitCommentButton.disabled) return;

        if (!canComment() || !isApproved()) {
            setCommentMessage("Only students can post comments on approved debates.", true);
            return;
        }

        const content = commentContent.value.trim();
        const anonymous = commentAnonymous.checked;

        if (!content || content.length > MAX_COMMENT_LENGTH) {
            setCommentMessage(
                `Please enter a comment of up to ${MAX_COMMENT_LENGTH} characters.`,
                true
            );
            return;
        }

        setBusy(submitCommentButton, true, "Publishing...");
        setCommentMessage();

        try {
            await sendRequest(commentsEndpoint, "POST", {
                content,
                anonymous
            });

            commentForm.reset();
            updateCharacterCount();

            commentsSort.value = "recent";

            if (await loadComments()) {
                setCommentMessage("Your comment has been published successfully.");
            }

        } catch (error) {
            setCommentMessage(error.message, true);

        } finally {
            setBusy(submitCommentButton, false, "Post Comment");
        }
    });

    function openReport(commentId) {
        if (reportDialog.open || submitReportButton.disabled) return;

        reportingCommentId = commentId;

        reportForm.reset();
        reportMessage.textContent = "";

        reportDialog.showModal();
    }

    function closeReport() {
        reportDialog.close();
        reportingCommentId = null;
    }

    async function handleCommentAction(button, commentId, action) {
        if (!isApproved()) return;

        if (action === "report") {
            if (canComment()) openReport(commentId);
            return;
        }

        const like = action === "like";
        const visibility = action === "visibility";

        if (!like && !visibility) return;
        if (like && !canComment()) return;
        if (visibility && !isAdmin()) return;

        const currentlyHidden = button.dataset.hidden === "true";

        setBusy(button, true);
        setCommentMessage();

        try {
            if (like) {
                await sendRequest(`${commentsEndpoint}/${commentId}/like`);
            } else {
                await sendRequest(
                    `/api/debates/admin/comments/${commentId}/visibility`,
                    "PATCH",
                    { hidden: !currentlyHidden }
                );
            }

            const loaded = await loadComments();

            if (visibility && loaded) {
                setCommentMessage(
                    currentlyHidden
                        ? "Comment restored successfully."
                        : "Comment hidden successfully."
                );
            }

        } catch (error) {
            setCommentMessage(error.message, true);

        } finally {
            setBusy(button, false);
        }
    }

    commentsList.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button || button.disabled || !commentsList.contains(button)) return;

        const commentId = Number(button.dataset.commentId);

        if (!Number.isSafeInteger(commentId) || commentId <= 0) return;

        handleCommentAction(button, commentId, button.dataset.action);
    });

    [closeReportDialog, cancelReportButton].forEach(button => {
        button.addEventListener("click", () => {
            if (!submitReportButton.disabled) closeReport();
        });
    });

    reportDialog.addEventListener("cancel", event => {
        if (submitReportButton.disabled) event.preventDefault();
    });

    reportDialog.addEventListener("close", () => {
        if (!reportDialog.open) reportingCommentId = null;
    });

    function setReportBusy(busy) {
        setBusy(
            submitReportButton,
            busy,
            busy ? "Submitting..." : "Submit Report"
        );

        closeReportDialog.disabled = busy;
        cancelReportButton.disabled = busy;
    }

    reportForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (
            submitReportButton.disabled ||
            !canComment() ||
            !isApproved() ||
            !reportingCommentId
        ) return;

        const reason = reportReason.value.trim();

        if (reason.length < 5 || reason.length > 500) {
            reportMessage.textContent =
                "Please provide a reason between 5 and 500 characters.";
            return;
        }

        setReportBusy(true);
        reportMessage.textContent = "";

        try {
            await sendRequest(
                `${commentsEndpoint}/${reportingCommentId}/report`,
                "POST",
                { reason }
            );

            closeReport();

            setCommentMessage(
                "Your report has been submitted. An administrator will review it."
            );

        } catch (error) {
            reportMessage.textContent = error.message;

        } finally {
            setReportBusy(false);
        }
    });

    async function loadDebate() {
        if (!Number.isSafeInteger(debateId) || debateId <= 0) {
            showError("Invalid debate link.");
            return;
        }

        setMessage(pageNotice, "Loading debate...");

        try {
            const data = await fetchJSON(debateEndpoint);

            if (!data.debate) {
                throw new Error("Debate not found.");
            }

            renderDebate(data.debate);

            if (isApproved()) await loadComments();

        } catch (error) {
            showError(error.message);
        }
    }

    async function initializePage() {
        await loadCurrentUser();
        await loadDebate();
    }

    initializePage();
})();