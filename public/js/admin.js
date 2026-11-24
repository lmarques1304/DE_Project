(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const accessMessage = $("adminAccessMessage");
    const adminContent = $("adminContent");
    const logoutButton = $("adminLogout");
    const navigationButtons = document.querySelectorAll("[data-view]");

    const views = {
        proposals: {
            kind: "proposal",
            name: "Proposal",
            endpoint: "/api/admin/proposals",
            section: $("adminProposalsSection"),
            list: $("adminProposalList"),
            filter: $("adminStatusFilter"),
            feedback: $("adminFeedback"),
            count: $("navProposalCount"),
            subtitle: "Review proposals submitted by the community.",
            items: null
        },
        debates: {
            kind: "debate",
            name: "Debate",
            endpoint: "/api/admin/debates",
            section: $("adminDebatesSection"),
            list: $("adminDebateList"),
            filter: $("adminDebateStatusFilter"),
            feedback: $("adminDebateFeedback"),
            count: $("navDebateCount"),
            subtitle: "Review and moderate student discussions.",
            items: null
        }
    };

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

    const statusLabels = {
        pending: "Pending Review",
        approved: "Published",
        rejected: "Rejected"
    };

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    const portugalFormatter = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Europe/Lisbon"
    });

    let currentView = "proposals";
    let busy = false;
    let ready = false;

    function el(tag, props = {}, ...children) {
        const node = Object.assign(document.createElement(tag), props);
        node.append(...children);
        return node;
    }

    function text(tag, value, className = "") {
        return el(tag, {
            className,
            textContent: String(value ?? "")
        });
    }

    function setText(id, value) {
        $(id).textContent = value;
    }

    function formatDate(value, fallback = "Unknown date") {
        if (!value) return fallback;

        let normalized = String(value);

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            normalized += "T12:00:00Z";
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime())
            ? String(value)
            : dateFormatter.format(date);
    }

    function getPortugalToday() {
        const parts = portugalFormatter.formatToParts(new Date());
        const get = type => parts.find(part => part.type === type).value;

        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function categoryName(category) {
        return Object.hasOwn(categories, category)
            ? categories[category]
            : category || "Other";
    }

    function showFeedback(view, message = "", type = "") {
        view.feedback.textContent = message;
        view.feedback.className = `admin-feedback ${type}`.trim();
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(
                data.error || "Something went wrong. Please try again."
            );

            error.status = response.status;
            throw error;
        }

        return data;
    }

    function countStatus(items, status) {
        return items
            ? items.filter(item => item.status === status).length
            : "—";
    }

    function updateStats() {
        const items = views[currentView].items;

        setText("statTotalLabel", `Total ${currentView}`);
        setText("statTotal", items ? items.length : "—");
        setText("statPending", countStatus(items, "pending"));
        setText("statApproved", countStatus(items, "approved"));
        setText("statRejected", countStatus(items, "rejected"));

        Object.values(views).forEach(view => {
            view.count.textContent = countStatus(view.items, "pending");
        });
    }

    function switchView(name) {
        if (!ready || !Object.hasOwn(views, name)) return;

        currentView = name;

        Object.entries(views).forEach(([key, view]) => {
            view.section.hidden = key !== name;
        });

        navigationButtons.forEach(button => {
            const active = button.dataset.view === name;

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        setText("adminPageTitle", `${views[name].name} Management`);
        setText("adminPageSubtitle", views[name].subtitle);

        updateStats();
    }

    function createTag(value, type = "") {
        return text("span", value, `admin-tag ${type}`.trim());
    }

    function createRejectionReason(reason) {
        return el("div", { className: "admin-rejection-reason" },
            text("strong", "Reason for rejection"),
            text("p", reason)
        );
    }

    function createAction(view, id, action, label, type = "", locked = false) {
        const button = el("button", {
            type: "button",
            className: `admin-action-button ${type}`.trim(),
            textContent: label,
            disabled: busy || locked
        });

        Object.assign(button.dataset, {
            action,
            kind: view.kind,
            id: String(id),
            locked: String(locked)
        });

        return button;
    }

    function createModerationControls(view, id, approvalDisabled) {
        const formId = `rejection-${view.kind}-${id}`;
        const reasonId = `reason-${view.kind}-${id}`;

        const actions = el("div", { className: "admin-actions" },
            createAction(
                view, id, "approve",
                `Publish ${view.name}`, "admin-approve", approvalDisabled
            ),
            createAction(
                view, id, "reject",
                "Reject Publication", "admin-reject"
            )
        );

        const form = el("div", {
            className: "admin-rejection-form",
            id: formId,
            hidden: true
        },
            el("label", {
                htmlFor: reasonId,
                textContent: "Reason for rejection"
            }),
            el("textarea", {
                id: reasonId,
                rows: 4,
                minLength: 10,
                maxLength: 500,
                disabled: busy,
                placeholder: "Explain why this submission cannot be published..."
            }),
            text("p",
                "This explanation will be visible to the student. Minimum 10 characters, maximum 500."
            ),
            el("div", { className: "admin-rejection-controls" },
                createAction(
                    view, id, "confirm-reject",
                    "Confirm Rejection", "admin-reject"
                ),
                createAction(view, id, "cancel-reject", "Cancel")
            )
        );

        const fragment = document.createDocumentFragment();
        fragment.append(actions, form);

        return fragment;
    }

    function createCard(view, item) {
        const isProposal = view.kind === "proposal";
        const isPending = item.status === "pending";
        const isStudent = item.source === "student";
        const isAnonymous = Number(item.anonymous) === 1;
        const id = Number(item.id);
        const validId = Number.isSafeInteger(id) && id > 0;

        const deadlineExpired = isProposal && (
            !item.voting_deadline ||
            item.voting_deadline < getPortugalToday()
        );

        const status = Object.hasOwn(statusLabels, item.status)
            ? item.status
            : "pending";

        const tags = [createTag(categoryName(item.category))];

        if (isProposal) {
            tags.push(createTag(item.source));
        }

        tags.push(createTag(formatDate(item.created_at)));

        if (isAnonymous) {
            tags.push(createTag("Anonymous"));
        }

        const authorInfo = [
            `Name: ${item.author_name ?? ""}`,
            `Email: ${item.author_email ?? ""}`,
            `Account ID: ${item.author_id ?? ""}`,
            `Anonymous submission: ${isAnonymous ? "Yes" : "No"}`
        ];

        if (isProposal) {
            authorInfo.push(
                `Voting deadline: ${formatDate(item.voting_deadline, "Not specified")}`
            );
        }

        const card = el("article", { className: "admin-proposal-card" },
            el("div", { className: "admin-proposal-top" },
                el("div", {},
                    text("h3", item.title),
                    el("div", { className: "admin-proposal-meta" }, ...tags)
                ),
                createTag(statusLabels[status], status)
            ),
            text("p", item.description, "admin-proposal-description"),
            el("div", { className: "admin-author-info" },
                text("strong", "Author information — Admin only"),
                ...authorInfo.map(value => text("span", value))
            )
        );

        if (item.rejection_reason) {
            card.append(createRejectionReason(item.rejection_reason));
        }

        if (!isProposal && validId) {
            card.append(el("a", {
                className: "admin-debate-link",
                href: `debate.html?id=${id}`,
                textContent: "View Debate"
            }));
        }

        if (isPending && validId && (!isProposal || isStudent)) {
            card.append(createModerationControls(view, id, deadlineExpired));
        }

        if (isProposal && isPending) {
            if (isStudent && deadlineExpired) {
                card.append(text("p",
                    "The voting deadline has expired or is missing. This proposal cannot be published.",
                    "admin-deadline-warning"
                ));
            } else if (!isStudent) {
                card.append(text("p",
                    "This submission is not eligible for student proposal moderation.",
                    "admin-inline-note"
                ));
            }
        }

        return card;
    }

    function renderView(name) {
        const view = views[name];

        if (!view.items) {
            view.list.replaceChildren(text("div",
                `Unable to load ${name}.`,
                "admin-empty"
            ));
            return;
        }

        const status = view.filter.value;

        const visible = view.items.filter(item =>
            status === "all" || item.status === status
        );

        view.list.replaceChildren(
            ...(visible.length
                ? visible.map(item => createCard(view, item))
                : [text("div",
                    `No ${name} found for this status.`,
                    "admin-empty"
                )])
        );
    }

    async function loadView(name) {
        const view = views[name];
        const data = await fetchJSON(view.endpoint);

        if (!Array.isArray(data[name])) {
            throw new Error(`Unable to load ${name}.`);
        }

        view.items = data[name];

        renderView(name);
        updateStats();
    }

    function setBusy(value) {
        busy = value;
        logoutButton.disabled = value;

        Object.values(views).forEach(view => {
            view.filter.disabled = value;
        });

        document.querySelectorAll(".admin-action-button").forEach(button => {
            button.disabled = value || button.dataset.locked === "true";
        });

        document.querySelectorAll(".admin-rejection-form textarea")
            .forEach(textarea => {
                textarea.disabled = value;
            });
    }

    async function moderateItem(name, id, status, rejectionReason = "") {
        if (busy || !ready) return;

        const view = views[name];

        if (status === "approved" && !window.confirm(
            `Publish this ${view.kind} and make it visible to the community?`
        )) {
            return;
        }

        setBusy(true);
        showFeedback(view);

        try {
            const data = await fetchJSON(`${view.endpoint}/${id}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status, rejectionReason })
            });

            try {
                await loadView(name);

                showFeedback(
                    view,
                    data.message || "Submission reviewed successfully.",
                    "success"
                );
            } catch (error) {
                view.items = null;

                renderView(name);
                updateStats();

                showFeedback(
                    view,
                    "Submission reviewed, but the list could not be refreshed. Please reload the page.",
                    "error"
                );
            }
        } catch (error) {
            showFeedback(view, error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    function handleModerationClick(name, event) {
        const button = event.target.closest("button[data-action]");

        if (!button || busy || button.disabled || !ready) return;

        const view = views[name];
        const id = Number(button.dataset.id);
        const action = button.dataset.action;

        if (
            button.dataset.kind !== view.kind ||
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return;
        }

        const form = $(`rejection-${view.kind}-${id}`);
        const textarea = $(`reason-${view.kind}-${id}`);

        switch (action) {
            case "reject":
                if (form) {
                    form.hidden = false;
                    textarea?.focus();
                }
                break;

            case "cancel-reject":
                if (form) form.hidden = true;
                break;

            case "confirm-reject": {
                const reason = textarea?.value.trim() || "";

                if (reason.length < 10 || reason.length > 500) {
                    showFeedback(
                        view,
                        "Please provide a rejection reason between 10 and 500 characters.",
                        "error"
                    );

                    textarea?.focus();
                    return;
                }

                moderateItem(name, id, "rejected", reason);
                break;
            }

            case "approve":
                moderateItem(name, id, "approved");
                break;
        }
    }

    async function logout() {
        if (busy) return;

        setBusy(true);

        try {
            await fetchJSON("/api/auth/logout", {
                method: "POST"
            });

            window.location.replace("login.html");
        } catch (error) {
            const message = "Unable to log out. Please try again.";

            if (ready) {
                showFeedback(views[currentView], message, "error");
            } else {
                accessMessage.textContent = message;
            }

            setBusy(false);
        }
    }

    async function initializeDashboard() {
        setBusy(true);

        try {
            const { user } = await fetchJSON("/api/auth/me");

            if (!user) {
                window.location.replace("login.html");
                return;
            }

            if (user.role !== "admin") {
                accessMessage.textContent =
                    "Access denied. This page is only available to administrators.";
                return;
            }

            setText("adminName", user.name || "Administrator");

            await Promise.all(
                Object.keys(views).map(async name => {
                    try {
                        await loadView(name);
                    } catch (error) {
                        renderView(name);
                        showFeedback(views[name], error.message, "error");
                    }
                })
            );

            ready = true;

            switchView("proposals");

            accessMessage.hidden = true;
            adminContent.hidden = false;
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("login.html");
                return;
            }

            console.error("Dashboard error:", error);

            accessMessage.textContent =
                "Unable to load the dashboard. Please try again.";
        } finally {
            setBusy(false);
        }
    }

    navigationButtons.forEach(button => {
        button.addEventListener("click", () => {
            switchView(button.dataset.view);
        });
    });

    Object.entries(views).forEach(([name, view]) => {
        view.filter.addEventListener("change", () => renderView(name));

        view.list.addEventListener("click", event => {
            handleModerationClick(name, event);
        });
    });

    logoutButton.addEventListener("click", logout);

    initializeDashboard();
})();