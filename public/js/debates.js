(() => {
    "use strict";

    const CATEGORIES = [
        {
            slug: "academic-life",
            name: "Academic Life",
            description:
                "Discuss classes, academic schedules and student experiences."
        },
        {
            slug: "campus-mobility",
            name: "Campus Mobility",
            description:
                "Share ideas about transport, accessibility and moving around campus."
        },
        {
            slug: "canteens-and-food",
            name: "Canteens and Food",
            description:
                "Discuss university meals, canteens and food services."
        },
        {
            slug: "events-and-traditions",
            name: "Events and Traditions",
            description:
                "Talk about student events, celebrations and university traditions."
        },
        {
            slug: "sports-and-culture",
            name: "Sports and Culture",
            description:
                "Explore sports activities, cultural events and student initiatives."
        },
        {
            slug: "student-well-being",
            name: "Student Well-Being",
            description:
                "Discuss student support, well-being and campus life."
        },
        {
            slug: "study-spaces",
            name: "Study Spaces",
            description:
                "Share ideas about libraries, study rooms and learning environments."
        },
        {
            slug: "workshops-and-skills",
            name: "Workshops and Skills",
            description:
                "Explore learning opportunities, workshops and practical skills."
        }
    ];

    const categoryMap = new Map(
        CATEGORIES.map(category => [
            category.slug,
            category
        ])
    );

    const overviewView =
        document.getElementById("overviewView");

    const categoryView =
        document.getElementById("categoryView");

    const categoriesGrid =
        document.getElementById("categoriesGrid");

    const categoryBreadcrumb =
        document.getElementById("categoryBreadcrumb");

    const categoryTitle =
        document.getElementById("categoryTitle");

    const categoryDescription =
        document.getElementById("categoryDescription");

    const categoryCount =
        document.getElementById("categoryCount");

    const debatesList =
        document.getElementById("debatesList");

    const debateSearch =
        document.getElementById("debateSearch");

    const debateSort =
        document.getElementById("debateSort");

    const loadMoreButton =
        document.getElementById("loadMoreButton");

    const pageMessage =
        document.getElementById("pageMessage");

    const startDebateButton =
        document.getElementById("startDebateButton");

    const createDebateDialog =
        document.getElementById("createDebateDialog");

    const closeDebateDialog =
        document.getElementById("closeDebateDialog");

    const cancelDebateButton =
        document.getElementById("cancelDebateButton");

    const createDebateForm =
        document.getElementById("createDebateForm");

    const createDebateMessage =
        document.getElementById("createDebateMessage");

    const submitDebateButton =
        document.getElementById("submitDebateButton");

    const newDebateCategory =
        document.getElementById
    const urlParams = new URLSearchParams(
        window.location.search
    );

    const selectedCategory =
        urlParams.get("category");

    const PAGE_SIZE = 12;

    let nextOffset = 0;
    let listController = null;
    let searchTimer = null;

    let currentUser = null;
    let authError = false;

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = String(text);
        }

        return element;
    }

    function shorten(value, maxLength = 160) {
        if (typeof value !== "string") {
            return "";
        }

        const text = value
            .trim()
            .replace(/\s+/g, " ");

        if (text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength - 1) + "…";
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        let dateValue = String(value).trim();

        if (
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
                dateValue
            )
        ) {
            dateValue = dateValue.replace(" ", "T") + "Z";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Europe/Lisbon"
        }).format(date);
    }

    function debateCountText(count) {
        const total = Number(count) || 0;

        return total === 1
            ? "1 debate"
            : `${total} debates`;
    }

    function commentCountText(count) {
        const total = Number(count) || 0;

        return total === 1
            ? "1 comment"
            : `${total} comments`;
    }

    function showPageMessage(message, isError = false) {
        pageMessage.textContent = message;

        pageMessage.classList.toggle(
            "is-error",
            isError
        );
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        const data = await response.json().catch(
            () => ({})
        );

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Something went wrong. Please try again."
            );
        }

        return data;
    }

    const authPromise = fetchJSON("/api/auth/me")
        .then(data => {
            currentUser = data.user || null;

            if (
                currentUser &&
                currentUser.role !== "student"
            ) {
                startDebateButton.hidden = true;
            }
        })
        .catch(() => {
            authError = true;
        });

    function createRecentDebate(debate) {
        const link = createElement(
            "a",
            "debates-recent-item"
        );

        link.href =
            `debate.html?id=${encodeURIComponent(debate.id)}`;

        const title = createElement(
            "span",
            "debates-recent-title",
            debate.title || "Untitled debate"
        );

        const description = createElement(
            "p",
            "debates-recent-preview",
            shorten(debate.description, 180)
        );

        const meta = createElement(
            "div",
            "debates-recent-meta"
        );

        const date = formatDate(debate.createdAt);

        if (date) {
            meta.append(
                createElement(
                    "span",
                    "",
                    date
                )
            );

            meta.append(
                createElement(
                    "span",
                    "debates-recent-separator",
                    "·"
                )
            );
        }

        meta.append(
            createElement(
                "span",
                "",
                commentCountText(debate.commentCount)
            )
        );

        link.append(
            title,
            description,
            meta
        );

        return link;
    }

    function createCategoryCard(categoryData) {
        const info = categoryMap.get(
            categoryData.slug
        );

        if (!info) {
            return null;
        }

        const card = createElement(
            "article",
            "debates-category-card"
        );


        const top = createElement(
            "div",
            "debates-card-top"
        );

        const heading = createElement(
            "h3",
            "",
            info.name
        );

        const badge = createElement(
            "span",
            "debates-count-badge",
            debateCountText(categoryData.totalDebates)
        );

        top.append(heading, badge);

        const description = createElement(
            "p",
            "debates-card-description",
            info.description
        );

        const recentList = createElement(
            "div",
            "debates-recent-list"
        );

        const recentDebates = Array.isArray(
            categoryData.recentDebates
        )
            ? categoryData.recentDebates
            : [];

        if (recentDebates.length === 0) {
            recentList.append(
                createElement(
                    "p",
                    "debates-empty-category",
                    "No debates in this category yet. Be the first to start a discussion!"
                )
            );
        } else {
            recentDebates.forEach(debate => {
                recentList.append(
                    createRecentDebate(debate)
                );
            });
        }

        const footer = createElement(
            "div",
            "debates-card-footer"
        );

        const viewAll = createElement(
            "a",
            "debates-view-all",
            "View all debates →"
        );

        viewAll.href =
            `debates.html?category=${encodeURIComponent(info.slug)}`;

        footer.append(viewAll);

        card.append(
            top,
            description,
            recentList,
            footer
        );

        return card;
    }

    async function loadCategories() {
        try {
            const data = await fetchJSON(
                "/api/debates/categories",
                {
                    cache: "no-store"
                }
            );

            if (!Array.isArray(data.categories)) {
                throw new Error(
                    "Invalid categories response."
                );
            }

            const cards = data.categories
                .map(createCategoryCard)
                .filter(Boolean);

            categoriesGrid.replaceChildren(...cards);

        } catch (error) {
            categoriesGrid.replaceChildren(
                createElement(
                    "p",
                    "debates-loading",
                    "Unable to load categories. Please refresh the page."
                )
            );

            showPageMessage(
                error.message,
                true
            );
        }
    }

    function createDebateListItem(debate) {
        const link = createElement(
            "a",
            "debates-list-item"
        );

        link.href =
            `debate.html?id=${encodeURIComponent(debate.id)}`;

        const title = createElement(
            "h3",
            "",
            debate.title || "Untitled debate"
        );

        const description = createElement(
            "p",
            "debates-list-description",
            shorten(debate.description, 260)
        );

        link.append(title, description);

        if (debate.topComment) {
            const comment = createElement(
                "p",
                "debates-top-comment",
                `Most liked comment: "${shorten(
                    debate.topComment,
                    190
                )}"`
            );

            link.append(comment);
        }

        const date = formatDate(
            debate.createdAt
        );

        const metaText = [
            commentCountText(debate.commentCount),
            date
        ]
            .filter(Boolean)
            .join(" · ");

        const meta = createElement(
            "div",
            "debates-list-meta",
            metaText
        );

        link.append(meta);

        return link;
    }

    async function loadCategoryDebates(reset = false) {
        if (!selectedCategory) {
            return;
        }

        if (listController) {
            listController.abort();
        }

        const controller = new AbortController();

        listController = controller;

        if (reset) {
            nextOffset = 0;

            debatesList.replaceChildren(
                createElement(
                    "p",
                    "debates-loading",
                    "Loading debates..."
                )
            );

            categoryCount.textContent = "";
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
            const data = await fetchJSON(
                `/api/debates?${params.toString()}`,
                {
                    signal: controller.signal,
                    cache: "no-store"
                }
            );

            if (listController !== controller) {
                return;
            }

            if (!Array.isArray(data.debates)) {
                throw new Error(
                    "Invalid debates response."
                );
            }

            if (reset) {
                debatesList.replaceChildren();
            }

            data.debates.forEach(debate => {
                debatesList.append(
                    createDebateListItem(debate)
                );
            });

            nextOffset += data.debates.length;

            const total = Number(data.total) || 0;

            categoryCount.textContent =
                debateCountText(total);

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
                nextOffset >= total ||
                data.debates.length === 0;

        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            if (listController !== controller) {
                return;
            }

            if (reset) {
                debatesList.replaceChildren();
            }

            debatesList.append(
                createElement(
                    "p",
                    "debates-list-empty",
                    "Unable to load debates. Please try again."
                )
            );

            showPageMessage(
                error.message,
                true
            );

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
        loadCategoryDebates(false);
    });

    startDebateButton.addEventListener(
        "click",
        async () => {
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
                showPageMessage(
                    "Only student accounts can start debates.",
                    true
                );

                return;
            }

            createDebateMessage.textContent = "";

            if (
                selectedCategory &&
                categoryMap.has(selectedCategory)
            ) {
                newDebateCategory.value =
                    selectedCategory;
            }

            createDebateDialog.showModal();
        }
    );

    function closeDialog() {
        createDebateDialog.close();
    }

    closeDebateDialog.addEventListener(
        "click",
        closeDialog
    );

    cancelDebateButton.addEventListener(
        "click",
        closeDialog
    );

    createDebateForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const title = document
                .getElementById("newDebateTitle")
                .value
                .trim();

            const description = document
                .getElementById("newDebateDescription")
                .value
                .trim();

            const category =
                newDebateCategory.value;

            createDebateMessage.textContent = "";

            submitDebateButton.disabled = true;
            submitDebateButton.textContent =
                "Submitting...";

            try {
                await fetchJSON("/api/debates", {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        title,
                        description,
                        category
                    })
                });

                createDebateForm.reset();
                createDebateDialog.close();

                showPageMessage(
                    "Your debate has been submitted for review. It will appear publicly once approved."
                );

            } catch (error) {
                createDebateMessage.textContent =
                    error.message ||
                    "Unable to submit your debate.";

            } finally {
                submitDebateButton.disabled = false;
                submitDebateButton.textContent =
                    "Submit for Review";
            }
        }
    );

    function initializePage() {
        if (
            selectedCategory &&
            categoryMap.has(selectedCategory)
        ) {

            const category = categoryMap.get(
                selectedCategory
            );

            overviewView.hidden = true;
            categoryView.hidden = false;

            categoryBreadcrumb.textContent =
                category.name;

            categoryTitle.textContent =
                category.name;

            categoryDescription.textContent =
                category.description;

            document.title =
                `${category.name} Debates | Instant Democracy`;

            loadCategoryDebates(true);

        } else {

            overviewView.hidden = false;
            categoryView.hidden = true;

            if (selectedCategory) {
                showPageMessage(
                    "Category not found. Showing all categories.",
                    true
                );
            }

            loadCategories();
        }
    }

    initializePage();

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                !document.hidden &&
                !selectedCategory
            ) {
                loadCategories();
            }
        }
    );

})();
