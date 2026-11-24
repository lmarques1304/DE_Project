(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const categories = {
        "academic-life": "Academic Life",
        "campus-mobility": "Campus Mobility",
        "canteens-and-food": "Canteens and Food",
        "events-and-traditions": "Events and Traditions",
        "sports-and-culture": "Sports and Culture",
        "student-well-being": "Student Well-Being",
        "study-spaces": "Study Spaces",
        "workshops-and-skills": "Workshops and Skills"
    };

    const statusLabels = {
        pending: "Pending Review",
        approved: "Published",
        rejected: "Rejected"
    };

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    const portugalFormatter = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Europe/Lisbon"
    });

    function el(tag, props = {}, ...children) {
        const node = Object.assign(document.createElement(tag), props);
        node.append(...children);
        return node;
    }

    function text(tag, value, className = "") {
        return el(tag, {
            className,
            textContent: String(value ?? "")
        });
    }

    function setText(id, value) {
        $(id).textContent = value ?? "";
    }

    function formatDate(value) {
        if (!value) return "Not available";

        let normalized = String(value);

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            normalized += "T12:00:00Z";
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime())
            ? "Not available"
            : dateFormatter.format(date);
    }

    function getPortugalToday() {
        const parts = portugalFormatter.formatToParts(new Date());
        const get = type => parts.find(part => part.type === type).value;

        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function getVotingState(deadline) {
        if (
            typeof deadline !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(deadline)
        ) {
            return "unknown";
        }

        return getPortugalToday() > deadline ? "closed" : "open";
    }

    function categoryName(value) {
        return Object.hasOwn(categories, value)
            ? categories[value]
            : value || "Other";
    }

    function normalizeStatus(value) {
        return Object.hasOwn(statusLabels, value)
            ? value
            : "pending";
    }

    function countText(count, singular) {
        return `${count} ${singular}${count === 1 ? "" : "s"}`;
    }

    function getVoteTotals(item) {
        const yes = Number(item.yes_votes) || 0;
        const no = Number(item.no_votes) || 0;
        const total = yes + no;
        const yesPercent = total ? Math.round(yes / total * 100) : 0;
        const noPercent = total ? 100 - yesPercent : 0;

        return { yes, no, total, yesPercent, noPercent };
    }

    function createStatus(status) {
        const normalized = normalizeStatus(status);

        return text(
            "span",
            statusLabels[normalized],
            `dashboard-status ${normalized}`
        );
    }

    function createVotingStatus(deadline, closedClass = "closed") {
        const state = getVotingState(deadline);

        const labels = {
            open: "Voting Open",
            closed: "Voting Closed",
            unknown: "Deadline unavailable"
        };

        return text(
            "span",
            labels[state],
            `dashboard-status ${state === "open" ? "approved" : closedClass}`
        );
    }

    function createRejectionReason(reason) {
        return el("div", { className: "dashboard-rejection-reason" },
            text("strong", "Reason for rejection"),
            text("p", reason)
        );
    }

    function createResults(item) {
        const { yes, no, total, yesPercent, noPercent } = getVoteTotals(item);

        const wrapper = el("div", { className: "dashboard-results" },
            el("div", { className: "dashboard-results-heading" },
                text("span", "Voting Results"),
                text("span", countText(total, "vote"))
            )
        );

        const results = [
            ["Yes", yes, yesPercent, "yes"],
            ["No", no, noPercent, "no"]
        ];

        results.forEach(([label, count, percent, type]) => {
            const fill = el("div", {
                className: `dashboard-progress-fill ${type}`
            });

            fill.style.width = `${percent}%`;

            wrapper.append(
                el("div", { className: "dashboard-result-row" },
                    el("div", { className: "dashboard-result-label" },
                        text("span", label),
                        text("span", `${count} (${percent}%)`)
                    ),
                    el("div", { className: "dashboard-progress-track" }, fill)
                )
            );
        });

        return wrapper;
    }

    function createCard({ title, status, body, meta }) {
        const heading = typeof title === "string"
            ? text("h3", title)
            : title;

        return el("article", { className: "dashboard-item" },
            el("div", { className: "dashboard-item-top" }, heading, status),
            body,
            el("div", { className: "dashboard-item-meta" },
                ...meta.map(value => text("span", value))
            )
        );
    }

    function emptyState(title, description, icon = "") {
        const container = el("div", { className: "dashboard-empty" });

        if (icon) {
            container.append(text("span", icon, "organization-empty-icon"));
        }

        container.append(
            text("h3", title),
            text("p", description)
        );

        return container;
    }

    function renderList(containerId, countId, items, singular, builder, empty) {
        setText(countId, countText(items.length, singular));

        const fragment = document.createDocumentFragment();

        if (items.length) {
            items.forEach(item => fragment.append(builder(item)));
        } else {
            fragment.append(emptyState(...empty));
        }

        $(containerId).replaceChildren(fragment);
    }

    function showError(message) {
        setText("dashboardMessage", message);
        $("dashboardMessage").hidden = false;
        $("dashboardContent").hidden = true;
    }

    function showContent() {
        $("dashboardMessage").hidden = true;
        $("dashboardContent").hidden = false;
    }

    async function fetchJSON(url) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            const error = new Error("Unable to load dashboard data.");
            error.status = response.status;
            throw error;
        }

        return response.json();
    }

    function handleDashboardError(error, deniedMessage, fallbackMessage) {
        if (error.status === 401) {
            window.location.replace("login.html");
            return;
        }

        if (error.status === 403) {
            showError(deniedMessage);
            return;
        }

        console.error(error);
        showError(fallbackMessage);
    }

    window.DashboardCommon = Object.freeze({
        $,
        el,
        text,
        setText,
        formatDate,
        getVotingState,
        categoryName,
        normalizeStatus,
        countText,
        getVoteTotals,
        createStatus,
        createVotingStatus,
        createRejectionReason,
        createResults,
        createCard,
        emptyState,
        renderList,
        showError,
        showContent,
        fetchJSON,
        handleDashboardError
    });
})();