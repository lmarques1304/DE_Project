
/* =========================================================
   STUDENT DASHBOARD
   - My Proposals
   - My Debates
   - My Votes
   ========================================================= */

(() => {
    const $ = id => document.getElementById(id);

    const message = $("dashboardMessage");
    const content = $("dashboardContent");

    if (!message || !content) return;

    const CATEGORIES = {
        "academic-life": "Academic Life",
        "canteens-and-food": "Canteens and Food",
        "campus-mobility": "Campus Mobility",
        "events-and-traditions": "Events and Traditions",
        "sports-and-culture": "Sports and Culture",
        "student-well-being": "Student Well-Being",
        "study-spaces": "Study Spaces",
        "workshops-and-skills": "Workshops and Skills"
    };

    function el(tag, props = {}, ...children) {
        const node = Object.assign(
            document.createElement(tag),
            props
        );

        node.append(...children);
        return node;
    }

    function setText(id, value) {
        const node = $(id);

        if (node) {
            node.textContent = value ?? "";
        }
    }

    function formatDate(value) {
        if (!value) return "Not available";

        const datePart = String(value).slice(0, 10);
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

    function categoryName(value) {
        return CATEGORIES[value] || value || "Other";
    }

    function normalizeStatus(value) {
        return ["pending", "approved", "rejected"].includes(value)
            ? value
            : "pending";
    }

    function statusLabel(status) {
        if (status === "approved") return "Published";
        if (status === "rejected") return "Rejected";

        return "Pending Review";
    }

    function showError(text) {
        message.hidden = false;
        message.textContent = text;
        content.hidden = true;
    }

    function emptyState(title, description) {
        return el(
            "div",
            { className: "dashboard-empty" },

            el("h3", { textContent: title }),
            el("p", { textContent: description })
        );
    }

    function createStatus(status) {
        const normalized = normalizeStatus(status);

        return el("span", {
            className: `dashboard-status ${normalized}`,
            textContent: statusLabel(normalized)
        });
    }

    function createRejectionReason(reason) {
        if (!reason) return null;

        return el(
            "div",
            { className: "dashboard-rejection-reason" },

            el("strong", {
                textContent: "Reason for rejection"
            }),

            el("p", {
                textContent: reason
            })
        );
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

            const heading = el(
                "div",
                { className: "dashboard-result-label" },

                el("span", { textContent: label }),

                el("span", {
                    textContent: `${count} (${percent}%)`
                })
            );

            const track = el("div", {
                className: "dashboard-progress-track"
            });

            const fill = el("div", {
                className: `dashboard-progress-fill ${type}`
            });

            fill.style.width = `${percent}%`;

            track.append(fill);
            row.append(heading, track);
            wrapper.append(row);
        });

        return wrapper;
    }

    function createProposalCard(proposal) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const status = normalizeStatus(proposal.status);

        card.append(
            el(
                "div",
                { className: "dashboard-item-top" },

                el("h3", {
                    textContent: proposal.title
                }),

                createStatus(status)
            ),

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
                textContent:
                    `Category: ${categoryName(proposal.category)}`
            }),

            el("span", {
                textContent:
                    `Submitted: ${formatDate(proposal.created_at)}`
            }),

            el("span", {
                textContent:
                    Number(proposal.anonymous) === 1
                        ? "Anonymous submission"
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

        if (status === "rejected") {
            const reason = createRejectionReason(
                proposal.rejection_reason
            );

            if (reason) card.append(reason);
        }

        if (status === "approved") {
            card.append(createResults(proposal));

            if (isVotingClosed(proposal.voting_deadline)) {
                const yes = Number(proposal.yes_votes) || 0;
                const no = Number(proposal.no_votes) || 0;

                const passed = yes > no;

                card.append(
                    el("p", {
                        className:
                            `dashboard-outcome ${
                                passed ? "positive" : "negative"
                            }`,

                        textContent: passed
                            ? "Community outcome: Approved"
                            : "Community outcome: Unsuccessful"
                    })
                );
            }
        }

        return card;
    }

    function renderProposals(proposals) {
        const container = $("myProposals");

        setText(
            "proposalCount",
            `${proposals.length} ${
                proposals.length === 1
                    ? "proposal"
                    : "proposals"
            }`
        );

        if (proposals.length === 0) {
            container.replaceChildren(
                emptyState(
                    "No proposals yet",
                    "The proposals you create will appear here."
                )
            );

            return;
        }

        container.replaceChildren(
            ...proposals.map(createProposalCard)
        );
    }

    function createDebateCard(debate) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const status = normalizeStatus(debate.status);
        const id = Number(debate.id);

        let title;

        if (
            status === "approved" &&
            Number.isSafeInteger(id) &&
            id > 0
        ) {
            title = el(
                "h3",
                {},

                el("a", {
                    className: "dashboard-item-title-link",
                    href: `debate.html?id=${id}`,
                    textContent: debate.title
                })
            );
        } else {
            title = el("h3", {
                textContent: debate.title
            });
        }

        card.append(
            el(
                "div",
                { className: "dashboard-item-top" },

                title,
                createStatus(status)
            ),

            el("p", {
                className: "dashboard-item-description",
                textContent: debate.description
            })
        );

        const meta = el("div", {
            className: "dashboard-item-meta"
        });

        meta.append(
            el("span", {
                textContent:
                    `Category: ${categoryName(debate.category)}`
            }),

            el("span", {
                textContent:
                    `Created: ${formatDate(
                        debate.createdAt || debate.created_at
                    )}`
            })
        );

        card.append(meta);

        if (status === "rejected") {
            const reason = createRejectionReason(
                debate.rejectionReason ||
                debate.rejection_reason
            );

            if (reason) card.append(reason);
        }

        return card;
    }

    function renderDebates(debates) {
        const container = $("myDebates");

        if (!container) return;

        setText(
            "debateCount",
            `${debates.length} ${
                debates.length === 1 ? "debate" : "debates"
            }`
        );

        if (debates.length === 0) {
            container.replaceChildren(
                emptyState(
                    "No debates yet",
                    "When you start a debate, you'll be able " +
                    "to follow its approval status here."
                )
            );

            return;
        }

        container.replaceChildren(
            ...debates.map(createDebateCard)
        );
    }

    async function loadDebates() {
        const container = $("myDebates");

        if (!container) return;

        container.replaceChildren(
            emptyState(
                "Loading debates...",
                "Checking your submitted discussions."
            )
        );

        try {
            const response = await fetch("/api/debates/mine", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Unable to load your debates.");
            }

            const data = await response.json();

            renderDebates(
                Array.isArray(data.debates) ? data.debates : []
            );

        } catch (error) {
            console.error("My Debates error:", error);

            container.replaceChildren(
                emptyState(
                    "Debates unavailable",
                    "Your proposals and votes are still available. " +
                    "Please try refreshing the page."
                )
            );
        }
    }

    function createVoteCard(vote) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const closed = isVotingClosed(
            vote.voting_deadline
        );

        card.append(
            el(
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

                    textContent: closed
                        ? "Voting Closed"
                        : "Voting Open"
                })
            ),

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
                textContent:
                    `Category: ${categoryName(vote.category)}`
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

        setText(
            "voteCount",
            `${votes.length} ${
                votes.length === 1 ? "vote" : "votes"
            }`
        );

        if (votes.length === 0) {
            container.replaceChildren(
                emptyState(
                    "No votes yet",
                    "Proposals you vote on will appear here."
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
                    credentials: "same-origin",
                    cache: "no-store"
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

            const student = data.student || {};
            const stats = data.stats || {};

            const proposals = data.proposals || [];
            const votes = data.votes || [];

            const firstName = String(student.name || "")
                .trim()
                .split(/\s+/)[0];

            setText(
                "dashboardWelcome",
                firstName
                    ? `Welcome back, ${firstName}!`
                    : "Welcome back!"
            );

            setText("accountEmail", student.email || "");

            setText(
                "statTotalProposals",
                stats.total_proposals ?? 0
            );

            setText(
                "statPending",
                stats.pending_proposals ?? 0
            );

            setText(
                "statApproved",
                stats.approved_proposals ?? 0
            );

            setText(
                "statVotes",
                stats.total_votes ?? 0
            );

            renderProposals(proposals);
            renderVotes(votes);

            message.hidden = true;
            content.hidden = false;

            await loadDebates();

        } catch (error) {
            console.error("Student dashboard error:", error);

            showError(
                "Unable to load your account. " +
                "Please refresh the page."
            );
        }
    }

    loadDashboard();

})();
