(() => {
    "use strict";

    const {
        $, el, text, setText, formatDate, getVotingState,
        categoryName, normalizeStatus, getVoteTotals,
        createStatus, createVotingStatus, createRejectionReason,
        createResults, createCard, emptyState, renderList,
        showContent, fetchJSON, handleDashboardError
    } = window.DashboardCommon;

    function createProposalCard(proposal) {
        const status = normalizeStatus(proposal.status);

        const meta = [
            `Category: ${categoryName(proposal.category)}`,
            `Submitted: ${formatDate(proposal.created_at)}`,
            Number(proposal.anonymous) === 1
                ? "Anonymous submission"
                : "Public author"
        ];

        if (proposal.voting_deadline) {
            meta.push(`Deadline: ${formatDate(proposal.voting_deadline)}`);
        }

        const card = createCard({
            title: String(proposal.title ?? ""),
            status: createStatus(status),
            body: text("p", proposal.description, "dashboard-item-description"),
            meta
        });

        if (status === "rejected" && proposal.rejection_reason) {
            card.append(createRejectionReason(proposal.rejection_reason));
        }

        if (status === "approved") {
            card.append(createResults(proposal));

            if (getVotingState(proposal.voting_deadline) === "closed") {
                const { yes, no } = getVoteTotals(proposal);
                const passed = yes > no;

                card.append(text(
                    "p",
                    `Community outcome: ${passed ? "Approved" : "Unsuccessful"}`,
                    `dashboard-outcome ${passed ? "positive" : "negative"}`
                ));
            }
        }

        return card;
    }

    function createDebateCard(debate) {
        const status = normalizeStatus(debate.status);
        const id = Number(debate.id);

        let title = text("h3", debate.title);

        if (status === "approved" && Number.isSafeInteger(id) && id > 0) {
            title = el("h3", {},
                el("a", {
                    className: "dashboard-item-title-link",
                    href: `debate.html?id=${id}`,
                    textContent: debate.title ?? ""
                })
            );
        }

        const card = createCard({
            title,
            status: createStatus(status),
            body: text("p", debate.description, "dashboard-item-description"),
            meta: [
                `Category: ${categoryName(debate.category)}`,
                `Created: ${formatDate(debate.createdAt || debate.created_at)}`
            ]
        });

        const reason = debate.rejectionReason || debate.rejection_reason;

        if (status === "rejected" && reason) {
            card.append(createRejectionReason(reason));
        }

        return card;
    }

    function createVoteCard(vote) {
        const voteLabel = vote.vote === "yes"
            ? "Yes"
            : vote.vote === "no" ? "No" : "Not available";

        const card = createCard({
            title: String(vote.title ?? ""),
            status: createVotingStatus(vote.voting_deadline),
            body: text("p", `Your vote: ${voteLabel}`, "dashboard-my-vote"),
            meta: [
                `Category: ${categoryName(vote.category)}`,
                `Voted: ${formatDate(vote.voted_at)}`,
                `Deadline: ${formatDate(vote.voting_deadline)}`
            ]
        });

        card.append(createResults(vote));

        return card;
    }

    function renderProposals(proposals) {
        renderList(
            "myProposals",
            "proposalCount",
            proposals,
            "proposal",
            createProposalCard,
            [
                "No proposals yet",
                "The proposals you create will appear here."
            ]
        );
    }

    function renderVotes(votes) {
        renderList(
            "myVotes",
            "voteCount",
            votes,
            "vote",
            createVoteCard,
            [
                "No votes yet",
                "Proposals you vote on will appear here."
            ]
        );
    }

    async function loadDebates() {
        const container = $("myDebates");

        container.replaceChildren(
            emptyState(
                "Loading debates...",
                "Checking your submitted discussions."
            )
        );

        try {
            const data = await fetchJSON("/api/debates/mine");

            renderList(
                "myDebates",
                "debateCount",
                Array.isArray(data.debates) ? data.debates : [],
                "debate",
                createDebateCard,
                [
                    "No debates yet",
                    "When you start a debate, you'll be able to follow its approval status here."
                ]
            );
        } catch (error) {
            console.error("My Debates error:", error);

            setText("debateCount", "Unavailable");

            container.replaceChildren(
                emptyState(
                    "Debates unavailable",
                    "Your proposals and votes are still available. Please try refreshing the page."
                )
            );
        }
    }

    function renderAccount(student, stats) {
        const firstName = String(student.name || "")
            .trim()
            .split(/\s+/)[0];

        setText(
            "dashboardWelcome",
            firstName ? `Welcome back, ${firstName}!` : "Welcome back!"
        );

        setText("accountEmail", student.email || "");
        setText("statTotalProposals", stats.total_proposals ?? 0);
        setText("statPending", stats.pending_proposals ?? 0);
        setText("statApproved", stats.approved_proposals ?? 0);
        setText("statVotes", stats.total_votes ?? 0);
    }

    async function loadDashboard() {
        try {
            const data = await fetchJSON("/api/student/dashboard");

            renderAccount(data.student || {}, data.stats || {});

            renderProposals(
                Array.isArray(data.proposals) ? data.proposals : []
            );

            renderVotes(
                Array.isArray(data.votes) ? data.votes : []
            );

            showContent();

            await loadDebates();
        } catch (error) {
            handleDashboardError(
                error,
                "This dashboard is available to students only.",
                "Unable to load your account. Please refresh the page."
            );
        }
    }

    loadDashboard();
})();