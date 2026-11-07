const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,

    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

async function sendEmail({ to, subject, text, html }) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error("Email service is not configured.");
    }

    return transporter.sendMail({
        from: `"Instant Democracy" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html
    });
}

module.exports = { sendEmail };
