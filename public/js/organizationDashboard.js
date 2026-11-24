(() => {
    "use strict";

    const {
        $, el, text, setText, formatDate, getVotingState,
        getVoteTotals, countText, createVotingStatus,
        createResults, createCard, renderList, showContent,
        fetchJSON, handleDashboardError
    } = window.DashboardCommon;

    function createOutcome(proposal) {
        const state = getVotingState(proposal.voting_deadline);
        const { yes, no, total } = getVoteTotals(proposal);

        let label;
        let type = "neutral";

        if (state === "unknown") {
            label = "Deadline unavailable";
        } else if (state === "open") {
            label = "Voting in progress";
        } else if (!total) {
            label = "No votes received";
        } else if (yes > no) {
            label = "Supported by community";
            type = "positive";
        } else if (yes === no) {
            label = "No majority reached";
        } else {
            label = "Not supported by community";
            type = "negative";
        }

        return text(
            "span",
            label,
            `organization-proposal-outcome ${type}`
        );
    }

    function createProposalCard(proposal) {
        const state = getVotingState(proposal.voting_deadline);

        const card = createCard({
            title: String(proposal.title ?? ""),
            status: createVotingStatus(proposal.voting_deadline, "pending"),
            body: text("p", proposal.description, "dashboard-item-description"),
            meta: [
                `Category: ${proposal.category ?? "Other"}`,
                `Published: ${formatDate(proposal.created_at)}`,
                `Deadline: ${formatDate(proposal.voting_deadline)}`
            ]
        });

        const footerLabels = {
            open: "Voting is currently open",
            closed: "Voting period completed",
            unknown: "Voting period unavailable"
        };

        card.append(
            createResults(proposal),
            el("div", { className: "organization-proposal-footer" },
                text("span", footerLabels[state]),
                createOutcome(proposal)
            )
        );

        return card;
    }

    function renderStatistics(proposals) {
        let active = 0;
        let completed = 0;
        let yes = 0;
        let no = 0;

        proposals.forEach(proposal => {
            const state = getVotingState(proposal.voting_deadline);
            const totals = getVoteTotals(proposal);

            if (state === "open") active++;
            if (state === "closed") completed++;

            yes += totals.yes;
            no += totals.no;
        });

        const { total, yesPercent, noPercent } = getVoteTotals({
            yes_votes: yes,
            no_votes: no
        });

        setText("statTotal", proposals.length);
        setText("statActive", active);
        setText("statCompleted", completed);
        setText("statVotes", total);

        setText("totalYesVotes", yes);
        setText("totalNoVotes", no);
        setText("overallYesPercentage", `${yesPercent}%`);

        $("overallYesBar").style.width = `${yesPercent}%`;
        $("overallNoBar").style.width = `${noPercent}%`;

        setText(
            "participationDescription",
            total
                ? `Based on ${countText(total, "student vote")} across your published proposals.`
                : "No votes have been received yet."
        );
    }

    function renderProposals(proposals) {
        renderList(
            "organizationProposals",
            "proposalCount",
            proposals,
            "proposal",
            createProposalCard,
            [
                "No proposals yet",
                "Your organization's published proposals will appear here.",
                "📋"
            ]
        );
    }

    function renderOrganization(organization) {
        const name = organization.organization ||
            organization.name ||
            "Organization";

        setText("organizationName", name);

        setText(
            "organizationType",
            organization.role === "uc"
                ? "UNIVERSITY DASHBOARD"
                : "STUDENT ASSOCIATION DASHBOARD"
        );

        document.title = `${name} | Instant Democracy`;
    }

    async function loadDashboard() {
        try {
            const data = await fetchJSON("/api/organization/dashboard");

            const proposals = Array.isArray(data.proposals)
                ? data.proposals.filter(proposal => proposal.status === "approved")
                : [];

            renderOrganization(data.organization);
            renderStatistics(proposals);
            renderProposals(proposals);

            showContent();
        } catch (error) {
            handleDashboardError(
                error,
                "This dashboard is available to organizations only.",
                "Unable to load organization dashboard. Please refresh the page."
            );
        }
    }

    loadDashboard();
})();