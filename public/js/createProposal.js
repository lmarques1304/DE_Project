
/* =========================================================
   CREATE PROPOSAL

   Students:
   - Optional anonymity
   - Administrator approval required

   UC / Núcleos:
   - Always publicly identified
   - Automatically published

   Administrators:
   - Cannot submit proposals
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

    const anonymousInput =
        document.getElementById("proposalAnonymous");

    const anonymousOption =
        document.getElementById("anonymousOption");

    const deadlineInput =
        document.getElementById("proposalDeadline");

    const descriptionCount =
        document.getElementById("descriptionCount");

    const message =
        document.getElementById("proposalMessage");

    const submitButton =
        document.getElementById("proposalSubmit");

    const authNotice =
        document.getElementById("createAuthNotice");

    const organizationIdentityNotice =
        document.getElementById("organizationIdentityNotice");

    const submitDisclaimer =
        document.getElementById("submitDisclaimer");

    const reviewStepTitle =
        document.getElementById("reviewStepTitle");

    const reviewStepDescription =
        document.getElementById("reviewStepDescription");

    const thirdStepDescription =
        document.getElementById("thirdStepDescription");

    const privacyCardTitle =
        document.getElementById("privacyCardTitle");

    const privacyCardDescription =
        document.getElementById("privacyCardDescription");

    const createIntroDescription =
        document.getElementById("createIntroDescription");

    const createFormDescription =
        document.getElementById("createFormDescription");

    let currentUser = null;
    let sessionChecked = false;
    let submitting = false;

    const allowedRoles = [
        "student",
        "uc",
        "nuclei"
    ];

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

    function showMessage(text, success = false) {
        message.textContent = text;

        message.style.color = success
            ? "#16803c"
            : "#b42318";
    }

    function getOrganizationName() {
        if (!currentUser) return "";

        return (
            currentUser.organization ||
            currentUser.name ||
            "Your organization"
        );
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
        const today = getPortugalToday();

        const tomorrow = new Date(
            `${today}T12:00:00Z`
        );

        tomorrow.setUTCDate(
            tomorrow.getUTCDate() + 1
        );

        return tomorrow.toISOString().slice(0, 10);
    }

    function updateDeadline() {
        if (!deadlineInput) return;

        const minimumDate = getMinimumDeadline();

        deadlineInput.min = minimumDate;

        if (
            !deadlineInput.value ||
            deadlineInput.value < minimumDate
        ) {
            deadlineInput.value = minimumDate;
        }
    }

    descriptionInput.addEventListener("input", () => {
        descriptionCount.textContent =
            `${descriptionInput.value.length} / 3000`;
    });

    function configureStudentInterface() {
        anonymousOption.hidden = false;

        organizationIdentityNotice.hidden = true;

        anonymousInput.disabled = false;

        submitButton.textContent =
            "Submit proposal";

        submitDisclaimer.textContent =
            "Your proposal will be reviewed by an " +
            "administrator before it becomes public.";

        reviewStepTitle.textContent =
            "Review process";

        reviewStepDescription.textContent =
            "Our administrators review student " +
            "proposals before publication.";

        thirdStepDescription.textContent =
            "Once approved, your proposal becomes " +
            "available for students to vote on.";

        privacyCardTitle.textContent =
            "Your privacy matters.";

        privacyCardDescription.textContent =
            "Anonymous proposals do not display your " +
            "identity publicly. Administrators can " +
            "still identify the author for moderation purposes.";

        createIntroDescription.textContent =
            "Have an idea to improve university life? " +
            "Share your proposal and help shape a better community.";

        createFormDescription.textContent =
            "Tell us what you would like to change. " +
            "Be clear, constructive and respectful.";
    }

    function configureOrganizationInterface() {
        const organizationName =
            getOrganizationName();

        anonymousInput.checked = false;
        anonymousInput.disabled = true;
        anonymousOption.hidden = true;

        organizationIdentityNotice.hidden = false;

        organizationIdentityNotice.textContent =
            `Publishing as: ${organizationName}. ` +
            "Your organization's identity will be " +
            "displayed publicly alongside this proposal.";

        submitButton.textContent =
            "Publish proposal";

        submitDisclaimer.textContent =
            "Your proposal will be published immediately. " +
            "No administrator approval is required.";

        reviewStepTitle.textContent =
            "Immediate publication";

        reviewStepDescription.textContent =
            "Verified organizations can publish proposals " +
            "directly, without administrator approval.";

        thirdStepDescription.textContent =
            "Students can vote on your proposal as soon " +
            "as it is published.";

        privacyCardTitle.textContent =
            "Official organization proposal";

        privacyCardDescription.textContent =
            "This proposal will be publicly attributed " +
            "to your organization. Anonymous publication " +
            "is not available for institutional accounts.";

        createIntroDescription.textContent =
            "Share initiatives with the university " +
            "community and encourage student participation.";

        createFormDescription.textContent =
            `Create an official proposal on behalf of ` +
            `${organizationName}. It will be published immediately.`;
    }

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

                authNotice.replaceChildren(
                    document.createTextNode(
                        "You need to "
                    )
                );

                const link =
                    document.createElement("a");

                link.href = "login.html";
                link.textContent = "sign in";

                authNotice.append(
                    link,
                    document.createTextNode(
                        " before submitting a proposal."
                    )
                );

                submitButton.disabled = true;
                return;
            }

            if (!allowedRoles.includes(currentUser.role)) {
                authNotice.hidden = false;

                authNotice.textContent =
                    "Your account does not have permission " +
                    "to create proposals.";

                submitButton.disabled = true;
                return;
            }

            if (currentUser.role === "student") {
                configureStudentInterface();
            }

            if (isOrganization()) {
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

            submitButton.disabled = true;
        }
    }

    form.addEventListener("submit", async (event) => {
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
            currentUser.role === "student"
                ? anonymousInput.checked
                : false;

        updateDeadline();

        const votingDeadline =
            deadlineInput.value;

        if (
            !votingDeadline ||
            votingDeadline < deadlineInput.min
        ) {
            showMessage(
                "Please select a deadline of tomorrow or later."
            );
            return;
        }

        if (
            title.length < 5 ||
            title.length > 120
        ) {
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
                "Description must contain between 30 and 3000 characters."
            );
            return;
        }

        if (!category) {
            showMessage(
                "Please select a category."
            );
            return;
        }

        submitting = true;
        submitButton.disabled = true;

        submitButton.textContent =
            isOrganization()
                ? "Publishing proposal..."
                : "Submitting proposal...";

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

            const successMessage =
                currentUser.role === "student"
                    ? "Proposal submitted successfully! " +
                      "It is now waiting for administrator approval."
                    : "Proposal published successfully! " +
                      "Students can now vote on it.";

            showMessage(
                data.message || successMessage,
                true
            );

            form.reset();

            descriptionCount.textContent =
                "0 / 3000";

            updateDeadline();

            if (isOrganization()) {
                anonymousInput.checked = false;
            }

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
                    ? "Publish proposal"
                    : "Submit proposal";
        }
    });

    updateDeadline();
    checkAuthentication();

})();