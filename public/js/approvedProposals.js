(() => {
    "use strict";

    const grid = document.getElementById("approvedGrid");

    const mainFilters = document.getElementById(
        "approvedMainFilters"
    );

    const secondaryFilters = document.getElementById(
        "approvedFilters"
    );

    const filterTitle = document.getElementById(
        "approvedFilterTitle"
    );

    const clearFilters = document.getElementById(
        "clearApprovedFilters"
    );

    const totalElement = document.getElementById(
        "approvedTotal"
    );

    const resultsCount = document.getElementById(
        "approvedResultsCount"
    );

    const emptyElement = document.getElementById(
        "approvedEmpty"
    );

    const emptyTitle = document.getElementById(
        "approvedEmptyTitle"
    );

    const emptyMessage = document.getElementById(
        "approvedEmptyMessage"
    );

    const errorElement = document.getElementById(
        "approvedError"
    );

    if (
        !grid ||
        !mainFilters ||
        !secondaryFilters ||
        !filterTitle ||
        !clearFilters ||
        !totalElement ||
        !resultsCount ||
        !emptyElement ||
        !emptyTitle ||
        !emptyMessage ||
        !errorElement
    ) {
        return;
    }

    const state = {
        proposals: [],
        source: "all",
        category: null,
        loading: true,
        loadError: false,
        refreshing: false
    };

    const sourceLabels = {
        uc: "UC",
        nuclei: "Núcleos",
        student: "Students"
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

    function formatApprovedDate(value) {
        if (
            typeof value !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            return "Date unavailable";
        }

        const [year, month, day] = value.split("-").map(Number);

        const date = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== value
        ) {
            return "Date unavailable";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function getApprovedAuthor(proposal) {
        if (proposal.source === "student") {
            if (Number(proposal.anonymous) === 1) {
                return "Anonymous Student";
            }

            return proposal.author_name || "Student";
        }

        if (proposal.source === "uc") {
            return proposal.author_name || "University of Coimbra";
        }

        if (proposal.source === "nuclei") {
            return (
                proposal.author_name ||
                proposal.organization ||
                "Student Organization"
            );
        }

        return proposal.author_name || "Community Member";
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
        const buttons = mainFilters.querySelectorAll(
            "[data-source]"
        );

        buttons.forEach(button => {
            const active =
                button.dataset.source === state.source;

            button.classList.toggle("active", active);

            button.setAttribute(
                "aria-pressed",
                String(active)
            );
        });

        clearFilters.disabled =
            state.source === "all" &&
            state.category === null;

        const config = getFilterConfig();

        filterTitle.textContent = config
            ? config.title
            : "Browse all approved proposals";

        if (!config) {
            secondaryFilters.replaceChildren(
                createElement(
                    "p",
                    "approved-filter-note",
                    "Select UC, Núcleos or Students to explore specific approved proposals."
                )
            );

            return;
        }

        const options = [
            {
                label: config.allLabel,
                value: null
            },
            ...config.options.map(option => ({
                label: option,
                value: option
            }))
        ];

        const filterButtons = options.map(option => {
            const active =
                state.category === option.value;

            const button = createElement(
                "button",
                "approved-filter-button" +
                    (active ? " active" : ""),
                option.label
            );

            button.type = "button";

            button.dataset.value =
                option.value ?? "";

            button.setAttribute(
                "aria-pressed",
                String(active)
            );

            return button;
        });

        secondaryFilters.replaceChildren(
            ...filterButtons
        );
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
                return (
                    proposal.organization === state.category
                );
            }

            return proposal.category === state.category;
        });

        return filtered.sort((a, b) => {
            const aDate = a.voting_deadline || "";
            const bDate = b.voting_deadline || "";

            if (aDate !== bDate) {
                return bDate.localeCompare(aDate);
            }

            return Number(b.id) - Number(a.id);
        });
    }

    function createVoteResult(
        label,
        votes,
        percentage,
        type
    ) {
        const row = createElement(
            "div",
            "approved-vote-row"
        );

        const labelContainer = createElement(
            "div",
            "approved-vote-label"
        );

        labelContainer.append(
            createElement(
                "span",
                "",
                `${label} (${votes})`
            ),
            createElement(
                "strong",
                "",
                `${percentage}%`
            )
        );

        const track = createElement(
            "div",
            "approved-vote-track"
        );

        const fill = createElement(
            "div",
            `approved-vote-fill ${type}`
        );

        fill.style.width = `${percentage}%`;

        track.append(fill);

        row.append(
            labelContainer,
            track
        );

        return row;
    }

    function createResultsElement(proposal) {
        const yes = Math.max(
            0,
            Number(proposal.yes_votes) || 0
        );

        const no = Math.max(
            0,
            Number(proposal.no_votes) || 0
        );

        const total = yes + no;

        const yesPercentage = total > 0
            ? Math.round((yes / total) * 100)
            : 0;

        const noPercentage = total > 0
            ? 100 - yesPercentage
            : 0;

        const wrapper = createElement(
            "div",
            "approved-vote-results"
        );

        wrapper.append(
            createElement(
                "h4",
                "",
                "Final voting results"
            )
        );

        wrapper.append(
            createVoteResult(
                "Yes",
                yes,
                yesPercentage,
                "yes"
            )
        );

        wrapper.append(
            createVoteResult(
                "No",
                no,
                noPercentage,
                "no"
            )
        );

        wrapper.append(
            createElement(
                "p",
                "approved-vote-total",
                `${total} total ${total === 1 ? "vote" : "votes"}`
            )
        );

        return wrapper;
    }

    function createApprovedCard(proposal) {
        const card = createElement(
            "article",
            "approved-card"
        );

        const top = createElement(
            "div",
            "approved-card-top"
        );

        const tags = createElement(
            "div",
            "approved-card-tags"
        );

        tags.append(
            createElement(
                "span",
                "approved-category",
                proposal.category || "Other"
            )
        );

        tags.append(
            createElement(
                "span",
                "approved-source",
                sourceLabels[proposal.source] || "Community"
            )
        );

        const badge = createElement(
            "span",
            "approved-badge"
        );

        badge.append(
            createElement(
                "span",
                "approved-badge-icon",
                "✓"
            ),
            createElement(
                "span",
                "",
                "Approved by vote"
            )
        );

        top.append(tags, badge);
        card.append(top);
        card.append(
            createElement(
                "h3",
                "",
                proposal.title || "Untitled proposal"
            )
        );

        const descriptionText =
            proposal.description || "";
        const description = createElement(
            "p",
            "approved-description",
            descriptionText
        );

        card.append(description);

        if (descriptionText.length > 260) {
            const readMore = createElement(
                "button",
                "approved-read-more",
                "Read full proposal"
            );

            readMore.type = "button";

            readMore.setAttribute(
                "aria-expanded",
                "false"
            );

            readMore.addEventListener("click", () => {
                const expanded =
                    description.classList.toggle("expanded");

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

        card.append(
            createElement(
                "p",
                "approved-author",
                `Proposed by ${getApprovedAuthor(proposal)}`
            )
        );

        card.append(
            createResultsElement(proposal)
        );

        const footer = createElement(
            "div",
            "approved-card-footer"
        );

        footer.append(
            createElement(
                "span",
                "",
                `Voting ended: ${formatApprovedDate(
                    proposal.voting_deadline
                )}`
            )
        );

        footer.append(
            createElement(
                "strong",
                "",
                "Community supported"
            )
        );

        card.append(footer);

        return card;
    }

    function renderProposals() {
        errorElement.hidden = true;
        emptyElement.hidden = true;

        if (state.loading) {
            grid.replaceChildren(
                createElement(
                    "div",
                    "approved-loading",
                    "Loading approved proposals..."
                )
            );

            resultsCount.textContent = "Loading...";

            return;
        }

        if (state.loadError) {
            grid.replaceChildren();

            resultsCount.textContent = "Unavailable";

            errorElement.textContent =
                "Something went wrong while loading approved proposals. Please refresh the page and try again.";

            errorElement.hidden = false;

            return;
        }

        const visibleProposals = getVisibleProposals();

        const count = visibleProposals.length;

        resultsCount.textContent =
            `${count} ${count === 1 ? "proposal" : "proposals"}`;

        grid.replaceChildren(
            ...visibleProposals.map(createApprovedCard)
        );

        if (count > 0) {
            return;
        }

        emptyElement.hidden = false;

        if (state.proposals.length === 0) {
            emptyTitle.textContent =
                "No approved proposals yet";

            emptyMessage.textContent =
                "There are no community-approved proposals yet. Check back after the first voting periods end.";

        } else {
            emptyTitle.textContent =
                "No approved proposals found";

            emptyMessage.textContent =
                "No approved proposals match your current filters. Try another category or clear your filters.";
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
        const button = event.target.closest(
            "[data-source]"
        );

        if (!button) {
            return;
        }

        setSource(button.dataset.source);
    });

    secondaryFilters.addEventListener("click", event => {
        const button = event.target.closest(
            ".approved-filter-button"
        );

        if (!button) {
            return;
        }

        state.category =
            button.dataset.value || null;

        renderAll();
    });

    clearFilters.addEventListener("click", () => {
        setSource("all");
    });

    async function loadApprovedProposals() {
        if (state.refreshing) {
            return;
        }

        state.refreshing = true;
        state.loading = true;
        state.loadError = false;

        renderProposals();

        try {
            const response = await fetch(
                "/api/proposals/approved",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to load approved proposals."
                );
            }

            const data = await response.json();

            state.proposals = Array.isArray(data.proposals)
                ? data.proposals
                : [];

            totalElement.textContent =
                String(state.proposals.length);

            const config = getFilterConfig();

            if (
                state.category !== null &&
                config &&
                !config.options.includes(state.category)
            ) {
                state.category = null;
            }

        } catch (error) {
            console.error(
                "Approved proposals loading error:",
                error
            );

            state.proposals = [];
            state.loadError = true;

            totalElement.textContent = "—";

        } finally {
            state.loading = false;
            state.refreshing = false;

            renderAll();
        }
    }

    renderAll();

    loadApprovedProposals();
    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                loadApprovedProposals();
            }
        }
    );

})();
