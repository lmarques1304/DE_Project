
/* =========================================================
   CREATE PROPOSAL — Instant Democracy

   Students:
   - Public or anonymous proposals
   - Administrator approval required

   UC:
   - Publicly identified
   - Immediate publication

   Administrators:
   - Cannot create proposals
   ========================================================= */

(() => {

    const form = document.getElementById("proposalForm");

    if (!form) return;

    const titleInput =
        document.getElementById("proposalTitle");

    const categoryInput =
        document.getElementById("proposalCategory");

    const descriptionInput =
        document.getElementById("proposalDescription");

    const deadlineInput =
        document.getElementById("proposalDeadline");

    const anonymousInput =
        document.getElementById("proposalAnonymous");

    const publicInput =
        document.getElementById("proposalPublic");

    const anonymousOption =
        document.getElementById("anonymousOption");

    const privacyNote =
        document.getElementById("privacyNote");

    const organizationIdentityNotice =
        document.getElementById("organizationIdentityNotice");

    const descriptionCount =
        document.getElementById("descriptionCount");

    const authNotice =
        document.getElementById("createAuthNotice");

    const message =
        document.getElementById("proposalMessage");

    const submitButton =
        document.getElementById("proposalSubmit");

    const submitDisclaimer =
        document.getElementById("submitDisclaimer");

    const introDescription =
        document.getElementById("createIntroDescription");

    const allowedRoles = [
        "student",
        "uc",
        "nuclei"
    ];

    let currentUser = null;
    let sessionChecked = false;
    let submitting = false;

    function isOrganization() {
        return currentUser &&
            ["uc", "nuclei"].includes(currentUser.role);
    }

    function canSubmit() {
        return (
            sessionChecked &&
            currentUser &&
            allowedRoles.includes(currentUser.role)
        );
    }

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.dataset.state = text ? type : "";
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

    function getMinimumDeadline() {

        const tomorrow = new Date(
            `${getPortugalToday()}T12:00:00Z`
        );

        tomorrow.setUTCDate(
            tomorrow.getUTCDate() + 1
        );

        return tomorrow.toISOString().slice(0, 10);
    }

    function setDeadlineMinimum() {

        const minimum = getMinimumDeadline();

        deadlineInput.min = minimum;

        if (!deadlineInput.value) {
            deadlineInput.value = minimum;
        }
    }

    function updateDescriptionCount() {
        descriptionCount.textContent =
            `${descriptionInput.value.length} / 3000`;
    }

    descriptionInput.addEventListener(
        "input",
        updateDescriptionCount
    );

    function configureStudentInterface() {

        anonymousOption.hidden = false;
        privacyNote.hidden = false;

        organizationIdentityNotice.hidden = true;

        anonymousInput.disabled = false;
        publicInput.disabled = false;

        submitButton.textContent = "SEND";

        submitDisclaimer.textContent =
            "Your proposal will be reviewed by an " +
            "administrator before it becomes public.";

        introDescription.textContent =
            "Share an idea to improve university life " +
            "and help shape your community.";
    }

    function configureOrganizationInterface() {

        const organizationName =
            currentUser.organization ||
            currentUser.name ||
            "Your organization";

        publicInput.checked = true;

        anonymousInput.disabled = true;
        publicInput.disabled = true;

        anonymousOption.hidden = true;
        privacyNote.hidden = true;

        organizationIdentityNotice.hidden = false;

        organizationIdentityNotice.textContent =
            `Publishing as ${organizationName}. ` +
            "Your organization's name will appear publicly.";

        submitButton.textContent = "PUBLISH";

        submitDisclaimer.textContent =
            "Your proposal will be published immediately, " +
            "without administrator approval.";

        introDescription.textContent =
            "Publish an official initiative and " +
            "invite students to participate.";
    }

    /* AUTHENTICATION */

    async function checkAuthentication() {

        submitButton.disabled = true;

        sessionChecked = false;
        currentUser = null;

        try {

            const response = await fetch(
                "/api/auth/me",
                {
                    credentials: "same-origin"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to check your session."
                );
            }

            const data = await response.json();

            currentUser = data.user || null;
            sessionChecked = true;

            if (!currentUser) {

                authNotice.hidden = false;

                const link = document.createElement("a");

                link.href = "login.html";
                link.textContent = "sign in";

                authNotice.replaceChildren(
                    document.createTextNode("Please "),
                    link,
                    document.createTextNode(
                        " to submit a proposal."
                    )
                );

                return;
            }

            if (!allowedRoles.includes(currentUser.role)) {

                authNotice.hidden = false;

                authNotice.textContent =
                    "Your account does not have permission " +
                    "to create proposals.";

                return;
            }

            if (currentUser.role === "student") {
                configureStudentInterface();
            } else {
                configureOrganizationInterface();
            }

            authNotice.hidden = true;
            submitButton.disabled = false;

        } catch (error) {

            console.error(
                "Authentication check error:",
                error
            );

            authNotice.hidden = false;

            authNotice.textContent =
                "Unable to verify your session. " +
                "Please refresh the page.";
        }
    }

    form.addEventListener("submit", async event => {

        event.preventDefault();

        if (submitting) return;

        showMessage("");

        if (!canSubmit()) {

            showMessage(
                "Please sign in with an authorized account."
            );

            return;
        }

        const title = titleInput.value.trim();

        const category = categoryInput.value;

        const description =
            descriptionInput.value.trim();

        const anonymous =
            currentUser.role === "student" &&
            anonymousInput.checked;

        const votingDeadline = deadlineInput.value;

        setDeadlineMinimum();

        if (title.length < 5 || title.length > 120) {

            showMessage(
                "Title must contain between 5 and 120 characters."
            );

            return;
        }

        if (
            description.length < 30 ||
            description.length > 3000
        ) {

            showMessage(
                "Description must contain between " +
                "30 and 3000 characters."
            );

            return;
        }

        if (!category) {

            showMessage(
                "Please select a category."
            );

            return;
        }

        if (
            !votingDeadline ||
            votingDeadline < deadlineInput.min
        ) {

            showMessage(
                "Please select a voting deadline " +
                "of tomorrow or later."
            );

            return;
        }

        submitting = true;
        submitButton.disabled = true;

        submitButton.textContent =
            isOrganization()
                ? "PUBLISHING..."
                : "SENDING...";

        try {

            const response = await fetch(
                "/api/proposals",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "same-origin",

                    body: JSON.stringify({
                        title,
                        category,
                        description,
                        anonymous,
                        votingDeadline
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Unable to submit proposal."
                );
            }

            showMessage(
                data.message || (
                    isOrganization()
                        ? "Proposal published successfully!"
                        : "Proposal submitted for review!"
                ),
                "success"
            );

            form.reset();

            publicInput.checked = true;

            updateDescriptionCount();
            setDeadlineMinimum();

        } catch (error) {

            console.error(
                "Proposal submission error:",
                error
            );

            showMessage(
                error.message ||
                "Something went wrong."
            );

        } finally {

            submitting = false;

            submitButton.disabled = !canSubmit();

            submitButton.textContent =
                isOrganization()
                    ? "PUBLISH"
                    : "SEND";
        }
    });

    updateDescriptionCount();
    setDeadlineMinimum();
    checkAuthentication();

})();
