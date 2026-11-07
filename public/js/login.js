(() => {
    const form = document.getElementById("loginForm");
    if (!form) return;

    const message = document.getElementById("loginMessage");
    const submitButton = document.getElementById("loginSubmit");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        message.textContent = "";
        message.style.color = "#b42318";

        submitButton.disabled = true;
        submitButton.textContent = "Signing in...";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to sign in. Please try again."
                );
            }

            window.location.replace("index.html");

        } catch (error) {
            message.textContent = error.message ||
                "Something went wrong. Please try again.";

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Sign in";
        }
    });
})();
