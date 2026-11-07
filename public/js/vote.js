(() => {
    const grid = document.getElementById("proposalGrid");
    if (!grid) return;

    let proposals = [];
    let loading = true;
    let loadError = false;
    let currentUser = null;
    let submittingVote = false;

    let source = "all";
    let category = null;

    const sourceLabels = {
        uc: "UC",
        nuclei: "Núcleos",
        student: "Student Proposal"
    };

    const mainFilters = document.getElementById("mainFilters");
    const mainButtons = mainFilters.querySelectorAll("[data-source]");
    const secondary = document.getElementById("secondaryFilters");
    const filterTitle = document.getElementById("filterTitle");
    const resultsCount = document.getElementById("resultsCount");
    const noResults = document.getElementById("noResults");

    const el = (tag, props = {}, ...children) => {
        const node = Object.assign(
            document.createElement(tag),
            props
        );

        node.append(...children);
        return node;
    };

    function formatDeadline(deadline) {
        if (!deadline) return "Not specified";

        const [year, month, day] = deadline.split("-").map(Number);

        const date = new Date(Date.UTC(year, month - 1, day));

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function isVotingOpen(proposal) {
        if (!proposal.voting_deadline) return false;

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Lisbon",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const get = type =>
            parts.find(part => part.type === type).value;

        const portugalToday =
            `${get("year")}-${get("month")}-${get("day")}`;

        return proposal.voting_open !== false &&
            portugalToday <= proposal.voting_deadline;
    }

    function getFilterConfig() {
        if (source === "nuclei") {
            return {
                title: "Select a Núcleo",
                allLabel: "All Núcleos",
                options: [
                    ...new Set(
                        proposals
                            .filter(p => p.source === "nuclei")
                            .map(p => p.organization)
                            .filter(Boolean)
                    )
                ].sort()
            };
        }

        if (source === "uc" || source === "student") {
            return {
                title: "Filter by topic",
                allLabel: "All categories",
                options: [
                    ...new Set(
                        proposals
                            .filter(p => p.source === source)
                            .map(p => p.category)
                            .filter(Boolean)
                    )
                ].sort()
            };
        }

        return null;
    }

    function renderFilters() {
        const config = getFilterConfig();

        filterTitle.textContent = config
            ? config.title
            : "Browse all proposals";

        if (!config) {
            secondary.replaceChildren(
                el("p", {
                    className: "filter-note",
                    textContent:
                        "Choose UC, Núcleos or Students to explore proposals."
                })
            );
            return;
        }

        const items = [
            [config.allLabel, null],
            ...config.options.map(option => [option, option])
        ];

        secondary.replaceChildren(
            ...items.map(([label, value]) => {
                const active = category === value;

                const button = el("button", {
                    type: "button",
                    className:
                        "category-button" +
                        (active ? " active" : ""),
                    textContent: label
                });

                button.dataset.value = value ?? "";
                button.setAttribute("aria-pressed", String(active));

                return button;
            })
        );
    }

    function resultsElement(proposal) {
        const yes = Number(proposal.yes_votes) || 0;
        const no = Number(proposal.no_votes) || 0;
        const total = yes + no;

        const yesPercentage = total
            ? Math.round((yes / total) * 100)
            : 0;

        const noPercentage = total
            ? 100 - yesPercentage
            : 0;

        const wrapper = el("div", {
            className: "vote-results"
        });

        wrapper.append(
            el("div", {
                className: "vote-results-heading",
                textContent:
                    `${total} ${total === 1 ? "vote" : "votes"}`
            })
        );

        [
            ["Yes", yes, yesPercentage, "yes"],
            ["No", no, noPercentage, "no"]
        ].forEach(([label, count, percentage, type]) => {
            const row = el("div", {
                className: "vote-result-row"
            });

            row.append(
                el(
                    "div",
                    { className: "vote-result-label" },
                    el("span", { textContent: label }),
                    el("span", {
                        textContent: `${count} (${percentage}%)`
                    })
                )
            );

            const track = el("div", {
                className: "vote-progress-track"
            });

            const fill = el("div", {
                className: `vote-progress-fill ${type}`
            });

            fill.style.width = `${percentage}%`;

            track.append(fill);
            row.append(track);
            wrapper.append(row);
        });

        return wrapper;
    }

    function votingElement(proposal) {
        const wrapper = el("div", {
            className: "vote-interaction"
        });

        const votingOpen = isVotingOpen(proposal);

        if (!votingOpen) {
            wrapper.append(
                el("p", {
                    className: "vote-closed-message",
                    textContent:
                        "Voting has closed. Final results are available below."
                })
            );

        } else if (proposal.user_vote) {
            wrapper.append(
                el("p", {
                    className: "vote-confirmation",
                    textContent:
                        `Your vote: ${
                            proposal.user_vote === "yes" ? "Yes" : "No"
                        }`
                })
            );

        } else if (!currentUser) {
            const message = el("p", {
                className: "vote-login-message",
                textContent:
                    "Sign in with a student account to vote. "
            });

            message.append(
                el("a", {
                    href: "login.html",
                    textContent: "Sign in"
                })
            );

            wrapper.append(message);

        } else if (currentUser.role !== "student") {
            wrapper.append(
                el("p", {
                    className: "vote-login-message",
                    textContent:
                        "Voting is available to student accounts only."
                })
            );

        } else {
            const actions = el("div", {
                className: "vote-actions"
            });

            const yesButton = el("button", {
                type: "button",
                className: "vote-button vote-yes",
                textContent: "Yes"
            });

            const noButton = el("button", {
                type: "button",
                className: "vote-button vote-no",
                textContent: "No"
            });

            yesButton.addEventListener("click", () => {
                submitVote(proposal.id, "yes");
            });

            noButton.addEventListener("click", () => {
                submitVote(proposal.id, "no");
            });

            actions.append(yesButton, noButton);
            wrapper.append(actions);
        }

        wrapper.append(resultsElement(proposal));

        return wrapper;
    }

    function proposalCard(proposal) {
        const isAnonymous = Number(proposal.anonymous) === 1;
        const votingOpen = isVotingOpen(proposal);

        const card = el(
            "article",
            { className: "proposal-card" },

            el(
                "div",
                { className: "proposal-meta" },

                el("span", {
                    className: "proposal-tag",
                    textContent:
                        sourceLabels[proposal.source] || "Proposal"
                }),

                el("span", {
                    className: "proposal-source",
                    textContent:
                        proposal.source === "nuclei"
                            ? proposal.organization || proposal.category
                            : proposal.category
                })
            ),

            el("h3", {
                textContent: proposal.title
            }),

            el("p", {
                textContent: proposal.description
            })
        );

        if (proposal.source === "student") {
            card.append(
                el("p", {
                    className: "proposal-author",
                    textContent: isAnonymous
                        ? "By Anonymous Student"
                        : `By ${proposal.author_name || "Student"}`
                })
            );
        }

        const deadlineBox = el("div", {
            className: "proposal-deadline"
        });

        deadlineBox.append(
            el("span", {
                className: "proposal-deadline-icon",
                textContent: "📅"
            }),

            el("span", {
                textContent:
                    `Voting closes on ${formatDeadline(
                        proposal.voting_deadline
                    )} at 23:59`
            })
        );

        card.append(deadlineBox);

        card.append(
            el(
                "div",
                { className: "proposal-card-footer" },

                el("span", {
                    className:
                        "proposal-status " +
                        (votingOpen ? "status-open" : "status-closed"),

                    textContent: votingOpen
                        ? "Open for voting"
                        : "Voting closed"
                })
            )
        );

        card.append(votingElement(proposal));

        return card;
    }

    function renderProposals() {
        if (loading) {
            grid.replaceChildren();
            resultsCount.textContent = "Loading...";
            noResults.hidden = true;
            return;
        }

        if (loadError) {
            grid.replaceChildren();
            resultsCount.textContent = "Unavailable";
            noResults.hidden = false;

            noResults.querySelector("h3").textContent =
                "Unable to load proposals";

            noResults.querySelector("p").textContent =
                "Please refresh the page and try again.";

            return;
        }

        const filtered = proposals.filter(proposal => {
            const matchesSource =
                source === "all" ||
                proposal.source === source;

            let matchesCategory = true;

            if (category && source === "nuclei") {
                matchesCategory =
                    proposal.organization === category;
            } else if (category) {
                matchesCategory =
                    proposal.category === category;
            }

            return matchesSource && matchesCategory;
        });

        grid.replaceChildren(
            ...filtered.map(proposalCard)
        );

        resultsCount.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "proposal"
                    : "proposals"
            }`;

        noResults.hidden = filtered.length > 0;

        if (filtered.length === 0) {
            const title = noResults.querySelector("h3");
            const description = noResults.querySelector("p");

            if (proposals.length === 0) {
                title.textContent = "No proposals yet";
                description.textContent =
                    "There are no approved proposals available.";
            } else {
                title.textContent = "No proposals found";
                description.textContent =
                    "Try another category or clear your filters.";
            }
        }
    }

    function update() {
        renderFilters();
        renderProposals();
    }

    function setSource(next) {
        source = next;
        category = null;

        mainButtons.forEach(button => {
            const active =
                button.dataset.source === source;

            button.classList.toggle("active", active);
            button.setAttribute(
                "aria-pressed",
                String(active)
            );
        });

        update();
    }

    async function submitVote(proposalId, vote) {
        if (submittingVote) return;

        const choice = vote === "yes" ? "Yes" : "No";

        const confirmed = window.confirm(
            `Confirm your vote: ${choice}?\n\n` +
            "You cannot change your vote afterwards."
        );

        if (!confirmed) return;

        submittingVote = true;

        try {
            const response = await fetch(
                `/api/proposals/${proposalId}/vote`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({ vote })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to record your vote."
                );
            }

            await loadProposals();

        } catch (error) {
            window.alert(error.message);
            await loadProposals();

        } finally {
            submittingVote = false;
        }
    }

    mainFilters.addEventListener("click", event => {
        const button = event.target.closest("[data-source]");

        if (button) {
            setSource(button.dataset.source);
        }
    });

    secondary.addEventListener("click", event => {
        const button = event.target.closest(".category-button");

        if (!button) return;

        category = button.dataset.value || null;
        update();
    });

    document
        .getElementById("clearFilters")
        ?.addEventListener("click", () => {
            setSource("all");
        });

    async function loadCurrentUser() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                currentUser = null;
                return;
            }

            const data = await response.json();
            currentUser = data.user || data;

        } catch (error) {
            currentUser = null;
            console.error(
                "Authentication check failed:",
                error
            );
        }
    }

    async function loadProposals() {
        loading = true;
        loadError = false;
        renderProposals();

        try {
            const response = await fetch("/api/proposals", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Unable to load proposals.");
            }

            const data = await response.json();

            proposals = Array.isArray(data.proposals)
                ? data.proposals
                : [];

        } catch (error) {
            console.error("Proposal loading error:", error);
            loadError = true;

        } finally {
            loading = false;
            update();
        }
    }

    async function initialize() {
        setSource("all");
        await loadCurrentUser();
        await loadProposals();
    }

    initialize();

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadProposals();
        }
    });
})();
