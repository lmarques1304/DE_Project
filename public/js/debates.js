(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const categories = {
        "academic-life": {
            name: "Academic Life",
            description: "Discuss classes, academic schedules and student experiences."
        },
        "campus-mobility": {
            name: "Campus Mobility",
            description: "Share ideas about transport, accessibility and moving around campus."
        },
        "canteens-and-food": {
            name: "Canteens and Food",
            description: "Discuss university meals, canteens and food services."
        },
        "events-and-traditions": {
            name: "Events and Traditions",
            description: "Talk about student events, celebrations and university traditions."
        },
        "sports-and-culture": {
            name: "Sports and Culture",
            description: "Explore sports activities, cultural events and student initiatives."
        },
        "student-well-being": {
            name: "Student Well-Being",
            description: "Discuss student support, well-being and campus life."
        },
        "study-spaces": {
            name: "Study Spaces",
            description: "Share ideas about libraries, study rooms and learning environments."
        },
        "workshops-and-skills": {
            name: "Workshops and Skills",
            description: "Explore learning opportunities, workshops and practical skills."
        }
    };

    const overviewView = $("overviewView");
    const categoryView = $("categoryView");
    const categoriesGrid = $("categoriesGrid");
    const categoryCount = $("categoryCount");
    const debatesList = $("debatesList");
    const debateSearch = $("debateSearch");
    const debateSort = $("debateSort");
    const loadMoreButton = $("loadMoreButton");
    const pageMessage = $("pageMessage");
    const startDebateButton = $("startDebateButton");
    const createDebateDialog = $("createDebateDialog");
    const createDebateForm = $("createDebateForm");
    const createDebateMessage = $("createDebateMessage");
    const submitDebateButton = $("submitDebateButton");
    const newDebateCategory = $("newDebateCategory");

    const selectedCategory = new URLSearchParams(window.location.search).get("category");

    const category = Object.hasOwn(categories, selectedCategory)
        ? categories[selectedCategory]
        : null;

    const PAGE_SIZE = 12;

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon"
    });

    let nextOffset = 0;
    let listController = null;
    let searchTimer = null;
    let currentUser = null;
    let authError = false;

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);

        return element;
    }

    function shorten(value, maxLength = 160) {
        if (typeof value !== "string") return "";

        const text = value.trim().replace(/\s+/g, " ");

        return text.length > maxLength
            ? text.slice(0, maxLength - 1) + "…"
            : text;
    }

    function formatDate(value) {
        if (!value) return "";

        let normalized = String(value).trim();

        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime())
            ? ""
            : dateFormatter.format(date);
    }

    function countText(value, singular) {
        const count = Number(value) || 0;

        return `${count} ${singular}${count === 1 ? "" : "s"}`;
    }

    function showPageMessage(message, isError = false) {
        pageMessage.textContent = message;
        pageMessage.classList.toggle("is-error", isError);
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error || "Something went wrong. Please try again."
            );
        }

        return data;
    }

    const authPromise = fetchJSON("/api/auth/me")
        .then(data => {
            currentUser = data.user || null;

            startDebateButton.hidden = Boolean(
                currentUser && currentUser.role !== "student"
            );
        })
        .catch(() => {
            authError = true;
        });

    function createDebateCard(debate, compact = false) {
        const link = createElement(
            "a",
            compact ? "debates-recent-item" : "debates-list-item"
        );

        link.href = `debate.html?id=${encodeURIComponent(debate.id)}`;

        const title = createElement(
            compact ? "span" : "h3",
            compact ? "debates-recent-title" : "",
            debate.title || "Untitled debate"
        );

        const description = createElement(
            "p",
            compact ? "debates-recent-preview" : "debates-list-description",
            shorten(debate.description, compact ? 180 : 260)
        );

        link.append(title, description);

        const date = formatDate(debate.createdAt);
        const comments = countText(debate.commentCount, "comment");

        if (compact) {
            const meta = createElement("div", "debates-recent-meta");

            if (date) {
                meta.append(
                    createElement("span", "", date),
                    createElement("span", "debates-recent-separator", "·")
                );
            }

            meta.append(createElement("span", "", comments));
            link.append(meta);
        } else {
            if (debate.topComment) {
                link.append(
                    createElement(
                        "p",
                        "debates-top-comment",
                        `Most liked comment: "${shorten(debate.topComment, 190)}"`
                    )
                );
            }

            link.append(
                createElement(
                    "div",
                    "debates-list-meta",
                    [comments, date].filter(Boolean).join(" · ")
                )
            );
        }

        return link;
    }

    function createCategoryCard(categoryData) {
        const slug = categoryData.slug;

        if (!Object.hasOwn(categories, slug)) return null;

        const info = categories[slug];

        const card = createElement("article", "debates-category-card");
        const top = createElement("div", "debates-card-top");

        top.append(
            createElement("h3", "", info.name),
            createElement(
                "span",
                "debates-count-badge",
                countText(categoryData.totalDebates, "debate")
            )
        );

        const recentList = createElement("div", "debates-recent-list");

        const recentDebates = Array.isArray(categoryData.recentDebates)
            ? categoryData.recentDebates.slice(0, 3)
            : [];

        if (recentDebates.length) {
            recentList.append(
                ...recentDebates.map(debate => createDebateCard(debate, true))
            );
        } else {
            recentList.append(
                createElement(
                    "p",
                    "debates-empty-category",
                    "No debates in this category yet. Be the first to start a discussion!"
                )
            );
        }

        const footer = createElement("div", "debates-card-footer");
        const viewAll = createElement("a", "debates-view-all", "View all debates →");

        viewAll.href = `debates.html?category=${encodeURIComponent(slug)}`;

        footer.append(viewAll);

        card.append(
            top,
            createElement("p", "debates-card-description", info.description),
            recentList,
            footer
        );

        return card;
    }

    async function loadCategories() {
        try {
            const data = await fetchJSON("/api/debates/categories");

            if (!Array.isArray(data.categories)) {
                throw new Error("Invalid categories response.");
            }

            categoriesGrid.replaceChildren(
                ...data.categories.map(createCategoryCard).filter(Boolean)
            );
        } catch (error) {
            categoriesGrid.replaceChildren(
                createElement(
                    "p",
                    "debates-loading",
                    "Unable to load categories. Please refresh the page."
                )
            );

            showPageMessage(error.message, true);
        }
    }

    async function loadCategoryDebates(reset = false) {
        if (!category) return;

        listController?.abort();

        const controller = new AbortController();
        listController = controller;

        if (reset) {
            nextOffset = 0;
            categoryCount.textContent = "";

            debatesList.replaceChildren(
                createElement("p", "debates-loading", "Loading debates...")
            );
        }

        loadMoreButton.disabled = true;
        loadMoreButton.hidden = true;

        const params = new URLSearchParams({
            category: selectedCategory,
            search: debateSearch.value.trim(),
            sort: debateSort.value,
            limit: String(PAGE_SIZE),
            offset: String(nextOffset)
        });

        try {
            const data = await fetchJSON(`/api/debates?${params}`, {
                signal: controller.signal
            });

            if (listController !== controller) return;

            if (!Array.isArray(data.debates)) {
                throw new Error("Invalid debates response.");
            }

            if (reset) debatesList.replaceChildren();

            debatesList.append(
                ...data.debates.map(debate => createDebateCard(debate))
            );

            nextOffset += data.debates.length;

            const total = Number(data.total) || 0;

            categoryCount.textContent = countText(total, "debate");

            if (total === 0) {
                debatesList.append(
                    createElement(
                        "p",
                        "debates-list-empty",
                        "No debates found. Try another search or start a new discussion."
                    )
                );
            }

            loadMoreButton.hidden =
                nextOffset >= total || data.debates.length === 0;

        } catch (error) {
            if (error.name === "AbortError" || listController !== controller) {
                return;
            }

            if (reset) debatesList.replaceChildren();

            debatesList.append(
                createElement(
                    "p",
                    "debates-list-empty",
                    "Unable to load debates. Please try again."
                )
            );

            showPageMessage(error.message, true);

        } finally {
            if (listController === controller) {
                listController = null;
                loadMoreButton.disabled = false;
            }
        }
    }

    debateSearch.addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            loadCategoryDebates(true);
        }, 300);
    });

    debateSort.addEventListener("change", () => {
        clearTimeout(searchTimer);
        loadCategoryDebates(true);
    });

    loadMoreButton.addEventListener("click", () => {
        loadCategoryDebates();
    });

    startDebateButton.addEventListener("click", async () => {
        await authPromise;

        if (authError) {
            showPageMessage(
                "Unable to check your session. Please refresh the page.",
                true
            );
            return;
        }

        if (!currentUser) {
            window.location.href = "login.html";
            return;
        }

        if (currentUser.role !== "student") {
            showPageMessage("Only student accounts can start debates.", true);
            return;
        }

        createDebateMessage.textContent = "";

        if (category) {
            newDebateCategory.value = selectedCategory;
        }

        createDebateDialog.showModal();
    });

    ["closeDebateDialog", "cancelDebateButton"].forEach(id => {
        $(id).addEventListener("click", () => createDebateDialog.close());
    });

    createDebateForm.addEventListener("submit", async event => {
        event.preventDefault();

        const formData = new FormData(createDebateForm);

        const debate = {
            title: formData.get("title").trim(),
            description: formData.get("description").trim(),
            category: formData.get("category")
        };

        createDebateMessage.textContent = "";
        submitDebateButton.disabled = true;
        submitDebateButton.textContent = "Submitting...";

        try {
            await fetchJSON("/api/debates", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(debate)
            });

            createDebateForm.reset();
            createDebateDialog.close();

            showPageMessage(
                "Your debate has been submitted for review. It will appear publicly once approved."
            );

        } catch (error) {
            createDebateMessage.textContent =
                error.message || "Unable to submit your debate.";

        } finally {
            submitDebateButton.disabled = false;
            submitDebateButton.textContent = "Submit for Review";
        }
    });

    function initializePage() {
        overviewView.hidden = Boolean(category);
        categoryView.hidden = !category;

        if (category) {
            $("categoryBreadcrumb").textContent = category.name;
            $("categoryTitle").textContent = category.name;
            $("categoryDescription").textContent = category.description;

            document.title = `${category.name} Debates | Instant Democracy`;

            loadCategoryDebates(true);
        } else {
            if (selectedCategory) {
                showPageMessage(
                    "Category not found. Showing all categories.",
                    true
                );
            }

            loadCategories();
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && !category) {
            loadCategories();
        }
    });

    initializePage();
})();