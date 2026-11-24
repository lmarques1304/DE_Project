(() => {
    const $ = id => document.getElementById(id);

    const debateCategories = {
        "academic-life": "Academic Life",
        "campus-mobility": "Campus Mobility",
        "canteens-and-food": "Canteens and Food",
        "events-and-traditions": "Events and Traditions",
        "sports-and-culture": "Sports and Culture",
        "student-well-being": "Student Well-Being",
        "study-spaces": "Study Spaces",
        "workshops-and-skills": "Workshops and Skills"
    };

    const proposalSections = [
        {
            id: "recentVotingProposals",
            result: "ongoing",
            label: "Open for voting",
            type: "voting",
            href: "vote.html",
            error: "Unable to load voting proposals."
        },
        {
            id: "recentApprovedProposals",
            result: "approved",
            label: "Approved",
            type: "approved",
            href: "approvedProposals.html",
            error: "Unable to load approved proposals."
        },
        {
            id: "recentNotPassedProposals",
            result: "not_approved",
            label: "Unsuccessful",
            type: "not-passed",
            href: "notPassedProposals.html",
            error: "Unable to load unsuccessful proposals."
        }
    ];

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    let loading = false;

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function parseDate(value) {
        if (!value) return null;

        let normalized = String(value).trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            normalized += "T12:00:00Z";
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseDate(value);
        return date ? dateFormatter.format(date) : "";
    }

    function getTimestamp(value) {
        return parseDate(value)?.getTime() || 0;
    }

    function truncateText(value, limit = 140) {
        const text = String(value || "").replace(/\s+/g, " ").trim();

        if (text.length <= limit) return text;

        const shortened = text.slice(0, limit);
        const lastSpace = shortened.lastIndexOf(" ");

        return (lastSpace > limit * 0.7
            ? shortened.slice(0, lastSpace)
            : shortened) + "…";
    }

    const getCreationDate = item => item.createdAt || item.created_at;
    const getDeadline = item => item.voting_deadline;

    function sortRecent(items, getDate = getCreationDate) {
        return [...items].sort((a, b) =>
            getTimestamp(getDate(b)) - getTimestamp(getDate(a)) ||
            Number(b.id) - Number(a.id)
        );
    }

    function countText(value, singular) {
        const count = Number(value) || 0;
        return `${count} ${singular}${count === 1 ? "" : "s"}`;
    }

    function joinMetadata(...items) {
        return items.filter(Boolean).join(" · ");
    }

    async function fetchData(url) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Unable to load ${url}: ${response.status}`);
        }

        return response.json();
    }

    function createRecentCard(item, { label, type, metadata, href }) {
        const card = createElement("a", "recent-card");
        card.href = href;

        card.append(
            createElement("span", `status-label status-label--${type}`, label),
            createElement("h3", "", item.title),
            createElement("p", "", truncateText(item.description)),
            createElement("div", "recent-card-meta", metadata)
        );

        return card;
    }

    function createDebateCard(debate) {
        return createRecentCard(debate, {
            label: debateCategories[debate.category] || debate.category || "Debate",
            type: "debate",
            metadata: joinMetadata(
                formatDate(debate.createdAt),
                countText(debate.commentCount, "comment")
            ),
            href: `debate.html?id=${encodeURIComponent(debate.id)}`
        });
    }

    function getProposalSource(proposal) {
        switch (proposal.source) {
            case "uc": return "UC";
            case "nuclei": return proposal.organization || "Núcleos";
            case "student": return "Student";
            default: return proposal.category || "Proposal";
        }
    }

    function createProposalCard(proposal, section) {
        const deadline = formatDate(proposal.voting_deadline);
        const totalVotes = (Number(proposal.yes_votes) || 0) +
            (Number(proposal.no_votes) || 0);

        const metadata = section.result === "ongoing"
            ? joinMetadata(
                getProposalSource(proposal),
                deadline ? `Ends ${deadline}` : ""
            )
            : joinMetadata(
                deadline ? `Closed ${deadline}` : "",
                countText(totalVotes, "vote")
            );

        return createRecentCard(proposal, {
            label: section.label,
            type: section.type,
            metadata,
            href: section.href
        });
    }

    function renderCards(id, items, cardBuilder) {
        const container = $(id);
        if (!container) return;

        container.replaceChildren(...items.slice(0, 3).map(cardBuilder));
        container.hidden = items.length === 0;
    }

    function renderError(id, message) {
        const container = $(id);
        if (!container) return;

        const error = createElement("div", "empty-state");
        error.append(createElement("p", "", message));

        container.replaceChildren(error);
        container.hidden = false;
    }

    async function loadRecentDebates() {
        try {
            const data = await fetchData("/api/debates?sort=recent&limit=3");

            if (!Array.isArray(data.debates)) {
                throw new Error("Invalid debates response.");
            }

            renderCards("recentDebates", sortRecent(data.debates), createDebateCard);
        } catch (error) {
            console.error("Error loading recent debates:", error);
            renderError("recentDebates", "Unable to load recent debates.");
        }
    }

    async function loadRecentProposals() {
        try {
            const data = await fetchData("/api/proposals");

            if (!Array.isArray(data.proposals)) {
                throw new Error("Invalid proposals response.");
            }

            proposalSections.forEach(section => {
                const isOpen = section.result === "ongoing";

                const proposals = data.proposals.filter(proposal =>
                    proposal.voting_result === section.result &&
                    proposal.voting_open === isOpen &&
                    (isOpen || proposal.voting_deadline)
                );

                const sorted = sortRecent(
                    proposals,
                    isOpen ? getCreationDate : getDeadline
                );

                renderCards(section.id, sorted, proposal =>
                    createProposalCard(proposal, section)
                );
            });
        } catch (error) {
            console.error("Error loading recent proposals:", error);

            proposalSections.forEach(section =>
                renderError(section.id, section.error)
            );
        }
    }

    async function loadHomeActivity() {
        if (loading) return;

        loading = true;

        try {
            await Promise.all([
                loadRecentDebates(),
                loadRecentProposals()
            ]);
        } finally {
            loading = false;
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") loadHomeActivity();
    });

    window.addEventListener("pageshow", event => {
        if (event.persisted) loadHomeActivity();
    });

    loadHomeActivity();
})();