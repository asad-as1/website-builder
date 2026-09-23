// ==================== BREVO EMAIL SERVICE (HTTPS PORT 443) ====================
// Uses Brevo REST API directly so Render.com free tier never blocks ports 465/587

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Helper to ensure production links always point to deployed frontend on Netlify / Render
const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
    return process.env.FRONTEND_URL.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    return 'https://genetix-anx.netlify.app';
  }
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
};

// Core Brevo HTTP API sender
const sendBrevoEmail = async ({ to, toName, subject, html, text, replyTo }) => {
  const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_KEY;
  if (!apiKey) {
    console.error('❌ Brevo API key missing (BREVO_API_KEY or SMTP_KEY in .env)');
    return false;
  }

  const senderEmail = process.env.EMAIL_USER || 'asadansari905811@gmail.com';

  const payload = {
    sender: {
      name: 'Genetix',
      email: senderEmail,
    },
    to: [
      {
        email: to,
        ...(toName ? { name: toName } : {}),
      },
    ],
    subject,
    htmlContent: html,
    textContent: text,
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Brevo API error: ${response.status}`);
  }

  return data;
};

// ==================== BRAND / THEME ====================
const BRAND = {
  name: 'Genetix',
  accent: '#5B3DF5',
  accentDark: '#4429D6',
  ink: '#101322',
  body: '#3F4459',
  muted: '#8A90A6',
  line: '#E6E8F0',
  page: '#F4F5F9',
  card: '#FFFFFF',
  supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER,
  website: getFrontendUrl(),
  address: process.env.COMPANY_ADDRESS || '',
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Escapes user-supplied text so quotes/angle brackets can't break the markup.
const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Hidden line that shows up as the inbox snippet next to the subject.
const preheader = (text) => `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${esc(text)}
  </div>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>
`;

// Outlook-safe button
const button = (url, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${BRAND.accent}" style="border-radius:10px;">
        <a href="${url}"
           style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:10px;background-color:${BRAND.accent};">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const layout = ({ eyebrow, title, snippet, body, footerNote }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${esc(title)}</title>
    <!--[if mso]>
    <style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;width:100%;background-color:${BRAND.page};">
    ${preheader(snippet)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.page};">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

            <!-- Wordmark -->
            <tr>
              <td align="left" style="padding:0 8px 20px;">
                <span style="font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-0.3px;color:${BRAND.ink};">
                  ${BRAND.name}
                </span>
                <span style="display:inline-block;width:6px;height:6px;border-radius:6px;background-color:${BRAND.accent};margin-left:3px;vertical-align:middle;"></span>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="height:4px;background-color:${BRAND.accent};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 36px;">
                      ${
                        eyebrow
                          ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${BRAND.accent};">${esc(
                              eyebrow
                            )}</p>`
                          : ''
                      }
                      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:24px;font-weight:700;line-height:32px;letter-spacing:-0.4px;color:${BRAND.ink};">
                        ${esc(title)}
                      </h1>
                      ${body}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:22px 8px 0;">
                <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:19px;color:${BRAND.muted};">
                  ${footerNote}
                </p>
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:19px;color:${BRAND.muted};">
                  &copy; ${new Date().getFullYear()} ${BRAND.name}${
  BRAND.address ? ` &middot; ${esc(BRAND.address)}` : ''
}
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const p = (html, extra = '') =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${BRAND.body};${extra}">${html}</p>`;

// ==================== VERIFICATION EMAIL ====================
const sendVerificationEmail = async (email, token) => {
  const frontendUrl = getFrontendUrl();
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    const info = await sendBrevoEmail({
      to: email,
      subject: 'Verify your email address',
      text: `Confirm your email to finish setting up your Genetix account.\n\nOpen this link to verify:\n${verifyUrl}\n\nThe link expires in 24 hours. If you didn't sign up, you can ignore this email.`,
      html: layout({
        eyebrow: 'Account setup',
        title: 'Confirm your email address',
        snippet: 'One click to activate your Genetix account. Link expires in 24 hours.',
        body: `
          ${p(
            `Your account is almost ready. Confirm that <strong style="color:${BRAND.ink};font-weight:600;">${esc(
              email
            )}</strong> belongs to you and we'll take you straight to your dashboard.`
          )}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="padding:10px 0 26px;">
              ${button(verifyUrl, 'Verify email address')}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:18px 0 0;border-top:1px solid ${BRAND.line};">
                ${p(
                  `Button not working? Paste this link into your browser:`,
                  'font-size:14px;line-height:22px;margin-bottom:6px;'
                )}
                <p style="margin:0 0 18px;font-family:${FONT};font-size:13px;line-height:21px;word-break:break-all;">
                  <a href="${verifyUrl}" style="color:${BRAND.accent};text-decoration:underline;">${verifyUrl}</a>
                </p>
                ${p(
                  `This link works once and expires in 24 hours.`,
                  `font-size:14px;line-height:22px;color:${BRAND.muted};margin-bottom:0;`
                )}
              </td>
            </tr>
          </table>
        `,
        footerNote: `You're receiving this because someone signed up for ${BRAND.name} with this address. If that wasn't you, no action is needed — the account stays inactive until it's verified.`,
      }),
    });

    console.log(`✅ [Brevo API] Verification email sent to ${email}:`, info?.messageId);
    return true;
  } catch (error) {
    console.error(`❌ [Brevo API] Verification email failed for ${email}:`, error.message);
    return false;
  }
};

