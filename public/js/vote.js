(() => {
    "use strict";

    const grid = document.getElementById("proposalGrid");
    const mainFilters = document.getElementById("mainFilters");
    const secondaryFilters = document.getElementById("secondaryFilters");
    const filterTitle = document.getElementById("filterTitle");
    const resultsCount = document.getElementById("resultsCount");
    const noResults = document.getElementById("noResults");
    const clearFilters = document.getElementById("clearFilters");
    const voteFeedback = document.getElementById("voteFeedback");

    if (
        !grid ||
        !mainFilters ||
        !secondaryFilters ||
        !filterTitle ||
        !resultsCount ||
        !noResults ||
        !clearFilters ||
        !voteFeedback
    ) {
        return;
    }

    const state = {
        proposals: [],
        currentUser: null,
        source: "all",
        category: null,
        loading: true,
        loadError: false,
        submittingVote: false,
        refreshing: false
    };

    const sourceLabels = {
        uc: "UC",
        nuclei: "Núcleos",
        student: "Student Proposal"
    };

    function createElement(tag, className = "", text = null) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== null && text !== undefined) {
            element.textContent = String(text);
        }

        return element;
    }

    function setFeedback(message, type = "success") {
        voteFeedback.textContent = message;
        voteFeedback.dataset.type = type;
        voteFeedback.hidden = !message;

        voteFeedback.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
    }

    function formatDeadline(deadline) {
        if (
            typeof deadline !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(deadline)
        ) {
            return "Unknown date";
        }

        const [year, month, day] = deadline.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== deadline
        ) {
            return "Unknown date";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function isVotingOpen(proposal) {
        return proposal.voting_open === true;
    }

    function getFilterConfig() {
        if (state.source === "all") {
            return null;
        }

        if (state.source === "nuclei") {
            const organizations = state.proposals
                .filter(proposal => proposal.source === "nuclei")
                .map(proposal => proposal.organization)
                .filter(Boolean);

            return {
                title: "Select a Núcleo",
                allLabel: "All Núcleos",
                options: [...new Set(organizations)].sort(
                    (a, b) => a.localeCompare(b, "pt")
                )
            };
        }

        const categories = state.proposals
            .filter(proposal => proposal.source === state.source)
            .map(proposal => proposal.category)
            .filter(Boolean);

        return {
            title: "Filter by topic",
            allLabel: "All categories",
            options: [...new Set(categories)].sort(
                (a, b) => a.localeCompare(b, "en")
            )
        };
    }

    function renderFilters() {
        const mainButtons = mainFilters.querySelectorAll(
            "[data-source]"
        );

        mainButtons.forEach(button => {
            const active = button.dataset.source === state.source;

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        clearFilters.disabled =
            state.source === "all" && state.category === null;

        const config = getFilterConfig();

        filterTitle.textContent = config
            ? config.title
            : "Browse all proposals";

        if (!config) {
            secondaryFilters.replaceChildren(
                createElement(
                    "p",
                    "filter-note",
                    "Select UC, Núcleos or Students to explore specific proposals."
                )
            );

            return;
        }

        const options = [
            { label: config.allLabel, value: null },
            ...config.options.map(option => ({
                label: option,
                value: option
            }))
        ];

        const buttons = options.map(option => {
            const active = state.category === option.value;

            const button = createElement(
                "button",
                "category-button" + (active ? " active" : ""),
                option.label
            );

            button.type = "button";
            button.dataset.value = option.value ?? "";
            button.setAttribute("aria-pressed", String(active));

            return button;
        });

        secondaryFilters.replaceChildren(...buttons);
    }

    function getVisibleProposals() {
        const filtered = state.proposals.filter(proposal => {
            const matchesSource =
                state.source === "all" ||
                proposal.source === state.source;

            if (!matchesSource) {
                return false;
            }

            if (!state.category) {
                return true;
            }

            if (state.source === "nuclei") {
                return proposal.organization === state.category;
            }

            return proposal.category === state.category;
        });

        return filtered.sort((a, b) => {
            const aOpen = isVotingOpen(a);
            const bOpen = isVotingOpen(b);
            if (aOpen !== bOpen) {
                return aOpen ? -1 : 1;
            }

            const aDeadline = a.voting_deadline || "";
            const bDeadline = b.voting_deadline || "";

            if (aDeadline !== bDeadline) {
                return aOpen
                    ? aDeadline.localeCompare(bDeadline)
                    : bDeadline.localeCompare(aDeadline);
            }

            return Number(b.id) - Number(a.id);
        });
    }

    function createResultsElement(proposal) {
        const yes = Math.max(0, Number(proposal.yes_votes) || 0);
        const no = Math.max(0, Number(proposal.no_votes) || 0);

        const total = yes + no;

        const yesPercentage = total
            ? Math.round((yes / total) * 100)
            : 0;

        const noPercentage = total
            ? 100 - yesPercentage
            : 0;

        const wrapper = createElement("div", "vote-results");

        wrapper.append(
            createElement(
                "div",
                "vote-results-heading",
                `${total} ${total === 1 ? "vote" : "votes"}`
            )
        );

        const results = [
            {
                label: "Yes",
                count: yes,
                percentage: yesPercentage,
                type: "yes"
            },
            {
                label: "No",
                count: no,
                percentage: noPercentage,
                type: "no"
            }
        ];

        results.forEach(result => {
            const row = createElement(
                "div",
                "vote-result-row"
            );

            const label = createElement(
                "div",
                "vote-result-label"
            );

            label.append(
                createElement("span", "", result.label),
                createElement(
                    "span",
                    "",
                    `${result.count} (${result.percentage}%)`
                )
            );

            const track = createElement(
                "div",
                "vote-progress-track"
            );

            const fill = createElement(
                "div",
                `vote-progress-fill ${result.type}`
            );

            fill.style.width = `${result.percentage}%`;

            track.append(fill);
            row.append(label, track);
            wrapper.append(row);
        });

        return wrapper;
    }

    function createVotingElement(proposal) {
        const wrapper = createElement(
            "div",
            "vote-interaction"
        );

        const votingOpen = isVotingOpen(proposal);
        const userVote = proposal.user_vote;

        if (!votingOpen) {
            wrapper.append(
                createElement(
                    "p",
                    "vote-closed-message",
                    "Voting has closed. Final results are shown below."
                )
            );
        }

        if (userVote === "yes" || userVote === "no") {
            wrapper.append(
                createElement(
                    "p",
                    "vote-confirmation",
                    `Your vote: ${userVote === "yes" ? "Yes" : "No"}`
                )
            );

        } else if (votingOpen && !state.currentUser) {
            const message = createElement(
                "p",
                "vote-login-message",
                "Sign in with a student account to vote. "
            );

            const link = createElement(
                "a",
                "",
                "Sign in"
            );

            link.href = "login.html";

            message.append(link);
            wrapper.append(message);

        } else if (
            votingOpen &&
            state.currentUser.role !== "student"
        ) {
            wrapper.append(
                createElement(
                    "p",
                    "vote-login-message",
                    "Voting is available to student accounts only."
                )
            );

        } else if (votingOpen) {
            const actions = createElement(
                "div",
                "vote-actions"
            );

            const yesButton = createElement(
                "button",
                "vote-button vote-yes",
                "Yes"
            );

            const noButton = createElement(
                "button",
                "vote-button vote-no",
                "No"
            );

            yesButton.type = "button";
            noButton.type = "button";

            yesButton.disabled = state.submittingVote;
            noButton.disabled = state.submittingVote;

            yesButton.addEventListener("click", () => {
                submitVote(proposal.id, "yes");
            });

            noButton.addEventListener("click", () => {
                submitVote(proposal.id, "no");
            });

            actions.append(yesButton, noButton);
            wrapper.append(actions);
        }

        wrapper.append(createResultsElement(proposal));

        return wrapper;
    }

    function createProposalCard(proposal) {
        const votingOpen = isVotingOpen(proposal);
        const isAnonymous = Number(proposal.anonymous) === 1;

        const card = createElement(
            "article",
            "proposal-card"
        );

        const meta = createElement(
            "div",
            "proposal-meta"
        );

        meta.append(
            createElement(
                "span",
                "proposal-tag",
                sourceLabels[proposal.source] || "Proposal"
            )
        );

        const secondaryLabel =
            proposal.source === "nuclei"
                ? proposal.organization || proposal.category
                : proposal.category;

        if (secondaryLabel) {
            meta.append(
                createElement(
                    "span",
                    "proposal-source",
                    secondaryLabel
                )
            );
        }

        card.append(meta);

        card.append(
            createElement(
                "h3",
                "",
                proposal.title || "Untitled proposal"
            )
        );

        const descriptionText = proposal.description || "";

        const description = createElement(
            "p",
            "proposal-description",
            descriptionText
        );

        card.append(description);

        if (descriptionText.length > 260) {
            const readMore = createElement(
                "button",
                "proposal-read-more",
                "Read full proposal"
            );

            readMore.type = "button";
            readMore.setAttribute("aria-expanded", "false");

            readMore.addEventListener("click", () => {
                const expanded = description.classList.toggle(
                    "expanded"
                );

                readMore.textContent = expanded
                    ? "Show less"
                    : "Read full proposal";

                readMore.setAttribute(
                    "aria-expanded",
                    String(expanded)
                );
            });

            card.append(readMore);
        }

        let authorName;

        if (proposal.source === "student" && isAnonymous) {
            authorName = "Anonymous Student";
        } else {
            authorName =
                proposal.author_name ||
                (proposal.source === "student"
                    ? "Student"
                    : "Organization");
        }

        card.append(
            createElement(
                "p",
                "proposal-author",
                `By ${authorName}`
            )
        );

        const deadlineBox = createElement(
            "div",
            "proposal-deadline"
        );

        deadlineBox.append(
            createElement(
                "span",
                "proposal-deadline-icon",
                "📅"
            )
        );

        const deadlineText = proposal.voting_deadline
            ? `${votingOpen ? "Voting closes" : "Voting closed"} on ` +
              `${formatDeadline(proposal.voting_deadline)} ` +
              "at 23:59 (Portugal time)"
            : "Voting deadline unavailable";

        deadlineBox.append(
            createElement("span", "", deadlineText)
        );

        card.append(deadlineBox);

        const footer = createElement(
            "div",
            "proposal-card-footer"
        );

        footer.append(
            createElement(
                "span",
                "proposal-status " +
                    (votingOpen ? "status-open" : "status-closed"),
                votingOpen ? "Open for voting" : "Voting closed"
            )
        );

        if (!votingOpen) {
            let outcome = "";

            if (proposal.voting_result === "approved") {
                outcome = "Community approved";
            } else if (
                proposal.voting_result === "not_approved"
            ) {
                outcome = "Not approved";
            }

            if (outcome) {
                footer.append(
                    createElement(
                        "span",
                        "proposal-outcome",
                        outcome
                    )
                );
            }
        }

        card.append(footer);

        card.append(createVotingElement(proposal));

        return card;
    }

    function renderProposals() {
        if (state.loading) {
            grid.replaceChildren(
                createElement(
                    "div",
                    "vote-loading",
                    "Loading proposals..."
                )
            );

            resultsCount.textContent = "Loading...";
            noResults.hidden = true;

            return;
        }

        if (state.loadError) {
            grid.replaceChildren();

            resultsCount.textContent = "Unavailable";
            noResults.hidden = false;

            noResults.querySelector("h3").textContent =
                "Unable to load proposals";

            noResults.querySelector("p").textContent =
                "Please refresh the page and try again.";

            return;
        }

        const visibleProposals = getVisibleProposals();

        grid.replaceChildren(
            ...visibleProposals.map(createProposalCard)
        );

        const count = visibleProposals.length;

        resultsCount.textContent =
            `${count} ${count === 1 ? "proposal" : "proposals"}`;

        noResults.hidden = count > 0;

        if (count === 0) {
            const title = noResults.querySelector("h3");
            const description = noResults.querySelector("p");

            if (state.proposals.length === 0) {
                title.textContent = "No proposals yet";

                description.textContent =
                    "There are no published proposals available.";

            } else {
                title.textContent = "No proposals found";

                description.textContent =
                    "Try another category or clear your filters.";
            }
        }
    }

    function renderAll() {
        renderFilters();
        renderProposals();
    }

    function setSource(nextSource) {
        const allowedSources = [
            "all",
            "uc",
            "nuclei",
            "student"
        ];

        if (!allowedSources.includes(nextSource)) {
            return;
        }

        state.source = nextSource;
        state.category = null;

        renderAll();
    }

    mainFilters.addEventListener("click", event => {
        const button = event.target.closest("[data-source]");

        if (!button) {
            return;
        }

        setSource(button.dataset.source);
    });

    secondaryFilters.addEventListener("click", event => {
        const button = event.target.closest(".category-button");

        if (!button) {
            return;
        }

        state.category = button.dataset.value || null;

        renderAll();
    });

    clearFilters.addEventListener("click", () => {
        setSource("all");
    });

    async function loadCurrentUser() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) {
                state.currentUser = null;
                return;
            }

            const data = await response.json();

            state.currentUser = data.user || null;

        } catch (error) {
            console.error(
                "Authentication check failed:",
                error
            );

            state.currentUser = null;
        }
    }

    async function loadProposals() {
        state.loading = true;
        state.loadError = false;

        renderProposals();

        try {
            const response = await fetch("/api/proposals", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Unable to load proposals.");
            }

            const data = await response.json();

            state.proposals = Array.isArray(data.proposals)
                ? data.proposals
                : [];

        } catch (error) {
            console.error(
                "Proposal loading error:",
                error
            );

            state.loadError = true;

        } finally {
            state.loading = false;
            renderAll();
        }
    }

    async function submitVote(proposalId, vote) {
        if (state.submittingVote) {
            return;
        }

        const choice = vote === "yes" ? "Yes" : "No";

        const confirmed = window.confirm(
            `Confirm your vote: ${choice}?\n\n` +
            "You cannot change your vote afterwards."
        );

        if (!confirmed) {
            return;
        }

        state.submittingVote = true;
        setFeedback("");

        grid.querySelectorAll(".vote-button").forEach(button => {
            button.disabled = true;
        });

        try {
            const response = await fetch(
                `/api/proposals/${proposalId}/vote`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({ vote })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to record your vote."
                );
            }

            await loadProposals();

            if (state.loadError) {
                setFeedback(
                    "Your vote was recorded, but the proposals could not be refreshed. Please reload the page.",
                    "success"
                );
            } else {
                setFeedback(
                    `Your vote (${choice}) has been recorded successfully.`,
                    "success"
                );
            }

        } catch (error) {
            console.error("Voting error:", error);

            setFeedback(
                error.message || "Unable to record your vote.",
                "error"
            );

        } finally {
            state.submittingVote = false;

            if (!state.loading) {
                renderProposals();
            }
        }
    }

    async function refreshPage() {
        if (state.refreshing || state.submittingVote) {
            return;
        }

        state.refreshing = true;

        try {
            await loadCurrentUser();
            await loadProposals();
        } finally {
            state.refreshing = false;
        }
    }

    renderAll();
    refreshPage();

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            refreshPage();
        }
    });

})();
