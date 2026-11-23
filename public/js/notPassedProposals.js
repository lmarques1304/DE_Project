(() => {
    "use strict";

    const grid = document.getElementById("unsuccessfulGrid");

    const mainFilters = document.getElementById(
        "unsuccessfulMainFilters"
    );

    const filters = document.getElementById(
        "unsuccessfulFilters"
    );

    const filterTitle = document.getElementById(
        "unsuccessfulFilterTitle"
    );

    const clearFilters = document.getElementById(
        "clearUnsuccessfulFilters"
    );

    const totalElement = document.getElementById(
        "unsuccessfulTotal"
    );

    const resultsCount = document.getElementById(
        "unsuccessfulResultsCount"
    );

    const emptyElement = document.getElementById(
        "unsuccessfulEmpty"
    );

    const emptyTitle = document.getElementById(
        "unsuccessfulEmptyTitle"
    );

    const emptyMessage = document.getElementById(
        "unsuccessfulEmptyMessage"
    );

    const errorElement = document.getElementById(
        "unsuccessfulError"
    );

    if ([
        grid,
        mainFilters,
        filters,
        filterTitle,
        clearFilters,
        totalElement,
        resultsCount,
        emptyElement,
        emptyTitle,
        emptyMessage,
        errorElement
    ].some(element => !element)) {
        console.error(
            "Missing elements on the Unsuccessful Proposals page."
        );

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

    function element(tag, className = "", text = null) {
        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== null) {
            node.textContent = String(text);
        }

        return node;
    }

    function formatDate(value) {
        if (
            typeof value !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            return "Date unavailable";
        }

        const [year, month, day] = value
            .split("-")
            .map(Number);

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

    function getAuthor(proposal) {
        if (proposal.source === "student") {
            return Number(proposal.anonymous) === 1
                ? "Anonymous Student"
                : (proposal.author_name || "Student");
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

        const nuclei = state.source === "nuclei";

        const options = state.proposals
            .filter(proposal => proposal.source === state.source)
            .map(proposal =>
                nuclei
                    ? proposal.organization
                    : proposal.category
            )
            .filter(Boolean);

        return {
            title: nuclei
                ? "Select a Núcleo"
                : "Filter by topic",

            allLabel: nuclei
                ? "All Núcleos"
                : "All categories",

            options: [...new Set(options)].sort(
                (a, b) => a.localeCompare(b)
            )
        };
    }

    function renderFilters() {
        mainFilters
            .querySelectorAll("[data-source]")
            .forEach(button => {
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
            : "Browse all proposals";

        if (!config) {
            filters.replaceChildren(
                element(
                    "p",
                    "unsuccessful-filter-note",
                    "Choose UC, Núcleos or Students to narrow the results."
                )
            );

            return;
        }

        const options = [
            {
                label: config.allLabel,
                value: null
            },
            ...config.options.map(value => ({
                label: value,
                value
            }))
        ];

        filters.replaceChildren(
            ...options.map(option => {
                const active =
                    state.category === option.value;

                const button = element(
                    "button",
                    "unsuccessful-filter-button" +
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
            })
        );
    }

    function getVisibleProposals() {
        return state.proposals
            .filter(proposal => {
                if (
                    state.source !== "all" &&
                    proposal.source !== state.source
                ) {
                    return false;
                }

                if (!state.category) {
                    return true;
                }

                return state.source === "nuclei"
                    ? proposal.organization === state.category
                    : proposal.category === state.category;
            })
            .sort((a, b) => {
                const dateComparison =
                    (b.voting_deadline || "").localeCompare(
                        a.voting_deadline || ""
                    );

                return (
                    dateComparison ||
                    Number(b.id) - Number(a.id)
                );
            });
    }

    function createVoteRow(
        label,
        votes,
        percentage,
        type
    ) {
        const row = element(
            "div",
            "unsuccessful-vote-row"
        );

        const labelRow = element(
            "div",
            "unsuccessful-vote-label"
        );

        labelRow.append(
            element(
                "span",
                "",
                `${label} (${votes})`
            ),
            element(
                "strong",
                "",
                `${percentage}%`
            )
        );

        const track = element(
            "div",
            "unsuccessful-vote-track"
        );

        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", `${label} votes`);
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute(
            "aria-valuenow",
            String(percentage)
        );

        const fill = element(
            "div",
            `unsuccessful-vote-fill ${type}`
        );

        fill.style.width = `${percentage}%`;

        track.append(fill);

        row.append(labelRow, track);

        return row;
    }

    function createCard(proposal) {
        const card = element(
            "article",
            "unsuccessful-card"
        );

        const top = element(
            "div",
            "unsuccessful-card-top"
        );

        const tags = element(
            "div",
            "unsuccessful-card-tags"
        );

        tags.append(
            element(
                "span",
                "unsuccessful-category",
                proposal.category || "Other"
            ),
            element(
                "span",
                "unsuccessful-source",
                sourceLabels[proposal.source] || "Community"
            )
        );

        top.append(
            tags,
            element(
                "span",
                "unsuccessful-badge",
                "Not approved by vote"
            )
        );

        card.append(top);

        card.append(
            element(
                "h3",
                "",
                proposal.title || "Untitled proposal"
            )
        );

        const descriptionText =
            proposal.description || "";

        const description = element(
            "p",
            "unsuccessful-description",
            descriptionText
        );

        card.append(description);

        if (descriptionText.length > 260) {
            const readMore = element(
                "button",
                "unsuccessful-read-more",
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
            element(
                "p",
                "unsuccessful-author",
                `Proposed by ${getAuthor(proposal)}`
            )
        );

        const yes = Math.max(
            0,
            Number(proposal.yes_votes) || 0
        );

        const no = Math.max(
            0,
            Number(proposal.no_votes) || 0
        );

        const total = yes + no;

        const yesPercentage = total
            ? Math.round((yes / total) * 100)
            : 0;

        const noPercentage = total
            ? 100 - yesPercentage
            : 0;

        const reason = total === 0
            ? "No votes received"
            : yes === no
                ? "Tied vote — no majority"
                : "More No votes than Yes votes";

        card.append(
            element(
                "p",
                "unsuccessful-outcome",
                reason
            )
        );

        const results = element(
            "div",
            "unsuccessful-vote-results"
        );

        results.append(
            element(
                "h4",
                "",
                "Final voting results"
            ),

            createVoteRow(
                "Yes",
                yes,
                yesPercentage,
                "yes"
            ),

            createVoteRow(
                "No",
                no,
                noPercentage,
                "no"
            ),

            element(
                "p",
                "unsuccessful-vote-total",
                `${total} total ${total === 1 ? "vote" : "votes"}`
            )
        );

        card.append(results);

        const footer = element(
            "div",
            "unsuccessful-card-footer"
        );

        footer.append(
            element(
                "span",
                "",
                `Voting ended: ${formatDate(
                    proposal.voting_deadline
                )}`
            ),

            element(
                "strong",
                "",
                "Voting closed"
            )
        );

        card.append(footer);

        return card;
    }

    function renderProposals() {
        emptyElement.hidden = true;
        errorElement.hidden = true;

        if (state.loading) {
            grid.replaceChildren(
                element(
                    "p",
                    "unsuccessful-loading",
                    "Loading proposals..."
                )
            );

            resultsCount.textContent = "Loading...";

            return;
        }

        if (state.loadError) {
            grid.replaceChildren();

            resultsCount.textContent = "Unavailable";

            errorElement.textContent =
                "Unable to load proposals. Please refresh the page and try again.";

            errorElement.hidden = false;

            return;
        }

        const visible = getVisibleProposals();

        resultsCount.textContent =
            `${visible.length} ${
                visible.length === 1
                    ? "proposal"
                    : "proposals"
            }`;

        grid.replaceChildren(
            ...visible.map(createCard)
        );

        if (visible.length > 0) {
            return;
        }

        emptyElement.hidden = false;

        emptyTitle.textContent = state.proposals.length
            ? "No proposals match these filters"
            : "No unsuccessful proposals yet";

        emptyMessage.textContent = state.proposals.length
            ? "Try another source, category or Núcleo, or clear your filters."
            : "No published proposals have completed voting without majority support yet.";
    }

    function renderAll() {
        renderFilters();
        renderProposals();
    }

    function setSource(next) {
        if (
            !["all", "uc", "nuclei", "student"].includes(next)
        ) {
            return;
        }

        state.source = next;
        state.category = null;

        renderAll();
    }

    mainFilters.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-source]"
        );

        if (button) {
            setSource(button.dataset.source);
        }
    });

    filters.addEventListener("click", event => {
        const button = event.target.closest(
            ".unsuccessful-filter-button"
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

    async function loadProposals() {
        if (state.refreshing) {
            return;
        }

        state.refreshing = true;
        state.loading = true;
        state.loadError = false;

        renderProposals();

        try {
            const response = await fetch(
                "/api/proposals",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to load proposals."
                );
            }

            const data = await response.json();

            const published = Array.isArray(data.proposals)
                ? data.proposals
                : [];

            state.proposals = published.filter(proposal =>
                proposal.voting_result === "not_approved" &&
                proposal.voting_open === false &&
                Boolean(proposal.voting_deadline)
            );

            totalElement.textContent =
                String(state.proposals.length);

            const config = getFilterConfig();

            if (
                state.category &&
                config &&
                !config.options.includes(state.category)
            ) {
                state.category = null;
            }

        } catch (error) {
            console.error(
                "Unsuccessful proposals loading error:",
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

    loadProposals();

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                loadProposals();
            }
        }
    );

})();
