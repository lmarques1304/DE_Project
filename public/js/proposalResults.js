(() => {
    "use strict";

    const page = document.querySelector(".results-page[data-result]");
    if (!page) return;

    const mode = page.dataset.result;
    if (!["approved", "not_approved"].includes(mode)) return;

    const approved = mode === "approved";
    const $ = id => document.getElementById(id);
    const grid = $("resultsGrid");
    const mainFilters = $("resultsMainFilters");
    const filters = $("resultsFilters");
    const filterTitle = $("resultsFilterTitle");
    const clearFilters = $("clearResultsFilters");
    const totalElement = $("resultsTotal");
    const resultsCount = $("resultsCount");
    const empty = $("resultsEmpty");
    const emptyTitle = $("resultsEmptyTitle");
    const emptyMessage = $("resultsEmptyMessage");
    const errorElement = $("resultsError");

    if (![grid, mainFilters, filters, filterTitle, clearFilters, totalElement,
        resultsCount, empty, emptyTitle, emptyMessage, errorElement].every(Boolean)) {
        console.error("Missing proposal results page elements.");
        return;
    }

    const state = { proposals: [], source: "all", category: null, loading: false, error: false };
    const sourceLabels = { uc: "UC", nuclei: "Núcleos", student: "Students" };
    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    });

    function element(tag, className = "", text = null) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = String(text);
        return node;
    }

    function button(className, text) {
        const node = element("button", className, text);
        node.type = "button";
        return node;
    }

    function formatDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return "Date unavailable";
        }

        const date = new Date(`${value}T00:00:00Z`);
        return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
            ? "Date unavailable" : dateFormatter.format(date);
    }

    function getAuthor(proposal) {
        if (proposal.source === "student" && Number(proposal.anonymous) === 1) {
            return "Anonymous Student";
        }

        const defaults = {
            student: "Student",
            uc: "University of Coimbra",
            nuclei: proposal.organization || "Student Organization"
        };

        return proposal.author_name || defaults[proposal.source] || "Community Member";
    }

    const getFilterValue = proposal => state.source === "nuclei"
        ? proposal.organization : proposal.category;

    function getOptions() {
        return [...new Set(state.proposals
            .filter(proposal => proposal.source === state.source)
            .map(getFilterValue).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, state.source === "nuclei" ? "pt" : "en"));
    }

    function renderFilters() {
        mainFilters.querySelectorAll("[data-source]").forEach(node => {
            const active = node.dataset.source === state.source;
            node.classList.toggle("active", active);
            node.setAttribute("aria-pressed", String(active));
        });

        clearFilters.disabled = state.source === "all";

        if (state.source === "all") {
            filterTitle.textContent = approved ? "Browse all approved proposals" : "Browse all proposals";
            filters.replaceChildren(element("p", "results-filter-note",
                "Choose UC, Núcleos or Students to narrow the results."));
            return;
        }

        const nuclei = state.source === "nuclei";
        filterTitle.textContent = nuclei ? "Select a Núcleo" : "Filter by topic";

        filters.replaceChildren(...[null, ...getOptions()].map(value => {
            const node = button("results-filter-button", value ?? (nuclei ? "All Núcleos" : "All categories"));
            const active = state.category === value;
            node.dataset.value = value ?? "";
            node.classList.toggle("active", active);
            node.setAttribute("aria-pressed", String(active));
            return node;
        }));
    }

    function getVisibleProposals() {
        return state.proposals.filter(proposal =>
            (state.source === "all" || proposal.source === state.source) &&
            (!state.category || getFilterValue(proposal) === state.category)
        ).sort((a, b) =>
            (b.voting_deadline || "").localeCompare(a.voting_deadline || "") ||
            Number(b.id) - Number(a.id)
        );
    }

    function createVoteRow(label, votes, percentage, type) {
        const row = element("div", "results-vote-row");
        const heading = element("div", "results-vote-label");
        const track = element("div", "results-vote-track");
        const fill = element("div", `results-vote-fill ${type}`);

        heading.append(element("span", "", `${label} (${votes})`),
            element("strong", "", `${percentage}%`));

        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", `${label} votes`);
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", String(percentage));

        fill.style.width = `${percentage}%`;
        track.append(fill);
        row.append(heading, track);
        return row;
    }

    function createVoteResults(proposal) {
        const yes = Math.max(0, Number(proposal.yes_votes) || 0);
        const no = Math.max(0, Number(proposal.no_votes) || 0);
        const total = yes + no;
        const yesPercentage = total ? Math.round(yes / total * 100) : 0;
        const noPercentage = total ? 100 - yesPercentage : 0;
        const results = element("div", "results-vote-results");

        results.append(
            element("h4", "", "Final voting results"),
            createVoteRow("Yes", yes, yesPercentage, "yes"),
            createVoteRow("No", no, noPercentage, "no"),
            element("p", "results-vote-total", `${total} total ${total === 1 ? "vote" : "votes"}`)
        );

        const reason = total === 0 ? "No votes received"
            : yes === no ? "Tied vote — no majority" : "More No votes than Yes votes";

        return { results, reason };
    }

    function createCard(proposal) {
        const card = element("article", "results-card");
        const top = element("div", "results-card-top");
        const tags = element("div", "results-card-tags");
        const badge = element("span", "results-badge");

        tags.append(
            element("span", "results-category", proposal.category || "Other"),
            element("span", "results-source", sourceLabels[proposal.source] || "Community")
        );

        if (approved) {
            const icon = element("span", "results-badge-icon", "✓");
            icon.setAttribute("aria-hidden", "true");
            badge.append(icon, element("span", "", "Approved by vote"));
        } else {
            badge.textContent = "Not approved by vote";
        }

        top.append(tags, badge);

        const description = element("p", "results-description", proposal.description || "");
        const readMore = button("results-read-more", "Read full proposal");
        readMore.hidden = true;
        readMore.setAttribute("aria-expanded", "false");

        readMore.addEventListener("click", () => {
            const expanded = description.classList.toggle("expanded");
            readMore.textContent = expanded ? "Show less" : "Read full proposal";
            readMore.setAttribute("aria-expanded", String(expanded));
        });

        const { results, reason } = createVoteResults(proposal);
        const footer = element("div", "results-card-footer");

        footer.append(
            element("span", "", `Voting ended: ${formatDate(proposal.voting_deadline)}`),
            element("strong", "", approved ? "Community supported" : "Voting closed")
        );

        card.append(top, element("h3", "", proposal.title || "Untitled proposal"),
            description, readMore, element("p", "results-author", `Proposed by ${getAuthor(proposal)}`));

        if (!approved) card.append(element("p", "results-outcome", reason));

        card.append(results, footer);
        return card;
    }

    function updateReadMore() {
        grid.querySelectorAll(".results-description").forEach(description => {
            description.nextElementSibling.hidden =
                !description.classList.contains("expanded") &&
                description.textContent.length <= 260 &&
                description.scrollHeight <= description.clientHeight + 1;
        });
    }

    function renderProposals() {
        empty.hidden = true;
        errorElement.hidden = true;

        if (state.loading) {
            grid.replaceChildren(element("div", "results-loading", "Loading proposals..."));
            resultsCount.textContent = "Loading...";
            return;
        }

        if (state.error) {
            grid.replaceChildren();
            resultsCount.textContent = "Unavailable";
            errorElement.textContent = "Unable to load proposals. Please refresh the page and try again.";
            errorElement.hidden = false;
            return;
        }

        const proposals = getVisibleProposals();
        const count = proposals.length;
        resultsCount.textContent = `${count} ${count === 1 ? "proposal" : "proposals"}`;
        grid.replaceChildren(...proposals.map(createCard));

        if (!count) {
            empty.hidden = false;

            if (state.proposals.length) {
                emptyTitle.textContent = "No proposals match these filters";
                emptyMessage.textContent = "Try another source, category or Núcleo, or clear your filters.";
            } else {
                emptyTitle.textContent = approved ? "No approved proposals yet" : "No unsuccessful proposals yet";
                emptyMessage.textContent = approved
                    ? "There are no community-approved proposals yet. Check back after the first voting periods end."
                    : "No published proposals have completed voting without majority support yet.";
            }
        }

        updateReadMore();
    }

    function renderAll() {
        renderFilters();
        renderProposals();
    }

    function setSource(source) {
        if (source !== "all" && !Object.hasOwn(sourceLabels, source)) return;
        state.source = source;
        state.category = null;
        renderAll();
    }

    async function loadProposals() {
        if (state.loading) return;
        state.loading = true;
        state.error = false;
        renderAll();

        try {
            const response = await fetch(approved ? "/api/proposals/approved" : "/api/proposals", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) throw new Error("Unable to load proposals.");

            const data = await response.json();
            if (!Array.isArray(data?.proposals)) throw new Error("Invalid proposals response.");

            state.proposals = approved ? data.proposals : data.proposals.filter(proposal =>
                proposal.voting_result === "not_approved" &&
                proposal.voting_open === false &&
                Boolean(proposal.voting_deadline)
            );

            totalElement.textContent = String(state.proposals.length);
            if (state.category !== null && !getOptions().includes(state.category)) state.category = null;
        } catch (error) {
            console.error("Proposal results loading error:", error);
            state.proposals = [];
            state.category = null;
            state.error = true;
            totalElement.textContent = "—";
        } finally {
            state.loading = false;
            renderAll();
        }
    }

    mainFilters.addEventListener("click", event => {
        const node = event.target.closest("[data-source]");
        if (node) setSource(node.dataset.source);
    });

    filters.addEventListener("click", event => {
        const node = event.target.closest(".results-filter-button");
        if (!node) return;
        state.category = node.dataset.value || null;
        renderAll();
    });

    clearFilters.addEventListener("click", () => setSource("all"));
    window.addEventListener("resize", updateReadMore);
    document.fonts?.ready.then(updateReadMore);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) loadProposals();
    });

    loadProposals();
})();