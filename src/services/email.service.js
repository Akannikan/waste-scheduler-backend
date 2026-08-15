const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Base HTML template ────────────────────────────────────────
function baseTemplate(content, title = 'WasteScheduler Nigeria') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F0F7F0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7F0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2E7D32,#1B5E20);border-radius:12px 12px 0 0;padding:30px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">♻️</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;">WasteScheduler</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Nigeria Waste Management System</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:36px 40px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1B5E20;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
            <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">
              © ${new Date().getFullYear()} WasteScheduler Nigeria · Building a Cleaner Nigeria 🇳🇬<br/>
              <span style="color:rgba(255,255,255,0.5);font-size:11px;">This email was sent because you have an account on WasteScheduler.</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Welcome email ─────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  const content = `
    <h2 style="color:#2E7D32;margin:0 0 8px;">Welcome, ${user.name}! 🎉</h2>
    <p style="color:#555;line-height:1.7;margin:0 0 20px;">
      You have successfully joined <strong>WasteScheduler Nigeria</strong> — your smart waste management companion.
      Together, let's build a cleaner, greener Nigeria! 🇳🇬
    </p>

    <div style="background:#F1F8E9;border-left:4px solid #2E7D32;border-radius:8px;padding:20px;margin:0 0 24px;">
      <h3 style="color:#2E7D32;margin:0 0 12px;font-size:15px;">Your Account Details</h3>
      <p style="margin:4px 0;color:#555;font-size:14px;">📧 Email: <strong>${user.email}</strong></p>
      <p style="margin:4px 0;color:#555;font-size:14px;">👤 Role: <strong style="text-transform:capitalize;">${user.role}</strong></p>
      ${user.state ? `<p style="margin:4px 0;color:#555;font-size:14px;">📍 State: <strong>${user.state}</strong></p>` : ''}
    </div>

    <h3 style="color:#333;font-size:15px;margin:0 0 12px;">What you can do:</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['📅', 'View your waste collection schedule'],
        ['🗑️', 'Log your daily waste generation'],
        ['📍', 'Find recycling centers near you'],
        ['🚨', 'Report missed pickups or illegal dumping'],
        ['🎮', 'Play recycling quizzes and earn badges'],
        ['💬', 'Chat with our AI waste assistant'],
      ].map(([icon, text]) => `
      <tr>
        <td style="padding:6px 0;">
          <div style="background:#F9FBE7;border-radius:8px;padding:10px 14px;display:flex;align-items:center;">
            <span style="font-size:18px;margin-right:10px;">${icon}</span>
            <span style="color:#555;font-size:14px;">${text}</span>
          </div>
        </td>
      </tr>`).join('')}
    </table>

    <div style="text-align:center;margin:28px 0 0;">
      <a href="${process.env.CLIENT_URL}" style="background:#2E7D32;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Go to Dashboard →
      </a>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Welcome to WasteScheduler Nigeria, ${user.name}! ♻️`,
    html: baseTemplate(content, 'Welcome to WasteScheduler'),
  });
}

