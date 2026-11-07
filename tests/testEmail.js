require("dotenv").config();

const { sendEmail } = require("../services/email");

async function testEmail() {
    try {
        const result = await sendEmail({
            to: process.env.GMAIL_USER,
            subject: "Instant Democracy — Email Test",
            text: "Success! Instant Democracy can send real emails.",
            html: `
                <div style="font-family: Arial, sans-serif;
                            padding: 30px;">
                    <h1 style="color: #28db25;">
                        Instant Democracy
                    </h1>

                    <p>
                        Success! Your email service is working.
                    </p>

                    <p>
                        You can now receive verification emails.
                    </p>
                </div>
            `
        });

        console.log("Email sent successfully!");
        console.log("Message ID:", result.messageId);

    } catch (error) {
        console.error("Email test failed:", error.message);
        process.exitCode = 1;
    }
}

testEmail();
