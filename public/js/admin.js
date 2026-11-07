/* ADMIN DASHBOARD */

(() => {
    const accessMessage = document.getElementById("adminAccessMessage");
    const adminContent = document.getElementById("adminContent");
    const proposalList = document.getElementById("adminProposalList");
    const statusFilter = document.getElementById("adminStatusFilter");
    const feedback = document.getElementById("adminFeedback");
    const logoutButton = document.getElementById("adminLogout");

    let proposals = [];
    let busy = false;

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function showFeedback(message, type = "") {
        feedback.textContent = message;
        feedback.className = `admin-feedback ${type}`;
    }

    function updateStats(stats) {
        document.getElementById("statTotal").textContent = stats.total;
        document.getElementById("statPending").textContent = stats.pending;
        document.getElementById("statApproved").textContent = stats.approved;
        document.getElementById("statRejected").textContent = stats.rejected;
    }

    function formatDate(value) {
        if (!value) return "Unknown date";

        const date = new Date(value.replace(" ", "T") + "Z");

        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatDeadline(value) {
        if (!value) return "Not specified";

        const date = new Date(`${value}T12:00:00Z`);

        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        });
    }

    function getPortugalToday() {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());
    }

    function getPublicationStatusLabel(status) {
        if (status === "approved") return "Published";
        if (status === "rejected") return "Publication Rejected";
        return "Pending Review";
    }

    function renderProposals() {
        const selectedStatus = statusFilter.value;

        const visibleProposals = proposals.filter(proposal => {
            return selectedStatus === "all" ||
                proposal.status === selectedStatus;
        });

        if (visibleProposals.length === 0) {
            proposalList.innerHTML = `
                <div class="admin-empty">
                    No proposals found for this status.
                </div>
            `;
            return;
        }

        const today = getPortugalToday();

        proposalList.innerHTML = visibleProposals.map(proposal => {
            const isPending = proposal.status === "pending";
            const isAnonymous = proposal.anonymous === 1;

            const deadlineExpired =
                !proposal.voting_deadline ||
                proposal.voting_deadline < today;

            const rejectionReason = proposal.rejection_reason
                ? `
                    <div class="admin-rejection-reason">
                        <strong>Reason for publication rejection</strong>
                        <p>${escapeHTML(proposal.rejection_reason)}</p>
                    </div>
                `
                : "";

            return `
                <article class="admin-proposal-card">

                    <div class="admin-proposal-top">
                        <div>
                            <h3>${escapeHTML(proposal.title)}</h3>

                            <div class="admin-proposal-meta">
                                <span class="admin-tag">
                                    ${escapeHTML(proposal.category)}
                                </span>

                                <span class="admin-tag">
                                    ${escapeHTML(proposal.source)}
                                </span>

                                <span class="admin-tag">
                                    ${escapeHTML(formatDate(proposal.created_at))}
                                </span>

                                ${isAnonymous
                                    ? '<span class="admin-tag">Anonymous</span>'
                                    : ""}
                            </div>
                        </div>

                        <span class="admin-tag ${escapeHTML(proposal.status)}">
                            ${getPublicationStatusLabel(proposal.status)}
                        </span>
                    </div>

                    <p class="admin-proposal-description">
                        ${escapeHTML(proposal.description)}
                    </p>

                    <div class="admin-author-info">
                        <strong>Author information — Admin only</strong>
                        <span>Name: ${escapeHTML(proposal.author_name)}</span>
                        <span>Email: ${escapeHTML(proposal.author_email)}</span>
                        <span>Account ID: ${escapeHTML(proposal.author_id)}</span>
                        <span>Anonymous submission: ${isAnonymous ? "Yes" : "No"}</span>
                        <span>Voting deadline: ${escapeHTML(formatDeadline(proposal.voting_deadline))}</span>
                    </div>

                    ${rejectionReason}

                    ${isPending ? `
                        <div class="admin-actions">

                            <button
                                type="button"
                                class="admin-action-button admin-approve"
                                data-id="${proposal.id}"
                                data-status="approved"
                                ${deadlineExpired ? "disabled" : ""}>
                                Publish Proposal
                            </button>

                            <button
                                type="button"
                                class="admin-action-button admin-reject"
                                data-id="${proposal.id}"
                                data-status="rejected">
                                Reject Publication
                            </button>

                        </div>

                        ${deadlineExpired ? `
                            <p class="admin-deadline-warning">
                                The voting deadline has expired or is missing.
                                This proposal cannot be published.
                            </p>
                        ` : ""}

                        <div
                            class="admin-rejection-form"
                            id="rejectionForm-${proposal.id}"
                            hidden>

                            <label for="rejectionReason-${proposal.id}">
                                Reason for rejection
                            </label>

                            <textarea
                                id="rejectionReason-${proposal.id}"
                                rows="4"
                                minlength="10"
                                maxlength="500"
                                placeholder="Explain why this proposal cannot be published..."
                            ></textarea>

                            <p>
                                This explanation will be visible to the student.
                                Minimum 10 characters, maximum 500.
                            </p>

                            <div class="admin-rejection-controls">
                                <button
                                    type="button"
                                    class="admin-action-button admin-reject"
                                    data-confirm-rejection="${proposal.id}">
                                    Confirm Rejection
                                </button>

                                <button
                                    type="button"
                                    class="admin-action-button"
                                    data-cancel-rejection="${proposal.id}">
                                    Cancel
                                </button>
                            </div>

                        </div>
                    ` : ""}

                </article>
            `;
        }).join("");
    }

    async function loadProposals() {
        const response = await fetch("/api/admin/proposals", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Unable to load proposals.");
        }

        const data = await response.json();

        proposals = data.proposals;
        updateStats(data.stats);
        renderProposals();
    }

    async function moderateProposal(id, status, rejectionReason = "") {
        if (busy) return;

        if (status === "approved") {
            const confirmed = window.confirm(
                "Publish this proposal and make it available for community voting?"
            );

            if (!confirmed) return;
        }

        busy = true;

        proposalList.querySelectorAll(
            ".admin-action-button"
        ).forEach(button => {
            button.disabled = true;
        });

        try {
            const response = await fetch(
                `/api/admin/proposals/${id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        status,
                        rejectionReason
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to review proposal."
                );
            }

            await loadProposals();

            showFeedback(data.message, "success");
        } catch (error) {
            showFeedback(error.message, "error");

            try {
                await loadProposals();
            } catch (refreshError) {
                console.error(refreshError);
            }
        } finally {
            busy = false;

            proposalList.querySelectorAll(
                ".admin-action-button"
            ).forEach(button => {
                button.disabled = false;
            });

            renderProposals();
        }
    }

    proposalList.addEventListener("click", event => {
        const button = event.target.closest("button");

        if (!button || busy) return;

        const id = Number(
            button.dataset.id ||
            button.dataset.confirmRejection ||
            button.dataset.cancelRejection
        );

        if (!Number.isSafeInteger(id) || id <= 0) return;

        if (button.dataset.cancelRejection) {
            const form = document.getElementById(
                `rejectionForm-${id}`
            );

            if (form) form.hidden = true;
            return;
        }

        if (button.dataset.confirmRejection) {
            const textarea = document.getElementById(
                `rejectionReason-${id}`
            );

            const reason = textarea?.value.trim() || "";

            if (reason.length < 10 || reason.length > 500) {
                showFeedback(
                    "Please provide a rejection reason between 10 and 500 characters.",
                    "error"
                );
                textarea?.focus();
                return;
            }

            moderateProposal(id, "rejected", reason);
            return;
        }

        if (button.dataset.status === "rejected") {
            const form = document.getElementById(
                `rejectionForm-${id}`
            );

            if (form) {
                form.hidden = false;

                document.getElementById(
                    `rejectionReason-${id}`
                )?.focus();
            }

            return;
        }

        if (button.dataset.status === "approved") {
            moderateProposal(id, "approved");
        }
    });

    statusFilter.addEventListener("change", renderProposals);

    logoutButton.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Logout failed.");
            }

            window.location.href = "login.html";
        } catch (error) {
            showFeedback(
                "Unable to log out. Please try again.",
                "error"
            );
        }
    });

    async function initializeDashboard() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                window.location.replace("login.html");
                return;
            }

            const data = await response.json();
            const user = data.user || data;

            if (user.role !== "admin") {
                accessMessage.textContent =
                    "Access denied. This page is only available to administrators.";
                return;
            }

            await loadProposals();

            accessMessage.hidden = true;
            adminContent.hidden = false;
        } catch (error) {
            console.error("Dashboard error:", error);

            accessMessage.textContent =
                "Unable to load the dashboard. Please try again.";
        }
    }

    initializeDashboard();
})();