(() => {

    const recentDebates =
        document.getElementById("recentDebates");

    const recentVotingProposals =
        document.getElementById("recentVotingProposals");

    const recentApprovedProposals =
        document.getElementById("recentApprovedProposals");

    const recentNotPassedProposals =
        document.getElementById("recentNotPassedProposals");

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

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    let loading = false;

    function createElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function parseDate(value) {

        if (!value) {
            return null;
        }

        let normalized = String(value).trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {

            normalized += "T12:00:00Z";

        } else if (
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
                .test(normalized)
        ) {

            normalized =
                normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    function formatDate(value) {

        const date = parseDate(value);

        return date
            ? dateFormatter.format(date)
            : "";
    }

    function getTimestamp(value) {

        return parseDate(value)?.getTime() || 0;
    }

    function truncateText(value, limit = 140) {

        const text = String(value || "")
            .replace(/\s+/g, " ")
            .trim();

        if (text.length <= limit) {
            return text;
        }

        const shortened = text.slice(0, limit);

        const lastSpace = shortened.lastIndexOf(" ");

        return (
            lastSpace > limit * 0.7
                ? shortened.slice(0, lastSpace)
                : shortened
        ) + "…";
    }

    function sortByCreation(items) {

        return [...items].sort((a, b) => {

            const dateA = getTimestamp(
                a.createdAt || a.created_at
            );

            const dateB = getTimestamp(
                b.createdAt || b.created_at
            );

            return dateB - dateA ||
                Number(b.id) - Number(a.id);
        });
    }

    function sortByDeadline(items) {

        return [...items].sort((a, b) => {

            const dateA = getTimestamp(
                a.voting_deadline
            );

            const dateB = getTimestamp(
                b.voting_deadline
            );

            return dateB - dateA ||
                Number(b.id) - Number(a.id);
        });
    }

    async function fetchData(url) {

        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Unable to load ${url}: ${response.status}`
            );
        }

        return response.json();
    }

    function createRecentCard({
        title,
        description,
        label,
        type,
        metadata,
        href
    }) {

        const card = createElement(
            "a",
            "recent-card"
        );

        card.href = href;
        card.style.overflowWrap = "anywhere";

        const status = createElement(
            "span",
            `status-label status-label--${type}`,
            label
        );

        const heading = createElement(
            "h3",
            "",
            title
        );

        const preview = createElement(
            "p",
            "",
            truncateText(description)
        );

        const meta = createElement(
            "div",
            "recent-card-meta",
            metadata
        );

        card.append(
            status,
            heading,
            preview,
            meta
        );

        return card;
    }

    function createDebateCard(debate) {

        const category =
            debateCategories[debate.category] ||
            debate.category ||
            "Debate";

        const comments =
            Number(debate.commentCount) || 0;

        const commentText =
            comments === 1
                ? "1 comment"
                : `${comments} comments`;

        const metadata = [
            formatDate(debate.createdAt),
            commentText
        ].filter(Boolean).join(" · ");

        return createRecentCard({
            title: debate.title,
            description: debate.description,
            label: category,
            type: "debate",
            metadata,
            href: `debate.html?id=${encodeURIComponent(debate.id)}`
        });
    }

    function getProposalSource(proposal) {

        if (proposal.source === "uc") {
            return "UC";
        }

        if (proposal.source === "nuclei") {
            return proposal.organization || "Núcleos";
        }

        if (proposal.source === "student") {
            return "Student";
        }

        return proposal.category || "Proposal";
    }

    function createVotingCard(proposal) {

        const deadline = formatDate(
            proposal.voting_deadline
        );

        const metadata = [
            getProposalSource(proposal),
            deadline ? `Ends ${deadline}` : ""
        ].filter(Boolean).join(" · ");

        return createRecentCard({
            title: proposal.title,
            description: proposal.description,
            label: "Open for voting",
            type: "voting",
            metadata,
            href: "vote.html"
        });
    }

    function getVoteMetadata(proposal) {

        const yesVotes =
            Number(proposal.yes_votes) || 0;

        const noVotes =
            Number(proposal.no_votes) || 0;

        const totalVotes = yesVotes + noVotes;

        const deadline = formatDate(
            proposal.voting_deadline
        );

        const voteText =
            totalVotes === 1
                ? "1 vote"
                : `${totalVotes} votes`;

        return [
            deadline ? `Closed ${deadline}` : "",
            voteText
        ].filter(Boolean).join(" · ");
    }

    function createApprovedCard(proposal) {

        return createRecentCard({
            title: proposal.title,
            description: proposal.description,
            label: "Approved",
            type: "approved",
            metadata: getVoteMetadata(proposal),
            href: "approvedProposals.html"
        });
    }

    function createNotPassedCard(proposal) {

        return createRecentCard({
            title: proposal.title,
            description: proposal.description,
            label: "Unsuccessful",
            type: "not-passed",
            metadata: getVoteMetadata(proposal),
            href: "notPassedProposals.html"
        });
    }

    function renderCards(container, items, cardBuilder) {

        if (!container) {
            return;
        }

        container.replaceChildren();

        const recentItems = items.slice(0, 3);

        if (recentItems.length === 0) {

            container.hidden = true;

            return;
        }

        container.append(
            ...recentItems.map(cardBuilder)
        );

        container.hidden = false;
    }

    function renderError(container, message) {

        if (!container) {
            return;
        }

        const error = createElement(
            "div",
            "empty-state"
        );

        error.append(
            createElement("p", "", message)
        );

        container.replaceChildren(error);

        container.hidden = false;
    }

    async function loadRecentDebates() {

        try {

            const data = await fetchData(
                "/api/debates?sort=recent&limit=3"
            );

            if (!Array.isArray(data.debates)) {

                throw new Error(
                    "Invalid debates response."
                );
            }

            renderCards(
                recentDebates,
                sortByCreation(data.debates),
                createDebateCard
            );

        } catch (error) {

            console.error(
                "Error loading recent debates:",
                error
            );

            renderError(
                recentDebates,
                "Unable to load recent debates."
            );
        }
    }

    async function loadRecentProposals() {

        try {

            const data = await fetchData(
                "/api/proposals"
            );

            if (!Array.isArray(data.proposals)) {

                throw new Error(
                    "Invalid proposals response."
                );
            }

            const proposals = data.proposals;

            const votingProposals = proposals.filter(
                proposal =>
                    proposal.voting_open === true &&
                    proposal.voting_result === "ongoing"
            );

            const approvedProposals = proposals.filter(
                proposal =>
                    proposal.voting_open === false &&
                    proposal.voting_deadline &&
                    proposal.voting_result === "approved"
            );

            const notPassedProposals = proposals.filter(
                proposal =>
                    proposal.voting_open === false &&
                    proposal.voting_deadline &&
                    proposal.voting_result === "not_approved"
            );

            renderCards(
                recentVotingProposals,
                sortByCreation(votingProposals),
                createVotingCard
            );

            renderCards(
                recentApprovedProposals,
                sortByDeadline(approvedProposals),
                createApprovedCard
            );

            renderCards(
                recentNotPassedProposals,
                sortByDeadline(notPassedProposals),
                createNotPassedCard
            );

        } catch (error) {

            console.error(
                "Error loading recent proposals:",
                error
            );

            renderError(
                recentVotingProposals,
                "Unable to load voting proposals."
            );

            renderError(
                recentApprovedProposals,
                "Unable to load approved proposals."
            );

            renderError(
                recentNotPassedProposals,
                "Unable to load unsuccessful proposals."
            );
        }
    }

    async function loadHomeActivity() {

        if (loading) {
            return;
        }

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

    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.visibilityState === "visible") {
                loadHomeActivity();
            }
        }
    );

    window.addEventListener("pageshow", event => {

        if (event.persisted) {
            loadHomeActivity();
        }
    });

    loadHomeActivity();

})();