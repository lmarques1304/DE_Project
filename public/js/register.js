(() => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    const message = document.getElementById("registerMessage");
    const submitButton = document.getElementById("registerSubmit");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        message.textContent = "";
        message.style.color = "#b42318";

        if (password !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            return;
        }

        if (password.length < 8 || password.length > 72) {
            message.textContent =
                "Password must contain between 8 and 72 characters.";
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to create account."
                );
            }

            message.style.color = "#16803c";
            message.textContent =
                data.message ||
                "Account created! Check your email to verify your account.";

            form.reset();

        } catch (error) {
            message.style.color = "#b42318";
            message.textContent =
                error.message || "Something went wrong. Please try again.";

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Create account";
        }
    });
})();
