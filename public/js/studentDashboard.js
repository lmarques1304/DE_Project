(() => {
    const $ = id => document.getElementById(id);

    const message = $("dashboardMessage");
    const content = $("dashboardContent");

    if (!message || !content) return;

    function el(tag, props = {}, ...children) {
        const node = Object.assign(
            document.createElement(tag),
            props
        );

        node.append(...children);
        return node;
    }

    function formatDate(value) {
        if (!value) return "Not available";

        const datePart = value.slice(0, 10);
        const date = new Date(`${datePart}T12:00:00Z`);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function getPortugalToday() {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const get = type =>
            parts.find(part => part.type === type).value;

        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function isVotingClosed(deadline) {
        return Boolean(deadline) &&
            getPortugalToday() > deadline;
    }

    function capitalize(value) {
        if (!value) return "";

        return value.charAt(0).toUpperCase() +
            value.slice(1);
    }

    function showError(text) {
        message.hidden = false;
        message.textContent = text;
        content.hidden = true;
    }

    function createResults(item) {
        const yes = Number(item.yes_votes) || 0;
        const no = Number(item.no_votes) || 0;
        const total = yes + no;

        const yesPercent = total
            ? Math.round((yes / total) * 100)
            : 0;

        const noPercent = total
            ? 100 - yesPercent
            : 0;

        const wrapper = el("div", {
            className: "dashboard-results"
        });

        wrapper.append(
            el(
                "div",
                { className: "dashboard-results-heading" },
                el("span", {
                    textContent: "Voting Results"
                }),
                el("span", {
                    textContent:
                        `${total} ${total === 1 ? "vote" : "votes"}`
                })
            )
        );

        [
            ["Yes", yes, yesPercent, "yes"],
            ["No", no, noPercent, "no"]
        ].forEach(([label, count, percent, type]) => {
            const row = el("div", {
                className: "dashboard-result-row"
            });

            row.append(
                el(
                    "div",
                    { className: "dashboard-result-label" },
                    el("span", { textContent: label }),
                    el("span", {
                        textContent: `${count} (${percent}%)`
                    })
                )
            );

            const track = el("div", {
                className: "dashboard-progress-track"
            });

            const fill = el("div", {
                className: `dashboard-progress-fill ${type}`
            });

            fill.style.width = `${percent}%`;

            track.append(fill);
            row.append(track);
            wrapper.append(row);
        });

        return wrapper;
    }

    function createProposalCard(proposal) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const status = proposal.status || "pending";

        const top = el(
            "div",
            { className: "dashboard-item-top" },

            el("h3", {
                textContent: proposal.title
            }),

            el("span", {
                className: `dashboard-status ${status}`,
                textContent: capitalize(status)
            })
        );

        card.append(top);

        card.append(
            el("p", {
                className: "dashboard-item-description",
                textContent: proposal.description
            })
        );

        const meta = el("div", {
            className: "dashboard-item-meta"
        });

        meta.append(
            el("span", {
                textContent: `Category: ${proposal.category}`
            }),

            el("span", {
                textContent:
                    `Submitted: ${formatDate(proposal.created_at)}`
            }),

            el("span", {
                textContent: Number(proposal.anonymous) === 1
                    ? "Anonymous proposal"
                    : "Public author"
            })
        );

        if (proposal.voting_deadline) {
            meta.append(
                el("span", {
                    textContent:
                        `Deadline: ${formatDate(
                            proposal.voting_deadline
                        )}`
                })
            );
        }

        card.append(meta);

        if (status === "approved") {
            if (isVotingClosed(proposal.voting_deadline)) {
                card.append(
                    el("p", {
                        className: "dashboard-my-vote",
                        textContent: "Voting closed"
                    })
                );
            }

            card.append(createResults(proposal));
        }

        return card;
    }

    function renderProposals(proposals) {
        const container = $("myProposals");

        $("proposalCount").textContent =
            `${proposals.length} ${
                proposals.length === 1
                    ? "proposal"
                    : "proposals"
            }`;

        if (proposals.length === 0) {
            container.replaceChildren(
                el(
                    "div",
                    { className: "dashboard-empty" },
                    el("h3", {
                        textContent: "No proposals yet"
                    }),
                    el("p", {
                        textContent:
                            "Your submitted proposals will appear here."
                    })
                )
            );
            return;
        }

        container.replaceChildren(
            ...proposals.map(createProposalCard)
        );
    }

    function createVoteCard(vote) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const closed = isVotingClosed(
            vote.voting_deadline
        );

        const top = el(
            "div",
            { className: "dashboard-item-top" },

            el("h3", {
                textContent: vote.title
            }),

            el("span", {
                className:
                    `dashboard-status ${
                        closed ? "closed" : "approved"
                    }`,
                textContent:
                    closed ? "Voting closed" : "Voting open"
            })
        );

        card.append(top);

        card.append(
            el("p", {
                className: "dashboard-my-vote",
                textContent:
                    `Your vote: ${
                        vote.vote === "yes" ? "Yes" : "No"
                    }`
            })
        );

        const meta = el("div", {
            className: "dashboard-item-meta"
        });

        meta.append(
            el("span", {
                textContent: `Category: ${vote.category}`
            }),

            el("span", {
                textContent:
                    `Voted: ${formatDate(vote.voted_at)}`
            }),

            el("span", {
                textContent:
                    `Deadline: ${formatDate(
                        vote.voting_deadline
                    )}`
            })
        );

        card.append(meta);
        card.append(createResults(vote));

        return card;
    }

    function renderVotes(votes) {
        const container = $("myVotes");

        $("voteCount").textContent =
            `${votes.length} ${
                votes.length === 1 ? "vote" : "votes"
            }`;

        if (votes.length === 0) {
            container.replaceChildren(
                el(
                    "div",
                    { className: "dashboard-empty" },
                    el("h3", {
                        textContent: "No votes yet"
                    }),
                    el("p", {
                        textContent:
                            "Proposals you vote on will appear here."
                    })
                )
            );
            return;
        }

        container.replaceChildren(
            ...votes.map(createVoteCard)
        );
    }

    async function loadDashboard() {
        try {
            const response = await fetch(
                "/api/student/dashboard",
                {
                    credentials: "same-origin"
                }
            );

            if (response.status === 401) {
                window.location.replace("login.html");
                return;
            }

            if (response.status === 403) {
                showError(
                    "This dashboard is available to students only."
                );
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to load your dashboard."
                );
            }

            const data = await response.json();

            const student = data.student;
            const stats = data.stats;
            const proposals = data.proposals || [];
            const votes = data.votes || [];

            const firstName =
                student.name.trim().split(/\s+/)[0];

            $("dashboardWelcome").textContent =
                `Welcome back, ${firstName}!`;

            $("statTotalProposals").textContent =
                stats.total_proposals;

            $("statPending").textContent =
                stats.pending_proposals;

            $("statApproved").textContent =
                stats.approved_proposals;

            $("statVotes").textContent =
                stats.total_votes;

            renderProposals(proposals);
            renderVotes(votes);

            message.hidden = true;
            content.hidden = false;

        } catch (error) {
            console.error(
                "Student dashboard error:",
                error
            );

            showError(
                "Unable to load your dashboard. Please refresh the page."
            );
        }
    }

    loadDashboard();
})();