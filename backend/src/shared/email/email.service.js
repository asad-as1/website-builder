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

// ==================== CONTACT EMAIL ====================
const sendContactEmail = async ({ name, email, projectName, changes, budget, priority }) => {
  try {
    const priorityEmoji = priority === 'urgent' ? '🔴' : priority === 'low' ? '🟢' : '🟡';
    
    const info = await transporter.sendMail({
      from: `"Genetix Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `${priorityEmoji} New Custom Request - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0f; color: white; border-radius: 12px;">
          <h2 style="color: #00d4ff;">New Custom Change Request</h2>
          
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Project:</strong> ${projectName || 'Not specified'}</p>
            <p><strong>Budget:</strong> ${budget}</p>
            <p><strong>Priority:</strong> ${priorityEmoji} ${priority}</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px;">
            <h3 style="color: #00d4ff; margin-top: 0;">Changes Required:</h3>
            <p style="white-space: pre-wrap;">${changes}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Login to admin panel to reply.
          </p>
        </div>
      `,
    });
    console.log(`✅ Contact email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Contact email error:', error.message);
    return false;
  }
};

// ==================== ADMIN REPLY EMAIL ====================
const sendAdminReplyEmail = async ({ name, email, changes, adminReply }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Genetix" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Re: Your Custom Change Request - Genetix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0f; color: white; border-radius: 12px;">
          <h2 style="color: #00d4ff;">Hi ${name}, 👋</h2>
          
          <p>Thanks for your request! Here's our reply:</p>
          
          <div style="background: rgba(0, 212, 255, 0.1); padding: 20px; border-radius: 8px; border-left: 3px solid #00d4ff; margin: 20px 0;">
            <p style="white-space: pre-wrap; color: #e5e7eb;">${adminReply}</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #00d4ff; margin-top: 0; font-size: 14px;">Your Original Request:</h3>
            <p style="white-space: pre-wrap; color: #9ca3af; font-size: 14px;">${changes}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            You can also view this reply in your Genetix account.
          </p>
        </div>
      `,
    });
    console.log(`✅ Admin reply email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Admin reply email error:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendContactEmail,
  sendAdminReplyEmail,
};