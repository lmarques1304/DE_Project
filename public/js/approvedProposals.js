const approvedGrid = document.getElementById("approvedGrid");
const approvedFilters = document.getElementById("approvedFilters");
const approvedTotal = document.getElementById("approvedTotal");
const approvedResultsCount = document.getElementById("approvedResultsCount");

const approvedEmpty = document.getElementById("approvedEmpty");
const approvedEmptyMessage = document.getElementById("approvedEmptyMessage");
const approvedError = document.getElementById("approvedError");

const clearApprovedFilters = document.getElementById(
    "clearApprovedFilters"
);

let allApprovedProposals = [];
let activeApprovedCategory = "All";

function formatApprovedDate(value) {
    if (!value) {
        return "Date unavailable";
    }

    const date = new Date(`${value}T12:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function getApprovedAuthor(proposal) {
    if (proposal.source === "student") {
        if (proposal.anonymous) {
            return "Anonymous student";
        }

        return proposal.author_name || "Student";
    }

    if (proposal.source === "uc") {
        return proposal.author_name || "University of Coimbra";
    }

    if (proposal.source === "nuclei") {
        return proposal.author_name || "Student Association";
    }

    return proposal.author_name || "Community member";
}

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

function renderApprovedFilters() {
    approvedFilters.replaceChildren();

    const categories = [
        "All",
        ...new Set(
            allApprovedProposals.map(proposal => proposal.category)
        )
    ];

    categories.forEach(category => {
        const button = createElement(
            "button",
            "approved-filter-button",
            category
        );

        button.type = "button";

        const isActive = category === activeApprovedCategory;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));

        button.addEventListener("click", () => {
            activeApprovedCategory = category;

            renderApprovedFilters();
            renderApprovedProposals();
        });

        approvedFilters.appendChild(button);
    });
}

function createVoteResult(label, votes, percentage, type) {
    const row = createElement("div", "approved-vote-row");

    const labelContainer = createElement(
        "div",
        "approved-vote-label"
    );

    labelContainer.appendChild(
        createElement("span", "", `${label} (${votes})`)
    );

    labelContainer.appendChild(
        createElement("strong", "", `${percentage}%`)
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

    track.appendChild(fill);

    row.appendChild(labelContainer);
    row.appendChild(track);

    return row;
}

function createApprovedCard(proposal) {
    const card = createElement("article", "approved-card");

    const top = createElement("div", "approved-card-top");

    const category = createElement(
        "span",
        "approved-category",
        proposal.category
    );

    const badge = createElement(
        "span",
        "approved-badge"
    );

    badge.appendChild(
        createElement("span", "approved-badge-icon", "✓")
    );

    badge.appendChild(
        createElement("span", "", "Approved by vote")
    );

    top.appendChild(category);
    top.appendChild(badge);

    const title = createElement(
        "h3",
        "",
        proposal.title
    );

    const description = createElement(
        "p",
        "approved-description",
        proposal.description
    );

    const author = createElement(
        "p",
        "approved-author",
        `Proposed by ${getApprovedAuthor(proposal)}`
    );

    const results = createElement(
        "div",
        "approved-vote-results"
    );

    results.appendChild(
        createElement("h4", "", "Final voting results")
    );

    const yesVotes = Number(proposal.yes_votes) || 0;
    const noVotes = Number(proposal.no_votes) || 0;

    const totalVotes = yesVotes + noVotes;

    const yesPercentage = totalVotes > 0
        ? Math.round((yesVotes / totalVotes) * 100)
        : 0;

    const noPercentage = totalVotes > 0
        ? Math.round((noVotes / totalVotes) * 100)
        : 0;

    results.appendChild(
        createVoteResult(
            "Yes",
            yesVotes,
            yesPercentage,
            "yes"
        )
    );

    results.appendChild(
        createVoteResult(
            "No",
            noVotes,
            noPercentage,
            "no"
        )
    );

    results.appendChild(
        createElement(
            "p",
            "approved-vote-total",
            `${totalVotes} total vote${totalVotes === 1 ? "" : "s"}`
        )
    );

    const footer = createElement(
        "div",
        "approved-card-footer"
    );

    footer.appendChild(
        createElement(
            "span",
            "",
            `Voting ended: ${formatApprovedDate(proposal.voting_deadline)}`
        )
    );

    footer.appendChild(
        createElement(
            "strong",
            "",
            "Community supported"
        )
    );

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(author);
    card.appendChild(results);
    card.appendChild(footer);

    return card;
}

function renderApprovedProposals() {
    approvedGrid.replaceChildren();

    const filtered = activeApprovedCategory === "All"
        ? allApprovedProposals
        : allApprovedProposals.filter(
            proposal => proposal.category === activeApprovedCategory
        );

    approvedResultsCount.textContent =
        `${filtered.length} proposal${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
        approvedEmpty.hidden = false;

        approvedEmptyMessage.textContent =
            allApprovedProposals.length === 0
                ? "There are no community-approved proposals yet. Check back after the first voting periods end."
                : "No approved proposals match this category. Try another filter.";

        return;
    }

    approvedEmpty.hidden = true;

    filtered.forEach(proposal => {
        approvedGrid.appendChild(
            createApprovedCard(proposal)
        );
    });
}

async function loadApprovedProposals() {
    approvedError.hidden = true;

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

        allApprovedProposals = Array.isArray(data.proposals)
            ? data.proposals
            : [];

        approvedTotal.textContent =
            allApprovedProposals.length;

        renderApprovedFilters();
        renderApprovedProposals();

    } catch (error) {
        console.error(error);

        approvedGrid.replaceChildren();
        approvedEmpty.hidden = true;

        approvedError.textContent =
            "Something went wrong while loading approved proposals. Please try again.";

        approvedError.hidden = false;
    }
}

clearApprovedFilters.addEventListener("click", () => {
    activeApprovedCategory = "All";

    renderApprovedFilters();
    renderApprovedProposals();
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        loadApprovedProposals();
    }
});

loadApprovedProposals();