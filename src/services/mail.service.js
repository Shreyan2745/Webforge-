// Nodemailer transport wrapper. Uses Ethereal in dev and logs the preview URL.
// TODO(build: notifications): create transporter from config.mail and export sendMail({ to, subject, text, html })

async function sendMail() { throw new Error('sendMail not implemented'); }

module.exports = { sendMail };
