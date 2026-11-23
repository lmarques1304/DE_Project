/* =========================================================
   script.js — SHARED ACROSS ALL PAGES

   - Sidebar navigation
   - Account dropdown
   - Authentication status
   - Role-based account navigation
   - Sign out
   ========================================================= */

(() => {
    const $ = (id) => document.getElementById(id);

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

        menuButton?.setAttribute(
            "aria-expanded",
            String(open)
        );

        if (open) {
            closeMenu?.focus();
        }
    }

    menuButton?.addEventListener("click", () => {
        setAccount(false);
        setMenu(true);
    });

    closeMenu?.addEventListener("click", () => {
        setMenu(false);
    });

    overlay?.addEventListener("click", () => {
        setMenu(false);
    });

    function setAccount(open) {
        accountDropdown?.classList.toggle("active", open);

        accountButton?.setAttribute(
            "aria-expanded",
            String(open)
        );
    }

    accountButton?.addEventListener("click", () => {
        setAccount(
            !accountDropdown?.classList.contains("active")
        );
    });

    function getAccountPage(role) {
        switch (role) {
            case "admin":
                return "admin.html";

            case "student":
                return "studentDashboard.html";

            case "uc":
            case "nuclei":
                return "organizationDashboard.html";

            default:
                return "index.html";
        }
    }

    async function loadCurrentUser() {
        if (!accountDropdown) return;

        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Unable to check session.");
            }

            const data = await response.json();

            renderAccountMenu(data.user || null);

        } catch (error) {
            console.error(
                "Authentication check failed:",
                error
            );

            accountDropdown.replaceChildren();

            const errorMessage =
                document.createElement("span");

            errorMessage.textContent =
                "Account unavailable";

            accountDropdown.append(errorMessage);
        }
    }

    function renderAccountMenu(user) {
        if (!accountDropdown) return;

        accountDropdown.replaceChildren();

        if (!user) {
            const signIn =
                document.createElement("a");

            signIn.href = "login.html";
            signIn.textContent = "Sign in";

            const register =
                document.createElement("a");

            register.href = "register.html";
            register.textContent = "Create account";

            accountDropdown.append(
                signIn,
                register
            );

            return;
        }

        const userName =
            document.createElement("span");

        userName.className = "account-user-name";
        userName.textContent = user.name;

        const accountLink =
            document.createElement("a");

        accountLink.href = getAccountPage(user.role);
        accountLink.textContent = "My account";

        const signOut =
            document.createElement("button");

        signOut.type = "button";
        signOut.className = "account-signout";
        signOut.textContent = "Sign out";

        signOut.addEventListener(
            "click",
            handleSignOut
        );

        accountDropdown.append(
            userName,
            accountLink,
            signOut
        );
    }

    async function handleSignOut(event) {
        const button = event.currentTarget;

        button.disabled = true;
        button.textContent = "Signing out...";

        try {
            const response = await fetch(
                "/api/auth/logout",
                {
                    method: "POST",
                    credentials: "same-origin"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to sign out."
                );
            }

            window.location.replace("index.html");

        } catch (error) {
            console.error(
                "Sign out failed:",
                error
            );

            button.disabled = false;
            button.textContent = "Sign out";

            alert(
                "Could not sign out. Please try again."
            );
        }
    }

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".account-container")) {
            setAccount(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        setMenu(false);
        setAccount(false);
    });

    loadCurrentUser();
})();
