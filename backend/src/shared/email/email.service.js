const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send verification email
const sendVerificationEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    const info = await transporter.sendMail({
      from: `"Genetix" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email - Genetix',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background: #0a0a0f; color: white; padding: 40px; }
              .container { max-width: 500px; margin: 0 auto; background: #1a1a2e; padding: 30px; border-radius: 16px; }
              .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00d4ff, #7c3aed); color: white; text-decoration: none; border-radius: 8px; }
              .footer { color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 style="color: #00d4ff;">Welcome to Genetix! 🚀</h1>
              <p>Click the button below to verify your email address:</p>
              <a href="${verifyUrl}" class="btn">Verify Email</a>
              <p style="color: #9ca3af; margin-top: 20px;">This link expires in 24 hours.</p>
              <p class="footer">If you didn't create an account, please ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  sendVerificationEmail
};