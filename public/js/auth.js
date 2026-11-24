(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const register = Boolean($("registerForm"));
    const mode = register ? "register" : "login";
    const form = $(`${mode}Form`);
    const message = $(`${mode}Message`);
    const submitButton = $(`${mode}Submit`);

    if (!form || !message || !submitButton) return;

    const email = $("email");
    const password = $("password");
    const name = $("name");
    const confirmPassword = $("confirmPassword");

    if (!email || !password || (register && (!name || !confirmPassword))) {
        console.error("Missing authentication form fields.");
        return;
    }

    const buttonText = register ? "Create account" : "Sign in";
    const loadingText = register ? "Creating account..." : "Signing in...";
    const errorText = register
        ? "Unable to create account."
        : "Unable to sign in. Please try again.";

    function showMessage(text = "", success = false) {
        message.textContent = text;
        message.classList.toggle("success", success);
    }

    function setLoading(loading) {
        submitButton.disabled = loading;
        submitButton.textContent = loading ? loadingText : buttonText;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submitButton.disabled) return;

        showMessage();

        const payload = {
            email: email.value.trim(),
            password: password.value
        };

        if (register) {
            if (password.value !== confirmPassword.value) {
                showMessage("Passwords do not match.");
                return;
            }

            if (password.value.length < 8 || password.value.length > 72) {
                showMessage("Password must contain between 8 and 72 characters.");
                return;
            }

            payload.name = name.value.trim();
        }

        setLoading(true);

        try {
            const response = await fetch(`/api/auth/${mode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data) {
                throw new Error(data?.error || errorText);
            }

            if (!register) {
                window.location.replace("index.html");
                return;
            }

            form.reset();
            showMessage(
                data.message || "Account created! Check your email to verify your account.",
                true
            );
        } catch (error) {
            showMessage(error.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    });
})();