const nodemailer = require("nodemailer");
const {
  REPORT_RESPONSE_TEMPLATE,
} = require("../templates/emailTemplates");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASSWORD,
      },
    });
  }

  // Send report response email
  async sendReportResponseEmail(reportData) {
    try {
      const {
        userEmail,
        userFullname,
        reportId,
        reportType,
        reportMessage,
        reportDate,
        postTitle,
        postUrl,
        status,
        adminNote
      } = reportData;

      if (!userEmail) {
        console.log('ℹ️ No email provided, skipping email notification');
        return { success: false, message: 'No email provided' };
      }

      const emailTemplate = REPORT_RESPONSE_TEMPLATE
        .replace('{{userFullname}}', userFullname)
        .replace('{{reportId}}', reportId)
        .replace('{{reportType}}', this.getReportTypeText(reportType))
        .replace('{{reportMessage}}', reportMessage || 'Không có')
        .replace('{{reportDate}}', new Date(reportDate).toLocaleDateString('vi-VN'))
        .replace('{{postTitle}}', postTitle)
        .replace('{{postUrl}}', postUrl)
        .replace('{{status}}', this.getStatusText(status))
        .replace('{{adminNote}}', adminNote || 'Không có ghi chú thêm');

      const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: userEmail,
        subject: `[VieStay] Phản hồi báo cáo #${reportId}`,
        html: emailTemplate,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Report response email sent successfully to:', userEmail);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Error sending report response email:', error);
      throw error;
    }
  }

  getReportTypeText(type) {
    const types = {
      'scam': 'Lừa đảo',
      'duplicate': 'Tin trùng lặp', 
      'cant_contact': 'Không liên lạc được',
      'fake': 'Tin giả',
      'other': 'Khác'
    };
    return types[type] || type;
  }

  getStatusText(status) {
    const statuses = {
      'resolved': 'Đã xử lý',
      'rejected': 'Từ chối',
      'pending': 'Đang chờ',
      'reviewing': 'Đang xem xét'
    };
    return statuses[status] || status;
  }
}

module.exports = new EmailService();
