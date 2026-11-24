(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const form = $("proposalForm");

    if (!form) return;

    const titleInput = $("proposalTitle");
    const categoryInput = $("proposalCategory");
    const descriptionInput = $("proposalDescription");
    const deadlineInput = $("proposalDeadline");
    const anonymousInput = $("proposalAnonymous");
    const publicInput = $("proposalPublic");
    const anonymousOption = $("anonymousOption");
    const privacyNote = $("privacyNote");
    const organizationIdentityNotice = $("organizationIdentityNotice");
    const descriptionCount = $("descriptionCount");
    const authNotice = $("createAuthNotice");
    const message = $("proposalMessage");
    const submitButton = $("proposalSubmit");
    const submitDisclaimer = $("submitDisclaimer");
    const introDescription = $("createIntroDescription");

    const allowedRoles = ["student", "uc", "nuclei"];

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    let currentUser = null;
    let submitting = false;

    const isOrganization = () => ["uc", "nuclei"].includes(currentUser?.role);
    const canSubmit = () => allowedRoles.includes(currentUser?.role);

    function showMessage(text = "", type = "error") {
        message.textContent = text;
        message.dataset.state = text ? type : "";
    }

    function getMinimumDeadline() {
        const parts = dateFormatter.formatToParts(new Date());
        const get = type => parts.find(part => part.type === type).value;

        const tomorrow = new Date(
            `${get("year")}-${get("month")}-${get("day")}T12:00:00Z`
        );

        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        return tomorrow.toISOString().slice(0, 10);
    }

    function setDeadlineMinimum() {
        deadlineInput.min = getMinimumDeadline();

        if (!deadlineInput.value) {
            deadlineInput.value = deadlineInput.min;
        }
    }

    function updateDescriptionCount() {
        descriptionCount.textContent =
            `${descriptionInput.value.length} / ${descriptionInput.maxLength}`;
    }

    function setSubmitting(busy) {
        submitting = busy;
        submitButton.disabled = busy || !canSubmit();

        const label = isOrganization() ? "PUBLISH" : "SEND";

        submitButton.textContent = busy ? `${label}ING...` : label;
    }

    async function fetchJSON(url, options = {}, fallback = "Something went wrong.") {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
            throw new Error(data?.error || fallback);
        }

        return data;
    }

    function configureInterface() {
        const organization = isOrganization();

        anonymousOption.hidden = organization;
        privacyNote.hidden = organization;
        organizationIdentityNotice.hidden = !organization;

        anonymousInput.disabled = organization;
        publicInput.disabled = organization;

        if (organization) {
            publicInput.checked = true;

            const name = currentUser.organization ||
                currentUser.name ||
                "Your organization";

            organizationIdentityNotice.textContent =
                `Publishing as ${name}. Your organization's name will appear publicly.`;

            submitDisclaimer.textContent =
                "Your proposal will be published immediately, without administrator approval.";

            introDescription.textContent =
                "Publish an official initiative and invite students to participate.";
        } else {
            organizationIdentityNotice.textContent = "";

            submitDisclaimer.textContent =
                "Your proposal will be reviewed by an administrator before it becomes public.";

            introDescription.textContent =
                "Share an idea to improve university life and help shape your community.";
        }

        authNotice.hidden = true;
        setSubmitting(false);
    }

    function showSignInNotice() {
        const link = document.createElement("a");

        link.href = "login.html";
        link.textContent = "sign in";

        authNotice.replaceChildren(
            document.createTextNode("Please "),
            link,
            document.createTextNode(" to submit a proposal.")
        );

        authNotice.hidden = false;
    }

    async function checkAuthentication() {
        currentUser = null;
        submitButton.disabled = true;

        try {
            const data = await fetchJSON("/api/auth/me");

            currentUser = data.user || null;

            if (!currentUser) {
                showSignInNotice();
                return;
            }

            if (!canSubmit()) {
                authNotice.textContent =
                    "Your account does not have permission to create proposals.";

                authNotice.hidden = false;
                return;
            }

            configureInterface();

        } catch (error) {
            currentUser = null;
            submitButton.disabled = true;

            authNotice.textContent =
                "Unable to verify your session. Please refresh the page.";

            authNotice.hidden = false;

            console.error("Authentication check error:", error);
        }
    }

    function getProposalData() {
        return {
            title: titleInput.value.trim(),
            category: categoryInput.value,
            description: descriptionInput.value.trim(),
            anonymous: currentUser?.role === "student" && anonymousInput.checked,
            votingDeadline: deadlineInput.value
        };
    }

    function validateProposal(proposal) {
        const { title, description, category, votingDeadline } = proposal;

        if (title.length < 5 || title.length > 120) {
            return "Title must contain between 5 and 120 characters.";
        }

        if (description.length < 30 || description.length > 3000) {
            return "Description must contain between 30 and 3000 characters.";
        }

        if (!category) {
            return "Please select a category.";
        }

        if (!votingDeadline || votingDeadline < deadlineInput.min) {
            return "Please select a voting deadline of tomorrow or later.";
        }

        return "";
    }

    function resetForm() {
        form.reset();
        publicInput.checked = true;

        updateDescriptionCount();
        setDeadlineMinimum();
    }

    async function submitProposal(event) {
        event.preventDefault();

        if (submitting) return;

        showMessage();

        if (!canSubmit()) {
            showMessage("Please sign in with an authorized account.");
            return;
        }

        deadlineInput.min = getMinimumDeadline();

        const proposal = getProposalData();
        const validationError = validateProposal(proposal);

        if (validationError) {
            showMessage(validationError);
            return;
        }

        setSubmitting(true);

        try {
            const data = await fetchJSON("/api/proposals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(proposal)
            }, "Unable to submit proposal.");

            const successMessage = isOrganization()
                ? "Proposal published successfully!"
                : "Proposal submitted for review!";

            showMessage(data.message || successMessage, "success");

            resetForm();

        } catch (error) {
            console.error("Proposal submission error:", error);

            showMessage(error.message || "Something went wrong.");

        } finally {
            setSubmitting(false);
        }
    }

    descriptionInput.addEventListener("input", updateDescriptionCount);
    form.addEventListener("submit", submitProposal);

    updateDescriptionCount();
    setDeadlineMinimum();
    checkAuthentication();
})();