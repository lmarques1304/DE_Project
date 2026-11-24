(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const grid = $("proposalGrid");
    const mainFilters = $("mainFilters");
    const secondaryFilters = $("secondaryFilters");
    const filterTitle = $("filterTitle");
    const resultsCount = $("resultsCount");
    const noResults = $("noResults");
    const clearFilters = $("clearFilters");
    const voteFeedback = $("voteFeedback");

    if (![grid, mainFilters, secondaryFilters, filterTitle,
        resultsCount, noResults, clearFilters, voteFeedback].every(Boolean)) return;

    const state = {
        proposals: [],
        currentUser: null,
        source: "all",
        category: null,
        loading: false,
        loadError: false,
        submittingVote: false
    };

    const sourceLabels = {
        uc: "UC",
        nuclei: "Núcleos",
        student: "Student Proposal"
    };

    const outcomeLabels = {
        approved: "Community approved",
        not_approved: "Not approved"
    };

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    });

    const isVotingOpen = proposal => proposal.voting_open === true;
    const getFilterValue = proposal => state.source === "nuclei"
        ? proposal.organization : proposal.category;

    function createElement(tag, className = "", text = null) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = String(text);
        return element;
    }

    function createButton(className, text, onClick) {
        const button = createElement("button", className, text);
        button.type = "button";
        if (onClick) button.addEventListener("click", onClick);
        return button;
    }

    function setFeedback(message = "", type = "success") {
        voteFeedback.textContent = message;
        voteFeedback.dataset.type = type;
        voteFeedback.hidden = !message;
        voteFeedback.setAttribute("role", type === "error" ? "alert" : "status");
    }

    function formatDeadline(deadline) {
        if (typeof deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
            return "Unknown date";
        }

        const date = new Date(`${deadline}T00:00:00Z`);

        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== deadline) {
            return "Unknown date";
        }

        return dateFormatter.format(date);
    }

    async function fetchJSON(url, options = {}, fallback = "Something went wrong.") {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data) throw new Error(data?.error || fallback);

        return data;
    }

    function getFilterConfig() {
        if (state.source === "all") return null;

        const nuclei = state.source === "nuclei";
        const values = state.proposals
            .filter(proposal => proposal.source === state.source)
            .map(getFilterValue)
            .filter(Boolean);

        return {
            title: nuclei ? "Select a Núcleo" : "Filter by topic",
            allLabel: nuclei ? "All Núcleos" : "All categories",
            options: [...new Set(values)].sort((a, b) => a.localeCompare(b, nuclei ? "pt" : "en"))
        };
    }

    function renderFilters() {
        mainFilters.querySelectorAll("[data-source]").forEach(button => {
            const active = button.dataset.source === state.source;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        clearFilters.disabled = state.source === "all" && state.category === null;

        const config = getFilterConfig();
        filterTitle.textContent = config?.title || "Browse all proposals";

        if (!config) {
            secondaryFilters.replaceChildren(createElement("p", "filter-note",
                "Select UC, Núcleos or Students to explore specific proposals."));
            return;
        }

        const buttons = [null, ...config.options].map(value => {
            const active = state.category === value;
            const button = createButton("category-button", value ?? config.allLabel);
            button.classList.toggle("active", active);
            button.dataset.value = value ?? "";
            button.setAttribute("aria-pressed", String(active));
            return button;
        });

        secondaryFilters.replaceChildren(...buttons);
    }

    function getVisibleProposals() {
        return state.proposals.filter(proposal =>
            (state.source === "all" || proposal.source === state.source) &&
            (!state.category || getFilterValue(proposal) === state.category)
        ).sort((a, b) => {
            const aOpen = isVotingOpen(a);
            const bOpen = isVotingOpen(b);

            if (aOpen !== bOpen) return aOpen ? -1 : 1;

            const deadlineOrder = (a.voting_deadline || "").localeCompare(b.voting_deadline || "");
            return (aOpen ? deadlineOrder : -deadlineOrder) || Number(b.id) - Number(a.id);
        });
    }

    function createResultsElement(proposal) {
        const yes = Math.max(0, Number(proposal.yes_votes) || 0);
        const no = Math.max(0, Number(proposal.no_votes) || 0);
        const total = yes + no;
        const yesPercentage = total ? Math.round(yes / total * 100) : 0;
        const noPercentage = total ? 100 - yesPercentage : 0;
        const wrapper = createElement("div", "vote-results");

        wrapper.append(createElement("div", "vote-results-heading",
            `${total} ${total === 1 ? "vote" : "votes"}`));

        const results = [
            ["Yes", yes, yesPercentage, "yes"],
            ["No", no, noPercentage, "no"]
        ];

        results.forEach(([label, count, percentage, type]) => {
            const row = createElement("div", "vote-result-row");
            const heading = createElement("div", "vote-result-label");
            const track = createElement("div", "vote-progress-track");
            const fill = createElement("div", `vote-progress-fill ${type}`);

            heading.append(createElement("span", "", label),
                createElement("span", "", `${count} (${percentage}%)`));

            fill.style.width = `${percentage}%`;
            track.append(fill);
            row.append(heading, track);
            wrapper.append(row);
        });

        return wrapper;
    }

    function createVotingElement(proposal) {
        const wrapper = createElement("div", "vote-interaction");
        const open = isVotingOpen(proposal);
        const userVote = proposal.user_vote;

        if (!open) {
            wrapper.append(createElement("p", "vote-closed-message",
                "Voting has closed. Final results are shown below."));
        }

        if (["yes", "no"].includes(userVote)) {
            wrapper.append(createElement("p", "vote-confirmation",
                `Your vote: ${userVote === "yes" ? "Yes" : "No"}`));
        } else if (open && !state.currentUser) {
            const message = createElement("p", "vote-login-message",
                "Sign in with a student account to vote. ");
            const link = createElement("a", "", "Sign in");
            link.href = "login.html";
            message.append(link);
            wrapper.append(message);
        } else if (open && state.currentUser?.role !== "student") {
            wrapper.append(createElement("p", "vote-login-message",
                "Voting is available to student accounts only."));
        } else if (open) {
            const actions = createElement("div", "vote-actions");

            ["yes", "no"].forEach(vote => {
                const button = createButton(`vote-button vote-${vote}`,
                    vote === "yes" ? "Yes" : "No", () => submitVote(proposal.id, vote));
                button.disabled = state.submittingVote;
                actions.append(button);
            });

            wrapper.append(actions);
        }

        wrapper.append(createResultsElement(proposal));
        return wrapper;
    }

    function createProposalCard(proposal) {
        const open = isVotingOpen(proposal);
        const card = createElement("article", "proposal-card");
        const meta = createElement("div", "proposal-meta");
        const secondaryLabel = proposal.source === "nuclei"
            ? proposal.organization || proposal.category : proposal.category;

        meta.append(createElement("span", "proposal-tag", sourceLabels[proposal.source] || "Proposal"));

        if (secondaryLabel) {
            meta.append(createElement("span", "proposal-source", secondaryLabel));
        }

        const description = createElement("p", "proposal-description", proposal.description || "");
        const readMore = createButton("proposal-read-more", "Read full proposal", () => {
            const expanded = description.classList.toggle("expanded");
            readMore.textContent = expanded ? "Show less" : "Read full proposal";
            readMore.setAttribute("aria-expanded", String(expanded));
            updateReadMore();
        });

        readMore.setAttribute("aria-expanded", "false");
        readMore.hidden = true;

        const student = proposal.source === "student";
        const author = student && Number(proposal.anonymous) === 1
            ? "Anonymous Student"
            : proposal.author_name || (student ? "Student" : "Organization");

        const deadlineBox = createElement("div", "proposal-deadline");
        const deadlineText = proposal.voting_deadline
            ? `${open ? "Voting closes" : "Voting closed"} on ${formatDeadline(proposal.voting_deadline)} at 23:59 (Portugal time)`
            : "Voting deadline unavailable";

        const icon = createElement("span", "proposal-deadline-icon", "📅");
        icon.setAttribute("aria-hidden", "true");
        deadlineBox.append(icon, createElement("span", "", deadlineText));

        const footer = createElement("div", "proposal-card-footer");
        footer.append(createElement("span", `proposal-status status-${open ? "open" : "closed"}`,
            open ? "Open for voting" : "Voting closed"));

        if (!open && outcomeLabels[proposal.voting_result]) {
            footer.append(createElement("span", "proposal-outcome", outcomeLabels[proposal.voting_result]));
        }

        card.append(meta,
            createElement("h3", "", proposal.title || "Untitled proposal"),
            description, readMore,
            createElement("p", "proposal-author", `By ${author}`),
            deadlineBox, footer, createVotingElement(proposal));

        return card;
    }

    function updateReadMore() {
        grid.querySelectorAll(".proposal-description").forEach(description => {
            const button = description.nextElementSibling;
            button.hidden = !description.classList.contains("expanded") &&
                description.textContent.length <= 260 &&
                description.scrollHeight <= description.clientHeight + 1;
        });
    }

    function showEmptyState(title, description) {
        noResults.querySelector("h3").textContent = title;
        noResults.querySelector("p").textContent = description;
        noResults.hidden = false;
    }

    function renderProposals() {
        noResults.hidden = true;

        if (state.loading) {
            grid.replaceChildren(createElement("div", "vote-loading", "Loading proposals..."));
            resultsCount.textContent = "Loading...";
            return;
        }

        if (state.loadError) {
            grid.replaceChildren();
            resultsCount.textContent = "Unavailable";
            showEmptyState("Unable to load proposals", "Please refresh the page and try again.");
            return;
        }

        const proposals = getVisibleProposals();
        const count = proposals.length;
        grid.replaceChildren(...proposals.map(createProposalCard));
        resultsCount.textContent = `${count} ${count === 1 ? "proposal" : "proposals"}`;

        if (!count) {
            if (state.proposals.length) {
                showEmptyState("No proposals found", "Try another category or clear your filters.");
            } else {
                showEmptyState("No proposals yet", "There are no published proposals available.");
            }
        }

        updateReadMore();
    }

    function renderAll() {
        renderFilters();
        renderProposals();
    }

    function setSource(source) {
        if (!["all", "uc", "nuclei", "student"].includes(source)) return;
        state.source = source;
        state.category = null;
        renderAll();
    }

    async function loadCurrentUser() {
        try {
            const data = await fetchJSON("/api/auth/me");
            state.currentUser = data.user || null;
        } catch (error) {
            state.currentUser = null;
            console.error("Authentication check failed:", error);
        }
    }

    async function loadProposals(refreshUser = false) {
        state.loading = true;
        state.loadError = false;
        renderProposals();

        try {
            if (refreshUser) await loadCurrentUser();

            const data = await fetchJSON("/api/proposals", {}, "Unable to load proposals.");
            state.proposals = Array.isArray(data.proposals) ? data.proposals : [];
        } catch (error) {
            state.loadError = true;
            console.error("Proposal loading error:", error);
        } finally {
            state.loading = false;
            renderAll();
        }
    }

    function setVotingBusy(busy) {
        state.submittingVote = busy;
        grid.querySelectorAll(".vote-button").forEach(button => {
            button.disabled = busy;
        });
    }

    async function submitVote(proposalId, vote) {
        if (state.submittingVote || state.loading || state.currentUser?.role !== "student") return;

        const proposal = state.proposals.find(item => item.id === proposalId);

        if (!proposal || !isVotingOpen(proposal) || proposal.user_vote || !["yes", "no"].includes(vote)) return;

        const choice = vote === "yes" ? "Yes" : "No";

        if (!window.confirm(`Confirm your vote: ${choice}?\n\nYou cannot change your vote afterwards.`)) return;

        setVotingBusy(true);
        setFeedback();

        try {
            await fetchJSON(`/api/proposals/${encodeURIComponent(proposalId)}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vote })
            }, "Unable to record your vote.");

            await loadProposals();

            setFeedback(state.loadError
                ? "Your vote was recorded, but the proposals could not be refreshed. Please reload the page."
                : `Your vote (${choice}) has been recorded successfully.`);
        } catch (error) {
            console.error("Voting error:", error);
            setFeedback(error.message || "Unable to record your vote.", "error");
        } finally {
            setVotingBusy(false);
        }
    }

    function refreshPage() {
        if (!state.loading && !state.submittingVote) return loadProposals(true);
    }

    mainFilters.addEventListener("click", event => {
        const button = event.target.closest("[data-source]");
        if (button) setSource(button.dataset.source);
    });

    secondaryFilters.addEventListener("click", event => {
        const button = event.target.closest(".category-button");
        if (!button) return;
        state.category = button.dataset.value || null;
        renderAll();
    });

    clearFilters.addEventListener("click", () => setSource("all"));
    window.addEventListener("resize", updateReadMore);
    document.fonts?.ready.then(updateReadMore);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshPage();
    });

    renderFilters();
    refreshPage();
})();