const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS } = require("../config/env");

const transporter = nodemailer.createTransport({
 service: "gmail",
 auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

const sendEmail = (options) => transporter.sendMail(options);

module.exports = { sendEmail };