// ── Pickup reminder email ─────────────────────────────────────
async function sendPickupReminderEmail(user, schedule, hoursAway) {
  const when = hoursAway <= 2 ? 'in about 2 hours' : hoursAway <= 24 ? 'tomorrow' : `on ${new Date(schedule.pickupDate).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const urgent = hoursAway <= 2;

  const content = `
    <div style="background:${urgent ? '#FFF3E0' : '#E8F5E9'};border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">${urgent ? '⚠️' : '🗑️'}</div>
      <h2 style="color:${urgent ? '#E65100' : '#2E7D32'};margin:0;font-size:22px;">
        ${urgent ? 'Pickup Starting Soon!' : 'Pickup Reminder'}
      </h2>
      <p style="color:#666;margin:8px 0 0;font-size:15px;">Your ${schedule.category?.name || 'waste'} pickup is <strong>${when}</strong></p>
    </div>

    <h3 style="color:#333;margin:0 0 16px;font-size:15px;">Collection Details</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${[
        ['📦', 'Waste Type', schedule.category?.name || 'General Waste'],
        ['🗑️', 'Use Bin', schedule.category?.binColor || 'Regular Bin'],
        ['📍', 'Zone', schedule.zone?.name || 'Your Zone'],
        ['🕐', 'Date & Time', new Date(schedule.pickupDate).toLocaleString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })],
      ].map(([icon, label, value]) => `
      <tr>
        <td style="padding:10px 12px;background:#F9F9F9;border-bottom:1px solid #eee;border-radius:6px;">
          <span style="font-size:16px;">${icon}</span>
          <span style="color:#888;font-size:13px;margin-left:8px;">${label}</span>
          <strong style="color:#333;font-size:14px;float:right;">${value}</strong>
        </td>
      </tr>`).join('')}
    </table>

    ${schedule.category?.tips?.length ? `
    <div style="background:#F1F8E9;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0 0 8px;color:#2E7D32;font-weight:600;font-size:14px;">💡 Quick Tips</p>
      ${schedule.category.tips.slice(0, 2).map(tip => `<p style="margin:4px 0;color:#555;font-size:13px;">• ${tip}</p>`).join('')}
    </div>` : ''}

    <div style="text-align:center;margin:24px 0 0;">
      <a href="${process.env.CLIENT_URL}/schedule" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View Schedule →
      </a>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `${urgent ? '⚠️ Pickup starting soon!' : '🗑️ Pickup reminder'} — ${schedule.category?.name || 'Waste'} Collection ${when}`,
    html: baseTemplate(content, 'Pickup Reminder'),
  });
}

// ── Report status update email ────────────────────────────────
async function sendReportUpdateEmail(user, report) {
  const statusConfig = {
    under_review: { color: '#1976D2', icon: '🔍', label: 'Under Review', msg: 'Your report is being reviewed by our team.' },
    resolved: { color: '#2E7D32', icon: '✅', label: 'Resolved', msg: 'Your report has been resolved. Thank you for keeping your community clean!' },
    rejected: { color: '#D32F2F', icon: '❌', label: 'Rejected', msg: 'Your report was reviewed but could not be processed at this time.' },
  };

  const config = statusConfig[report.status] || statusConfig['under_review'];
  const typeLabel = { missed_pickup: 'Missed Pickup', illegal_dumping: 'Illegal Dumping', damaged_bin: 'Damaged Bin', other: 'Other' };

  const content = `
    <h2 style="color:#333;margin:0 0 16px;">Report Status Update</h2>
    <div style="background:${config.color}15;border-left:4px solid ${config.color};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:28px;margin-bottom:8px;">${config.icon}</div>
      <h3 style="color:${config.color};margin:0 0 6px;">Status: ${config.label}</h3>
      <p style="color:#555;margin:0;font-size:14px;">${config.msg}</p>
    </div>

    <p style="color:#555;font-size:14px;margin:0 0 16px;">Your report #${report.id} (${typeLabel[report.type] || report.type}) has been updated.</p>

    ${report.adminNotes ? `
    <div style="background:#F9F9F9;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-weight:600;color:#333;font-size:14px;">Admin Notes:</p>
      <p style="margin:0;color:#555;font-size:14px;">${report.adminNotes}</p>
    </div>` : ''}

    <div style="text-align:center;margin-top:24px;">
      <a href="${process.env.CLIENT_URL}/reports" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View My Reports →
      </a>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `${config.icon} Report #${report.id} — ${config.label}`,
    html: baseTemplate(content, 'Report Update'),
  });
}