// ==================== CONTACT EMAIL ====================
const sendContactEmail = async ({ name, email, projectName, changes, budget, priority, attachment }) => {
  try {
    const priorityEmoji = priority === 'urgent' ? '🔴' : priority === 'low' ? '🟢' : '🟡';

    const row = (label, value) => `
      <tr>
        <td width="34%" style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.muted};vertical-align:top;">
          ${label}
        </td>
        <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.ink};font-weight:600;vertical-align:top;">
          ${value}
        </td>
      </tr>
    `;

    // Attachment section
    const attachmentSection = attachment?.url ? `
      <p style="margin:26px 0 10px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${BRAND.muted};">
        Attachment
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
        <tr>
          <td style="padding:14px 16px;background-color:#F7F8FC;border:1px solid ${BRAND.line};border-radius:10px;">
            <a href="${attachment.url}" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:${BRAND.ink};font-family:${FONT};">
              <span style="font-size:20px;">${attachment.type === 'image' ? '🖼️' : '📄'}</span>
              <span style="font-size:14px;font-weight:600;">${esc(attachment.fileName || 'Attachment')}</span>
            </a>
            <p style="margin:6px 0 0;font-family:${FONT};font-size:12px;color:${BRAND.muted};">
              <a href="${attachment.url}" style="color:${BRAND.accent};text-decoration:underline;">Open / Download</a>
            </p>
          </td>
        </tr>
      </table>
    ` : '';

    const adminEmail = process.env.EMAIL_USER || 'asadansari905811@gmail.com';

    const info = await sendBrevoEmail({
      to: adminEmail,
      replyTo: email,
      subject: `${priorityEmoji} New Custom Request - ${name}`,
      text: `New custom change request\n\nFrom: ${name} (${email})\nProject: ${
        projectName || 'Not specified'
      }\nBudget: ${budget}\nPriority: ${priority}\n${attachment?.url ? `\nAttachment: ${attachment.url}\n` : ''}\nChanges required:\n${changes}`,
      html: layout({
        eyebrow: 'New enquiry',
        title: 'Custom change request',
        snippet: `${name} — ${priority} priority — budget ${budget}`,
        body: `
          ${p(
            `Reply directly to this email to reach <strong style="color:${BRAND.ink};font-weight:600;">${esc(
              name
            )}</strong>, or respond from the admin panel to log it against the request.`,
            'font-size:15px;line-height:24px;'
          )}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px;border-top:1px solid ${BRAND.line};">
            ${row('Name', esc(name))}
            ${row(
              'Email',
              `<a href="mailto:${esc(email)}" style="color:${BRAND.accent};text-decoration:none;font-weight:600;">${esc(
                email
              )}</a>`
            )}
            ${row('Project', esc(projectName || 'Not specified'))}
            ${row('Budget', esc(budget))}
            ${row('Priority', `${priorityEmoji} ${esc(priority)}`)}
          </table>

          <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${BRAND.muted};">
            Changes required
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:18px 20px;background-color:#F7F8FC;border:1px solid ${BRAND.line};border-radius:10px;">
                <p style="margin:0;white-space:pre-wrap;font-family:${FONT};font-size:15px;line-height:25px;color:${BRAND.body};">${esc(
                  changes
                )}</p>
              </td>
            </tr>
          </table>

          ${attachmentSection}
        `,
        footerNote: `Sent automatically from the ${BRAND.name} contact form.`,
      }),
    });

    console.log(`✅ [Brevo API] Contact email sent:`, info?.messageId);
    return true;
  } catch (error) {
    console.error('❌ [Brevo API] Contact email error:', error.message);
    return false;
  }
};

// ==================== ADMIN REPLY EMAIL ====================
const sendAdminReplyEmail = async ({ name, email, changes, adminReply }) => {
  try {
    const info = await sendBrevoEmail({
      to: email,
      toName: name,
      subject: 'Re: Your Custom Change Request - Genetix',
      text: `Hi ${name},\n\nHere's our reply to your request:\n\n${adminReply}\n\n---\nYour original request:\n${changes}\n\nReply to this email to continue the conversation.`,
      html: layout({
        eyebrow: 'Reply from the team',
        title: `Hi ${esc(name)}, here's our response`,
        snippet: 'We’ve reviewed your custom change request.',
        body: `
          ${p(
            `Thanks for sending this over. Our reply is below — just hit reply if anything needs clarifying.`
          )}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;">
            <tr>
              <td style="padding:20px 22px;background-color:#F5F3FF;border-left:3px solid ${BRAND.accent};border-radius:0 10px 10px 0;">
                <p style="margin:0;white-space:pre-wrap;font-family:${FONT};font-size:16px;line-height:26px;color:${BRAND.ink};">${esc(
                  adminReply
                )}</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${BRAND.muted};">
            Your original request
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding:18px 20px;background-color:#F7F8FC;border:1px solid ${BRAND.line};border-radius:10px;">
                <p style="margin:0;white-space:pre-wrap;font-family:${FONT};font-size:14px;line-height:24px;color:${BRAND.muted};">${esc(
                  changes
                )}</p>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="padding-top:4px;">
              ${button(`${BRAND.website}/dashboard`, 'View in your account')}
            </td></tr>
          </table>
        `,
        footerNote: `Replies to this email go straight to our team at ${esc(BRAND.supportEmail || '')}.`,
      }),
    });

    console.log(`✅ [Brevo API] Admin reply email sent:`, info?.messageId);
    return true;
  } catch (error) {
    console.error('❌ [Brevo API] Admin reply email error:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendContactEmail,
  sendAdminReplyEmail,
};