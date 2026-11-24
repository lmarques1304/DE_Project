(() => {
    const $ = id => document.getElementById(id);

    const menuButton = $("menuButton");
    const closeMenu = $("closeMenu");
    const sidebar = $("sidebar");
    const overlay = $("overlay");
    const accountButton = $("accountButton");
    const accountDropdown = $("accountDropdown");

    function setMenu(open) {
        sidebar?.classList.toggle("active", open);
        overlay?.classList.toggle("active", open);
        document.body.classList.toggle("no-scroll", open);
        menuButton?.setAttribute("aria-expanded", String(open));

        if (open) closeMenu?.focus();
    }

    function setAccount(open) {
        accountDropdown?.classList.toggle("active", open);
        accountButton?.setAttribute("aria-expanded", String(open));
    }

    function getAccountPage(role) {
        switch (role) {
            case "admin": return "admin.html";
            case "student": return "studentDashboard.html";
            case "uc":
            case "nuclei": return "organizationDashboard.html";
            default: return "index.html";
        }
    }

    function createElement(tag, text, className = "") {
        const element = document.createElement(tag);
        element.textContent = text;

        if (className) element.className = className;

        return element;
    }

    function createLink(text, href) {
        const link = createElement("a", text);
        link.href = href;
        return link;
    }

    function renderAccountMenu(user) {
        if (!accountDropdown) return;

        if (!user) {
            accountDropdown.replaceChildren(
                createLink("Sign in", "login.html"),
                createLink("Create account", "register.html")
            );
            return;
        }

        const userName = createElement("span", user.name, "account-user-name");
        const accountLink = createLink("My account", getAccountPage(user.role));
        const signOut = createElement("button", "Sign out", "account-signout");

        signOut.type = "button";
        signOut.addEventListener("click", handleSignOut);

        accountDropdown.replaceChildren(userName, accountLink, signOut);
    }

    async function loadCurrentUser() {
        if (!accountDropdown) return;

        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) throw new Error("Unable to check session.");

            const data = await response.json();
            renderAccountMenu(data.user || null);
        } catch (error) {
            console.error("Authentication check failed:", error);
            accountDropdown.replaceChildren(
                createElement("span", "Account unavailable")
            );
        }
    }

    async function handleSignOut(event) {
        const button = event.currentTarget;

        button.disabled = true;
        button.textContent = "Signing out...";

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) throw new Error("Unable to sign out.");

            window.location.replace("index.html");
        } catch (error) {
            console.error("Sign out failed:", error);
            button.disabled = false;
            button.textContent = "Sign out";
            alert("Could not sign out. Please try again.");
        }
    }

    menuButton?.addEventListener("click", () => {
        setAccount(false);
        setMenu(true);
    });

    closeMenu?.addEventListener("click", () => setMenu(false));
    overlay?.addEventListener("click", () => setMenu(false));

    accountButton?.addEventListener("click", () => {
        setAccount(!accountDropdown?.classList.contains("active"));
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".account-container")) {
            setAccount(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        setMenu(false);
        setAccount(false);
    });

    loadCurrentUser();
})();