(() => {

    const accessMessage =
        document.getElementById("adminAccessMessage");

    const adminContent =
        document.getElementById("adminContent");

    const pageTitle =
        document.getElementById("adminPageTitle");

    const pageSubtitle =
        document.getElementById("adminPageSubtitle");

    const adminName =
        document.getElementById("adminName");

    const logoutButton =
        document.getElementById("adminLogout");

    const navigationButtons =
        document.querySelectorAll("[data-view]");

    const proposalSection =
        document.getElementById("adminProposalsSection");

    const debateSection =
        document.getElementById("adminDebatesSection");

    const proposalList =
        document.getElementById("adminProposalList");

    const debateList =
        document.getElementById("adminDebateList");

    const proposalFilter =
        document.getElementById("adminStatusFilter");

    const debateFilter =
        document.getElementById("adminDebateStatusFilter");

    const proposalFeedback =
        document.getElementById("adminFeedback");

    const debateFeedback =
        document.getElementById("adminDebateFeedback");

    const navProposalCount =
        document.getElementById("navProposalCount");

    const navDebateCount =
        document.getElementById("navDebateCount");

    let proposals = [];
    let debates = [];
    let currentView = "proposals";
    let busy = false;

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

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => {

                const entities = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                };

                return entities[character];
            }
        );
    }

    function formatDate(value) {
        if (!value) {
            return "Unknown date";
        }

        let normalized = String(value);

        if (
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)
        ) {
            normalized =
                normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatDeadline(value) {
        if (!value) {
            return "Not specified";
        }

        const date = new Date(
            `${value}T12:00:00Z`
        );

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        });
    }

    function getPortugalToday() {
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

    function getCategoryName(category) {
        return CATEGORIES[category] || category;
    }

    function getStatusLabel(status) {
        if (status === "approved") {
            return "Published";
        }

        if (status === "rejected") {
            return "Rejected";
        }

        return "Pending Review";
    }

    function showFeedback(kind, message, type = "") {
        const element =
            kind === "proposal"
                ? proposalFeedback
                : debateFeedback;

        element.textContent = message;
        element.className =
            `admin-feedback ${type}`;
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
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

    function updateStats() {
        const items =
            currentView === "proposals"
                ? proposals
                : debates;

        const total = items.length;

        const pending = items.filter(
            item => item.status === "pending"
        ).length;

        const approved = items.filter(
            item => item.status === "approved"
        ).length;

        const rejected = items.filter(
            item => item.status === "rejected"
        ).length;

        document.getElementById(
            "statTotalLabel"
        ).textContent =
            currentView === "proposals"
                ? "Total proposals"
                : "Total debates";

        document.getElementById(
            "statTotal"
        ).textContent = total;

        document.getElementById(
            "statPending"
        ).textContent = pending;

        document.getElementById(
            "statApproved"
        ).textContent = approved;

        document.getElementById(
            "statRejected"
        ).textContent = rejected;

        navProposalCount.textContent =
            proposals.filter(
                item => item.status === "pending"
            ).length;

        navDebateCount.textContent =
            debates.filter(
                item => item.status === "pending"
            ).length;
    }

    function switchView(view) {
        if (!["proposals", "debates"].includes(view)) {
            return;
        }

        currentView = view;

        proposalSection.hidden =
            view !== "proposals";

        debateSection.hidden =
            view !== "debates";

        navigationButtons.forEach(button => {
            const active =
                button.dataset.view === view;

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-pressed",
                String(active)
            );
        });

        if (view === "proposals") {
            pageTitle.textContent =
                "Proposal Management";

            pageSubtitle.textContent =
                "Review proposals submitted by the community.";

        } else {
            pageTitle.textContent =
                "Debate Management";

            pageSubtitle.textContent =
                "Review and moderate student discussions.";
        }

        updateStats();
    }

    navigationButtons.forEach(button => {
        button.addEventListener(
            "click",
            () => {
                switchView(
                    button.dataset.view
                );
            }
        );
    });

    function renderRejectionReason(reason) {
        if (!reason) {
            return "";
        }

        return `
            <div class="admin-rejection-reason">

                <strong>
                    Reason for rejection
                </strong>

                <p>${escapeHTML(reason)}</p>

            </div>
        `;
    }

    function renderModerationControls(
        kind,
        id,
        approvalDisabled = false
    ) {
        const safeId = Number(id);

        if (
            !Number.isSafeInteger(safeId) ||
            safeId <= 0
        ) {
            return "";
        }

        const itemName =
            kind === "proposal"
                ? "Proposal"
                : "Debate";

        return `
            <div class="admin-actions">

                <button
                    type="button"
                    class="admin-action-button admin-approve"
                    data-action="approve"
                    data-kind="${kind}"
                    data-id="${safeId}"
                    ${approvalDisabled ? "disabled" : ""}
                >
                    Publish ${itemName}
                </button>

                <button
                    type="button"
                    class="admin-action-button admin-reject"
                    data-action="reject"
                    data-kind="${kind}"
                    data-id="${safeId}"
                >
                    Reject Publication
                </button>

            </div>

            <div
                class="admin-rejection-form"
                id="rejection-${kind}-${safeId}"
                hidden
            >

                <label for="reason-${kind}-${safeId}">
                    Reason for rejection
                </label>

                <textarea
                    id="reason-${kind}-${safeId}"
                    rows="4"
                    minlength="10"
                    maxlength="500"
                    placeholder="Explain why this submission cannot be published..."
                ></textarea>

                <p>
                    This explanation will be visible to
                    the student. Minimum 10 characters,
                    maximum 500.
                </p>

                <div class="admin-rejection-controls">

                    <button
                        type="button"
                        class="admin-action-button admin-reject"
                        data-action="confirm-reject"
                        data-kind="${kind}"
                        data-id="${safeId}"
                    >
                        Confirm Rejection
                    </button>

                    <button
                        type="button"
                        class="admin-action-button"
                        data-action="cancel-reject"
                        data-kind="${kind}"
                        data-id="${safeId}"
                    >
                        Cancel
                    </button>

                </div>

            </div>
        `;
    }

    function renderProposals() {
        const selectedStatus =
            proposalFilter.value;

        const visible = proposals.filter(
            proposal =>
                selectedStatus === "all" ||
                proposal.status === selectedStatus
        );

        if (visible.length === 0) {
            proposalList.innerHTML = `
                <div class="admin-empty">
                    No proposals found for this status.
                </div>
            `;

            return;
        }

        const today = getPortugalToday();

        proposalList.innerHTML = visible.map(
            proposal => {

                const isPending =
                    proposal.status === "pending";

                const isAnonymous =
                    Number(proposal.anonymous) === 1;

                const isStudent =
                    proposal.source === "student";

                const deadlineExpired =
                    !proposal.voting_deadline ||
                    proposal.voting_deadline < today;

                const controls =
                    isPending && isStudent
                        ? renderModerationControls(
                            "proposal",
                            proposal.id,
                            deadlineExpired
                        )
                        : "";

                return `
                    <article class="admin-proposal-card">

                        <div class="admin-proposal-top">

                            <div>

                                <h3>
                                    ${escapeHTML(proposal.title)}
                                </h3>

                                <div class="admin-proposal-meta">

                                    <span class="admin-tag">
                                        ${escapeHTML(
                                            getCategoryName(proposal.category)
                                        )}
                                    </span>

                                    <span class="admin-tag">
                                        ${escapeHTML(proposal.source)}
                                    </span>

                                    <span class="admin-tag">
                                        ${escapeHTML(
                                            formatDate(proposal.created_at)
                                        )}
                                    </span>

                                    ${isAnonymous
                                        ? '<span class="admin-tag">Anonymous</span>'
                                        : ""}

                                </div>

                            </div>

                            <span class="admin-tag ${escapeHTML(proposal.status)}">
                                ${getStatusLabel(proposal.status)}
                            </span>

                        </div>

                        <p class="admin-proposal-description">${escapeHTML(proposal.description)}</p>

                        <div class="admin-author-info">

                            <strong>
                                Author information — Admin only
                            </strong>

                            <span>
                                Name: ${escapeHTML(proposal.author_name)}
                            </span>

                            <span>
                                Email: ${escapeHTML(proposal.author_email)}
                            </span>

                            <span>
                                Account ID: ${escapeHTML(proposal.author_id)}
                            </span>

                            <span>
                                Anonymous submission:
                                ${isAnonymous ? "Yes" : "No"}
                            </span>

                            <span>
                                Voting deadline:
                                ${escapeHTML(
                                    formatDeadline(proposal.voting_deadline)
                                )}
                            </span>

                        </div>

                        ${renderRejectionReason(
                            proposal.rejection_reason
                        )}

                        ${controls}

                        ${isPending && isStudent && deadlineExpired
                            ? `
                                <p class="admin-deadline-warning">
                                    The voting deadline has expired or is
                                    missing. This proposal cannot be published.
                                </p>
                            `
                            : ""}

                        ${isPending && !isStudent
                            ? `
                                <p class="admin-inline-note">
                                    This submission is not eligible for
                                    student proposal moderation.
                                </p>
                            `
                            : ""}

                    </article>
                `;
            }
        ).join("");
    }

    function renderDebates() {
        const selectedStatus =
            debateFilter.value;

        const visible = debates.filter(
            debate =>
                selectedStatus === "all" ||
                debate.status === selectedStatus
        );

        if (visible.length === 0) {
            debateList.innerHTML = `
                <div class="admin-empty">
                    No debates found for this status.
                </div>
            `;

            return;
        }

        debateList.innerHTML = visible.map(
            debate => {

                const isPending =
                    debate.status === "pending";

                const isAnonymous =
                    Number(debate.anonymous) === 1;

                const controls = isPending
                    ? renderModerationControls(
                        "debate",
                        debate.id
                    )
                    : "";

                return `
                    <article class="admin-proposal-card">

                        <div class="admin-proposal-top">

                            <div>

                                <h3>
                                    ${escapeHTML(debate.title)}
                                </h3>

                                <div class="admin-proposal-meta">

                                    <span class="admin-tag">
                                        ${escapeHTML(
                                            getCategoryName(debate.category)
                                        )}
                                    </span>

                                    <span class="admin-tag">
                                        ${escapeHTML(
                                            formatDate(debate.created_at)
                                        )}
                                    </span>

                                    ${isAnonymous
                                        ? '<span class="admin-tag">Anonymous</span>'
                                        : ""}

                                </div>

                            </div>

                            <span class="admin-tag ${escapeHTML(debate.status)}">
                                ${getStatusLabel(debate.status)}
                            </span>

                        </div>

                        <p class="admin-proposal-description">${escapeHTML(debate.description)}</p>

                        <div class="admin-author-info">

                            <strong>
                                Author information — Admin only
                            </strong>

                            <span>
                                Name: ${escapeHTML(debate.author_name)}
                            </span>

                            <span>
                                Email: ${escapeHTML(debate.author_email)}
                            </span>

                            <span>
                                Account ID: ${escapeHTML(debate.author_id)}
                            </span>

                            <span>
                                Anonymous submission:
                                ${isAnonymous ? "Yes" : "No"}
                            </span>

                        </div>

                        ${renderRejectionReason(
                            debate.rejection_reason
                        )}

                        <a
                            class="admin-debate-link"
                            href="debate.html?id=${Number(debate.id)}"
                        >
                            View Debate
                        </a>

                        ${controls}

                    </article>
                `;
            }
        ).join("");
    }

    async function loadProposals() {
        const data = await fetchJSON(
            "/api/admin/proposals"
        );

        proposals = data.proposals || [];

        renderProposals();
        updateStats();
    }

    async function loadDebates() {
        const data = await fetchJSON(
            "/api/admin/debates"
        );

        debates = data.debates || [];

        renderDebates();
        updateStats();
    }

    function setBusy(value) {
        busy = value;

        document.querySelectorAll(
            ".admin-action-button"
        ).forEach(button => {

            if (value) {
                if (!button.disabled) {
                    button.disabled = true;
                    button.dataset.busyDisabled = "true";
                }
            } else if (
                button.dataset.busyDisabled === "true"
            ) {
                button.disabled = false;
                delete button.dataset.busyDisabled;
            }

        });
    }

    async function moderateItem(
        kind,
        id,
        status,
        rejectionReason = ""
    ) {
        if (busy) {
            return;
        }

        if (status === "approved") {
            const itemName =
                kind === "proposal"
                    ? "proposal"
                    : "debate";

            const confirmed = window.confirm(
                `Publish this ${itemName} and make it visible to the community?`
            );

            if (!confirmed) {
                return;
            }
        }

        const endpoint =
            kind === "proposal"
                ? `/api/admin/proposals/${id}/status`
                : `/api/admin/debates/${id}/status`;

        setBusy(true);
        showFeedback(kind, "");

        try {

            const data = await fetchJSON(
                endpoint,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        status,
                        rejectionReason
                    })
                }
            );

            if (kind === "proposal") {
                await loadProposals();
            } else {
                await loadDebates();
            }

            showFeedback(
                kind,
                data.message ||
                    "Submission reviewed successfully.",
                "success"
            );

        } catch (error) {

            showFeedback(
                kind,
                error.message,
                "error"
            );

        } finally {
            setBusy(false);
        }
    }

    function handleModerationClick(event) {
        const button = event.target.closest(
            "button[data-action]"
        );

        if (!button || busy || button.disabled) {
            return;
        }

        const kind = button.dataset.kind;
        const action = button.dataset.action;

        const id = Number(
            button.dataset.id
        );

        if (
            !["proposal", "debate"].includes(kind) ||
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return;
        }

        const form = document.getElementById(
            `rejection-${kind}-${id}`
        );

        if (action === "reject") {
            if (form) {
                form.hidden = false;

                document.getElementById(
                    `reason-${kind}-${id}`
                )?.focus();
            }

            return;
        }
        if (action === "cancel-reject") {
            if (form) {
                form.hidden = true;
            }

            return;
        }
        if (action === "confirm-reject") {
            const textarea = document.getElementById(
                `reason-${kind}-${id}`
            );

            const reason =
                textarea?.value.trim() || "";

            if (
                reason.length < 10 ||
                reason.length > 500
            ) {
                showFeedback(
                    kind,
                    "Please provide a rejection reason between 10 and 500 characters.",
                    "error"
                );

                textarea?.focus();
                return;
            }

            moderateItem(
                kind,
                id,
                "rejected",
                reason
            );

            return;
        }
        if (action === "approve") {
            moderateItem(
                kind,
                id,
                "approved"
            );
        }
    }

    proposalList.addEventListener(
        "click",
        handleModerationClick
    );

    debateList.addEventListener(
        "click",
        handleModerationClick
    );

    proposalFilter.addEventListener(
        "change",
        renderProposals
    );

    debateFilter.addEventListener(
        "change",
        renderDebates
    );

    logoutButton.addEventListener(
        "click",
        async () => {

            logoutButton.disabled = true;

            try {

                await fetchJSON(
                    "/api/auth/logout",
                    {
                        method: "POST"
                    }
                );

                window.location.replace(
                    "login.html"
                );

            } catch (error) {

                showFeedback(
                    currentView === "proposals"
                        ? "proposal"
                        : "debate",

                    "Unable to log out. Please try again.",
                    "error"
                );

                logoutButton.disabled = false;
            }
        }
    );

    async function initializeDashboard() {
        try {

            const authData = await fetchJSON(
                "/api/auth/me"
            );

            const user = authData.user;

            if (!user) {
                window.location.replace(
                    "login.html"
                );

                return;
            }

            if (user.role !== "admin") {
                accessMessage.textContent =
                    "Access denied. This page is only available to administrators.";

                return;
            }

            adminName.textContent =
                user.name || "Administrator";

            const results = await Promise.allSettled([
                loadProposals(),
                loadDebates()
            ]);

            if (results[0].status === "rejected") {
                showFeedback(
                    "proposal",
                    results[0].reason.message,
                    "error"
                );

                proposalList.textContent =
                    "Unable to load proposals.";
            }

            if (results[1].status === "rejected") {
                showFeedback(
                    "debate",
                    results[1].reason.message,
                    "error"
                );

                debateList.textContent =
                    "Unable to load debates.";
            }

            switchView("proposals");

            accessMessage.hidden = true;
            adminContent.hidden = false;

        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

            accessMessage.textContent =
                "Unable to load the dashboard. Please try again.";
        }
    }

    initializeDashboard();

})();