// ── Bill / charge notification email ─────────────────────────
async function sendBillEmail(user, bill) {
  const content = `
    <h2 style="color:#333;margin:0 0 8px;">Waste Fee Invoice</h2>
    <p style="color:#666;margin:0 0 24px;font-size:14px;">Your waste management fee for ${new Date(bill.year, bill.month - 1).toLocaleString('en-NG', { month: 'long', year: 'numeric' })} is ready.</p>

    <div style="background:#F1F8E9;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#666;font-size:13px;">Amount Due</p>
      <h1 style="color:#2E7D32;margin:0;font-size:40px;font-weight:700;">₦${bill.amountNaira.toLocaleString('en-NG')}</h1>
      <p style="margin:8px 0 0;color:#888;font-size:13px;">Due: ${new Date(bill.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

    <h3 style="color:#333;font-size:15px;margin:0 0 12px;">Payment Instructions</h3>
    <div style="background:#FFF9C4;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;color:#666;font-size:13px;font-weight:600;">Transfer to this account:</p>
      <p style="margin:4px 0;color:#333;font-size:15px;font-weight:700;">🏦 ${process.env.BANK_NAME || 'First Bank Nigeria'}</p>
      <p style="margin:4px 0;color:#333;font-size:15px;">Account: <strong>${process.env.BANK_ACCOUNT_NUMBER || '3012345678'}</strong></p>
      <p style="margin:4px 0;color:#333;font-size:14px;">Name: <strong>${process.env.BANK_ACCOUNT_NAME || 'WasteScheduler Nigeria Ltd'}</strong></p>
    </div>

    <div style="background:#E3F2FD;border-radius:8px;padding:14px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#1565C0;font-size:13px;">
        📸 After payment, upload your transfer proof in the app under <strong>Billing → Upload Proof</strong>
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.CLIENT_URL}/billing" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View Billing →
      </a>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `💳 Waste Fee Invoice — ₦${bill.amountNaira.toLocaleString('en-NG')} Due`,
    html: baseTemplate(content, 'Waste Fee Invoice'),
  });
}

// ── Payment confirmed email ───────────────────────────────────
async function sendPaymentConfirmedEmail(user, payment) {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:56px;">✅</div>
      <h2 style="color:#2E7D32;margin:8px 0 4px;">Payment Confirmed!</h2>
      <p style="color:#666;margin:0;font-size:14px;">Your waste fee payment has been verified.</p>
    </div>

    <div style="background:#F1F8E9;border-radius:10px;padding:20px;margin-bottom:24px;">
      <table width="100%">
        ${[
          ['Amount Paid', `₦${payment.amountNaira.toLocaleString('en-NG')}`],
          ['Reference', payment.transferRef || 'N/A'],
          ['Date', new Date(payment.confirmedAt || payment.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })],
          ['Status', '✅ Confirmed'],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#666;font-size:13px;">${label}</td>
          <td style="padding:6px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${value}</td>
        </tr>`).join('')}
      </table>
    </div>

    <p style="color:#666;font-size:14px;text-align:center;">Thank you for your payment. Keep up the great work towards a cleaner Nigeria! 🇳🇬</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `✅ Payment Confirmed — ₦${payment.amountNaira.toLocaleString('en-NG')}`,
    html: baseTemplate(content, 'Payment Confirmed'),
  });
}

module.exports = {
  sendWelcomeEmail,
  sendPickupReminderEmail,
  sendReportUpdateEmail,
  sendBillEmail,
  sendPaymentConfirmedEmail,
};
async function sendPasswordResetEmail(user, resetUrl) {
  const content = `
    <h2 style="color:#333;margin:0 0 8px;">Password Reset Request</h2>
    <p style="color:#666;margin:0 0 24px;font-size:14px;">
      Hi <strong>${user.name}</strong>, we received a request to reset your WasteScheduler password.
    </p>

    <div style="background:#FFF9C4;border-left:4px solid #F57F17;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#666;font-size:13px;">⏰ This link expires in <strong>1 hour</strong></p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${resetUrl}"
        style="background:linear-gradient(135deg,#2E7D32,#1B5E20);color:#fff;text-decoration:none;
               padding:16px 36px;border-radius:10px;font-size:16px;font-weight:700;
               display:inline-block;letter-spacing:0.3px;">
        Reset My Password →
      </a>
    </div>

    <p style="color:#888;font-size:13px;text-align:center;line-height:1.6;">
      Or copy and paste this link into your browser:<br/>
      <span style="color:#1976D2;font-size:12px;word-break:break-all;">${resetUrl}</span>
    </p>

    <div style="border-top:1px solid #eee;margin-top:24px;padding-top:16px;">
      <p style="color:#999;font-size:12px;text-align:center;margin:0;">
        If you didn't request a password reset, please ignore this email or contact support
        if you're concerned about your account security.
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `🔐 Reset your WasteScheduler password`,
    html: baseTemplate(content, 'Password Reset'),
  });
}

module.exports = {
  sendWelcomeEmail,
  sendPickupReminderEmail,
  sendReportUpdateEmail,
  sendBillEmail,
  sendPaymentConfirmedEmail,
  sendPasswordResetEmail,
};
