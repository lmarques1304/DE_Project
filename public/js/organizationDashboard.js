
/* =========================================================
   ORGANIZATION DASHBOARD

   UC and Núcleos:
   - Published proposals
   - Active and completed votings
   - Student participation
   - Voting results
   ========================================================= */

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

        const date = new Date(
            `${datePart}T12:00:00Z`
        );

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
        const parts = new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone: "Europe/Lisbon",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(new Date());

        const get = type =>
            parts.find(part => part.type === type).value;

        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function isVotingClosed(deadline) {
        return (
            typeof deadline === "string" &&
            getPortugalToday() > deadline
        );
    }

    function isVotingActive(proposal) {
        return (
            proposal.status === "approved" &&
            typeof proposal.voting_deadline === "string" &&
            getPortugalToday() <= proposal.voting_deadline
        );
    }

    function showError(text) {
        message.hidden = false;
        message.textContent = text;
        content.hidden = true;
    }

    function getVoteTotals(proposal) {
        const yes = Number(proposal.yes_votes) || 0;
        const no = Number(proposal.no_votes) || 0;

        return {
            yes,
            no,
            total: yes + no
        };
    }

    function renderStatistics(proposals) {
        const published = proposals.filter(
            proposal => proposal.status === "approved"
        );

        const active = published.filter(
            isVotingActive
        );

        const completed = published.filter(
            proposal => isVotingClosed(
                proposal.voting_deadline
            )
        );

        const totalVotes = published.reduce(
            (sum, proposal) =>
                sum + getVoteTotals(proposal).total,
            0
        );

        $("statTotal").textContent =
            published.length;

        $("statActive").textContent =
            active.length;

        $("statCompleted").textContent =
            completed.length;

        $("statVotes").textContent =
            totalVotes;
    }

    function createResults(proposal) {
        const { yes, no, total } =
            getVoteTotals(proposal);

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
                {
                    className:
                        "dashboard-results-heading"
                },
                el("span", {
                    textContent: "Voting Results"
                }),
                el("span", {
                    textContent:
                        `${total} ${
                            total === 1 ? "vote" : "votes"
                        }`
                })
            )
        );

        const results = [
            ["Yes", yes, yesPercent, "yes"],
            ["No", no, noPercent, "no"]
        ];

        results.forEach(
            ([label, count, percent, type]) => {

                const row = el("div", {
                    className: "dashboard-result-row"
                });

                const rowHeading = el(
                    "div",
                    {
                        className:
                            "dashboard-result-label"
                    },
                    el("span", {
                        textContent: label
                    }),
                    el("span", {
                        textContent:
                            `${count} (${percent}%)`
                    })
                );

                const track = el("div", {
                    className:
                        "dashboard-progress-track"
                });

                const fill = el("div", {
                    className:
                        `dashboard-progress-fill ${type}`
                });

                fill.style.width = `${percent}%`;

                track.append(fill);

                row.append(rowHeading, track);

                wrapper.append(row);
            }
        );

        return wrapper;
    }

    function createOutcome(proposal) {
        if (!isVotingClosed(proposal.voting_deadline)) {
            return el("span", {
                className:
                    "organization-proposal-outcome neutral",
                textContent: "Voting in progress"
            });
        }

        const { yes, no, total } =
            getVoteTotals(proposal);

        if (total === 0) {
            return el("span", {
                className:
                    "organization-proposal-outcome neutral",
                textContent: "No votes received"
            });
        }

        if (yes > no) {
            return el("span", {
                className:
                    "organization-proposal-outcome positive",
                textContent: "Supported by community"
            });
        }

        if (yes === no) {
            return el("span", {
                className:
                    "organization-proposal-outcome neutral",
                textContent: "No majority reached"
            });
        }

        return el("span", {
            className:
                "organization-proposal-outcome negative",
            textContent: "Not supported by community"
        });
    }

    function createProposalCard(proposal) {
        const card = el("article", {
            className: "dashboard-item"
        });

        const active = isVotingActive(proposal);

        const votingStatus = active
            ? "Voting Open"
            : "Voting Closed";

        const statusClass = active
            ? "approved"
            : "pending";

        const top = el(
            "div",
            {
                className: "dashboard-item-top"
            },

            el("h3", {
                textContent: proposal.title
            }),

            el("span", {
                className:
                    `dashboard-status ${statusClass}`,
                textContent: votingStatus
            })
        );

        card.append(top);

        card.append(
            el("p", {
                className:
                    "dashboard-item-description",
                textContent: proposal.description
            })
        );

        const meta = el("div", {
            className: "dashboard-item-meta"
        });

        meta.append(
            el("span", {
                textContent:
                    `Category: ${proposal.category}`
            }),

            el("span", {
                textContent:
                    `Published: ${formatDate(
                        proposal.created_at
                    )}`
            }),

            el("span", {
                textContent:
                    `Deadline: ${formatDate(
                        proposal.voting_deadline
                    )}`
            })
        );

        card.append(meta);

        card.append(
            createResults(proposal)
        );

        const footer = el("div", {
            className:
                "organization-proposal-footer"
        });

        footer.append(
            el("span", {
                textContent: active
                    ? "Voting is currently open"
                    : "Voting period completed"
            })
        );

        footer.append(
            createOutcome(proposal)
        );

        card.append(footer);

        return card;
    }

    function renderProposals(proposals) {
        const container =
            $("organizationProposals");

        const published = proposals.filter(
            proposal => proposal.status === "approved"
        );

        $("proposalCount").textContent =
            `${published.length} ${
                published.length === 1
                    ? "proposal"
                    : "proposals"
            }`;

        if (published.length === 0) {
            container.replaceChildren(
                el(
                    "div",
                    {
                        className: "dashboard-empty"
                    },

                    el("span", {
                        className:
                            "organization-empty-icon",
                        textContent: "📋"
                    }),

                    el("h3", {
                        textContent:
                            "No proposals yet"
                    }),

                    el("p", {
                        textContent:
                            "Your organization's published " +
                            "proposals will appear here."
                    })
                )
            );

            return;
        }

        container.replaceChildren(
            ...published.map(createProposalCard)
        );
    }

    function renderParticipation(proposals) {
        const published = proposals.filter(
            proposal => proposal.status === "approved"
        );

        const totalYes = published.reduce(
            (sum, proposal) =>
                sum + Number(
                    proposal.yes_votes || 0
                ),
            0
        );

        const totalNo = published.reduce(
            (sum, proposal) =>
                sum + Number(
                    proposal.no_votes || 0
                ),
            0
        );

        const total = totalYes + totalNo;

        const yesPercent = total
            ? Math.round(
                (totalYes / total) * 100
            )
            : 0;

        const noPercent = total
            ? 100 - yesPercent
            : 0;

        $("totalYesVotes").textContent =
            totalYes;

        $("totalNoVotes").textContent =
            totalNo;

        $("overallYesPercentage").textContent =
            `${yesPercent}%`;

        $("overallYesBar").style.width =
            `${yesPercent}%`;

        $("overallNoBar").style.width =
            `${noPercent}%`;

        $("participationDescription").textContent =
            total === 0
                ? "No votes have been received yet."
                : `Based on ${total} student ${
                    total === 1 ? "vote" : "votes"
                } across your published proposals.`;
    }

    async function loadDashboard() {
        try {
            const response = await fetch(
                "/api/organization/dashboard",
                {
                    credentials: "same-origin"
                }
            );

            if (response.status === 401) {
                window.location.replace(
                    "login.html"
                );
                return;
            }

            if (response.status === 403) {
                showError(
                    "This dashboard is available " +
                    "to organizations only."
                );
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to load organization dashboard."
                );
            }

            const data = await response.json();

            const organization = data.organization;
            const proposals = data.proposals || [];

            const displayName =
                organization.organization ||
                organization.name;

            $("organizationName").textContent =
                displayName;

            $("organizationType").textContent =
                organization.role === "uc"
                    ? "UNIVERSITY DASHBOARD"
                    : "STUDENT ASSOCIATION DASHBOARD";

            document.title =
                `${displayName} | Instant Democracy`;

            renderStatistics(proposals);

            renderParticipation(proposals);

            renderProposals(proposals);

            message.hidden = true;
            content.hidden = false;

        } catch (error) {
            console.error(
                "Organization dashboard error:",
                error
            );

            showError(
                "Unable to load organization dashboard. " +
                "Please refresh the page."
            );
        }
    }

    loadDashboard();

})();