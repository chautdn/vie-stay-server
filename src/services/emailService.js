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

  // Template cho email yêu cầu ký hợp đồng
  generateContractSigningTemplate(data) {
    const {
      tenantName,
      landlordName,
      roomName,
      accommodationName,
      amount,
      transactionId,
      signingUrl,
      startDate,
      monthlyRent,
    } = data;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ký hợp đồng thuê nhà</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(to right, #4CAF50, #45a049);
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    .button {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
      font-size: 16px;
    }
    .details {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
      border-left: 4px solid #4CAF50;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #888;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 Vui lòng ký hợp đồng thuê nhà</h1>
  </div>
  
  <div class="content">
    <p>Xin chào <strong>${tenantName}</strong>,</p>
    
    <p>Thanh toán tiền cọc của bạn đã được xác nhận. Vui lòng hoàn tất quá trình bằng cách ký hợp đồng thuê nhà qua liên kết dưới đây.</p>
    
    <div class="details">
      <h4>📋 Thông tin hợp đồng:</h4>
      <ul>
        <li><strong>Phòng:</strong> ${roomName}</li>
        <li><strong>Tòa nhà:</strong> ${accommodationName}</li>
        <li><strong>Ngày bắt đầu thuê:</strong> ${new Date(startDate).toLocaleDateString("vi-VN")}</li>
        <li><strong>Giá thuê cơ bản:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(monthlyRent)}/tháng</li>
        <li><strong>Tiền cọc:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)}</li>
        <li><strong>Mã giao dịch:</strong> ${transactionId}</li>
      </ul>
    </div>
    
    <div style="text-align: center;">
      <a href="${signingUrl}" class="button">
        ✅ Ký hợp đồng ngay
      </a>
    </div>
    
    <p><strong>Lưu ý:</strong> Vui lòng ký hợp đồng trong vòng 48 giờ để hoàn tất quy trình thuê nhà.</p>
    
    <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline.</p>
    
    <p>Trân trọng,<br><strong>Đội ngũ Vie Stay</strong></p>
  </div>
  
  <div class="footer">
    <p>Đây là email tự động, vui lòng không trả lời email này.</p>
    <p>© ${new Date().getFullYear()} Vie Stay. Tất cả quyền được bảo lưu.</p>
  </div>
</body>
</html>
    `;
  }

  // Template cho email xác nhận hợp đồng
  generateAgreementConfirmationTemplate(data) {
    const {
      tenantName,
      landlordName,
      roomName,
      accommodationName,
      monthlyRent,
      deposit,
      startDate,
      confirmationToken,
      baseUrl,
      utilityRates,
      additionalFees,
    } = data;

    const confirmationLink = `${baseUrl}/agreement/confirm/${confirmationToken}`;

    // Tính tổng chi phí hàng tháng
    let totalMonthlyCost = monthlyRent;
    let utilityInfo = "";

    if (utilityRates) {
      if (utilityRates.water && utilityRates.water.type === "fixed") {
        totalMonthlyCost += utilityRates.water.rate;
        utilityInfo += `<li>Nước: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.water.rate)}/tháng (cố định)</li>`;
      } else if (utilityRates.water) {
        utilityInfo += `<li>Nước: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.water.rate)}/m³</li>`;
      }

      if (
        utilityRates.electricity &&
        utilityRates.electricity.type === "fixed"
      ) {
        totalMonthlyCost += utilityRates.electricity.rate;
        utilityInfo += `<li>Điện: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.electricity.rate)}/tháng (cố định)</li>`;
      } else if (utilityRates.electricity) {
        utilityInfo += `<li>Điện: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.electricity.rate)}/kWh</li>`;
      }

      if (utilityRates.internet && utilityRates.internet.rate) {
        totalMonthlyCost += utilityRates.internet.rate;
        utilityInfo += `<li>Internet: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.internet.rate)}/tháng</li>`;
      }

      if (utilityRates.sanitation && utilityRates.sanitation.rate) {
        totalMonthlyCost += utilityRates.sanitation.rate;
        utilityInfo += `<li>Vệ sinh: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(utilityRates.sanitation.rate)}/tháng</li>`;
      }
    }

    // Thông tin phí bổ sung
    let additionalFeesInfo = "";
    if (additionalFees && additionalFees.length > 0) {
      additionalFees.forEach((fee) => {
        if (fee.type === "monthly") {
          totalMonthlyCost += fee.amount;
        }
        const feeTypeName = {
          parking: "Gửi xe",
          security: "Bảo vệ",
          maintenance: "Bảo trì",
          cleaning: "Dọn dẹp",
          other: "Khác",
        };
        additionalFeesInfo += `<li>${feeTypeName[fee.name] || fee.name}: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(fee.amount)}${fee.type === "monthly" ? "/tháng" : " (một lần)"}</li>`;
      });
    }

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận hợp đồng thuê nhà</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(to right, #4CAF50, #45a049);
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    .button {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
      font-size: 16px;
    }
    .details {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      border-left: 4px solid #4CAF50;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
    }
    .cost-breakdown {
      background: #e8f5e8;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #888;
      font-size: 0.8em;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .highlight {
      color: #4CAF50;
      font-weight: bold;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Yêu cầu thuê nhà được chấp nhận!</h1>
  </div>
  
  <div class="content">
    <p>Xin chào <strong>${tenantName}</strong>,</p>
    
    <p>Chúc mừng! Yêu cầu thuê nhà của bạn đã được <strong>${landlordName}</strong> chấp nhận.</p>
    
    <div class="details">
      <h3>📋 Chi tiết hợp đồng thuê nhà:</h3>
      <ul>
        <li><strong>Phòng:</strong> ${roomName}</li>
        <li><strong>Tòa nhà:</strong> ${accommodationName}</li>
        <li><strong>Thời gian thuê: Bắt đầu từ</strong> ${new Date(startDate).toLocaleDateString("vi-VN")} </li>
        <li><strong>Giá thuê cơ bản:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(monthlyRent)}/tháng</li>
        <li><strong>Tiền cọc:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(deposit)}</li>
      </ul>
    </div>

    ${
      utilityInfo
        ? `
    <div class="cost-breakdown">
      <h4>⚡ Chi phí tiện ích:</h4>
      <ul>${utilityInfo}</ul>
    </div>
    `
        : ""
    }

    ${
      additionalFeesInfo
        ? `
    <div class="cost-breakdown">
      <h4>💰 Phí bổ sung:</h4>
      <ul>${additionalFeesInfo}</ul>
    </div>
    `
        : ""
    }

    <div class="cost-breakdown">
      <h4>📊 Tổng chi phí hàng tháng (ước tính):</h4>
      <p class="highlight">${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalMonthlyCost)}</p>
      <small>* Chưa bao gồm các chi phí tiện ích theo sử dụng thực tế</small>
    </div>

    <div class="warning">
      <p><strong>⚠️ Các bước tiếp theo:</strong></p>
      <ol>
        <li><strong>Bước 1:</strong> Xác nhận hợp đồng bằng cách click vào nút bên dưới</li>
        <li><strong>Bước 2:</strong> Thanh toán tiền cọc để đảm bảo phòng</li>
        <li><strong>Bước 3:</strong> Hợp đồng sẽ có hiệu lực sau khi thanh toán thành công</li>
      </ol>
      <p><strong>Lưu ý:</strong> Bạn có 48 giờ để hoàn tất quá trình này. Sau thời gian đó, yêu cầu sẽ tự động hết hạn.</p>
    </div>

    <div style="text-align: center;">
      <a href="${confirmationLink}" class="button">
        ✅ Xác nhận hợp đồng ngay
      </a>
    </div>

    <p>Nếu bạn có bất kỳ câu hỏi nào về hợp đồng hoặc cần hỗ trợ, vui lòng liên hệ với chúng tôi qua email hoặc hotline.</p>
    
    <p>Trân trọng,<br><strong>Đội ngũ Vie Stay</strong></p>
  </div>
  
  <div class="footer">
    <p>Đây là email tự động, vui lòng không trả lời email này.</p>
    <p>© ${new Date().getFullYear()} Vie Stay. Tất cả quyền được bảo lưu.</p>
  </div>
</body>
</html>
    `;
  }

  // Template email thanh toán thành công
  generatePaymentSuccessTemplate(data) {
    const {
      tenantName,
      amount,
      transactionId,
      roomName,
      accommodationName,
      startDate,
      landlordContact,
    } = data;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanh toán thành công</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(to right, #4CAF50, #45a049);
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    .success-box {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
      text-align: center;
    }
    .details {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #888;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>💰 Thanh toán thành công!</h1>
  </div>
  
  <div class="content">
    <p>Xin chào <strong>${tenantName}</strong>,</p>
    
    <div class="success-box">
      <h3>✅ Thanh toán tiền cọc thành công!</h3>
      <p>Hợp đồng thuê nhà của bạn đã được kích hoạt.</p>
    </div>
    
    <div class="details">
      <h4>📋 Thông tin thanh toán:</h4>
      <ul>
        <li><strong>Số tiền:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)}</li>
        <li><strong>Mã giao dịch:</strong> ${transactionId}</li>
        <li><strong>Thời gian:</strong> ${new Date().toLocaleString("vi-VN")}</li>
        <li><strong>Loại thanh toán:</strong> Tiền cọc thuê nhà</li>
      </ul>
    </div>

    <div class="details">
      <h4>🏠 Thông tin phòng:</h4>
      <ul>
        <li><strong>Phòng:</strong> ${roomName}</li>
        <li><strong>Tòa nhà:</strong> ${accommodationName}</li>
        <li><strong>Ngày bắt đầu thuê:</strong> ${new Date(startDate).toLocaleDateString("vi-VN")}</li>
      </ul>
    </div>

    <div class="success-box">
      <h4>🎉 Chào mừng bạn đến với Vie Stay!</h4>
      <p>Hợp đồng thuê nhà của bạn đã có hiệu lực từ ngày ${new Date(startDate).toLocaleDateString("vi-VN")}.</p>
    </div>

    ${
      landlordContact
        ? `
    <div class="details">
      <h4>📞 Thông tin liên hệ chủ nhà:</h4>
      <p>Để nhận chìa khóa và hoàn tất thủ tục nhận phòng, vui lòng liên hệ:</p>
      <ul>
        <li><strong>Tên:</strong> ${landlordContact.name}</li>
        <li><strong>Email:</strong> ${landlordContact.email}</li>
        ${landlordContact.phone ? `<li><strong>Điện thoại:</strong> ${landlordContact.phone}</li>` : ""}
      </ul>
    </div>
    `
        : ""
    }

    <p><strong>Lưu ý quan trọng:</strong></p>
    <ul>
      <li>Vui lòng lưu lại email này làm bằng chứng thanh toán</li>
      <li>Liên hệ chủ nhà để sắp xếp thời gian nhận phòng</li>
      <li>Mang theo CMND/CCCD khi nhận phòng</li>
    </ul>
    
    <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ Vie Stay!</p>
    
    <p>Trân trọng,<br><strong>Đội ngũ Vie Stay</strong></p>
  </div>
  
  <div class="footer">
    <p>Đây là email tự động, vui lòng không trả lời email này.</p>
    <p>Nếu cần hỗ trợ, vui lòng liên hệ: support@viestay.com</p>
    <p>© ${new Date().getFullYear()} Vie Stay. Tất cả quyền được bảo lưu.</p>
  </div>
</body>
</html>
    `;
  }

  // Template cho email hoàn thành hợp đồng
  generateContractCompletedTemplate(data) {
    const {
      tenantName,
      landlordName,
      roomName,
      accommodationName,
      startDate,
      endDate,
      monthlyRent,
      deposit,
      tenantContact,
      landlordContact,
    } = data;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hợp đồng đã hoàn thành</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(to right, #28a745, #20c997);
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    .success-box {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
      text-align: center;
    }
    .details {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
      border-left: 4px solid #28a745;
    }
    .contact-box {
      background: #e8f4fd;
      border: 1px solid #bee5eb;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #888;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Hợp đồng thuê nhà đã hoàn thành!</h1>
  </div>
  
  <div class="content">
    <div class="success-box">
      <h3>✅ Hợp đồng đã được ký thành công!</h3>
      <p>Cả hai bên đã hoàn tất việc ký hợp đồng thuê nhà.</p>
    </div>
    
    <div class="details">
      <h4>👥 Thông tin các bên:</h4>
      <ul>
        <li><strong>Người thuê:</strong> ${tenantName}</li>
        <li><strong>Chủ nhà:</strong> ${landlordName}</li>
      </ul>
    </div>

    <div class="details">
      <h4>🏠 Thông tin hợp đồng:</h4>
      <ul>
        <li><strong>Phòng:</strong> ${roomName}</li>
        <li><strong>Tòa nhà:</strong> ${accommodationName}</li>
        <li><strong>Thời gian thuê:</strong> ${new Date(startDate).toLocaleDateString("vi-VN")} - ${new Date(endDate).toLocaleDateString("vi-VN")}</li>
        <li><strong>Giá thuê:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(monthlyRent)}/tháng</li>
        <li><strong>Tiền cọc:</strong> ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(deposit)}</li>
      </ul>
    </div>

    <div class="contact-box">
      <h4>📞 Thông tin liên hệ:</h4>
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
        <div style="flex: 1; margin-right: 10px;">
          <h5>👤 Người thuê: ${tenantName}</h5>
          <ul style="list-style: none; padding: 0;">
            <li>📧 ${tenantContact?.email || "N/A"}</li>
            ${tenantContact?.phone ? `<li>📱 ${tenantContact.phone}</li>` : ""}
          </ul>
        </div>
        <div style="flex: 1; margin-left: 10px;">
          <h5>🏠 Chủ nhà: ${landlordName}</h5>
          <ul style="list-style: none; padding: 0;">
            <li>📧 ${landlordContact?.email || "N/A"}</li>
            ${landlordContact?.phone ? `<li>📱 ${landlordContact.phone}</li>` : ""}
          </ul>
        </div>
      </div>
    </div>

    <div class="success-box">
      <h4>📋 Các bước tiếp theo:</h4>
      <p><strong>Dành cho người thuê:</strong></p>
      <ul style="text-align: left;">
        <li>Liên hệ chủ nhà để sắp xếp thời gian nhận phòng</li>
        <li>Chuẩn bị các giấy tờ cần thiết (CMND/CCCD)</li>
        <li>Thanh toán tiền thuê tháng đầu theo thỏa thuận</li>
      </ul>
      
      <p><strong>Dành cho chủ nhà:</strong></p>
      <ul style="text-align: left;">
        <li>Chuẩn bị phòng và trao chìa khóa</li>
        <li>Hướng dẫn người thuê các quy định của tòa nhà</li>
        <li>Trao đổi thông tin liên lạc trực tiếp</li>
      </ul>
    </div>

    <p><strong>Lưu ý quan trọng:</strong></p>
    <ul>
      <li>Hợp đồng có hiệu lực từ ngày ${new Date(startDate).toLocaleDateString("vi-VN")}</li>
      <li>Bản hợp đồng đã ký sẽ được lưu trữ an toàn trong hệ thống</li>
      <li>Cả hai bên có thể tải xuống bản hợp đồng từ tài khoản cá nhân</li>
      <li><strong>Liên hệ trực tiếp:</strong> Hai bên có thể liên hệ qua thông tin email/số điện thoại ở trên</li>
    </ul>
    
    <p>Cảm ơn cả hai bên đã tin tưởng và sử dụng dịch vụ Vie Stay!</p>
    
    <p>Trân trọng,<br><strong>Đội ngũ Vie Stay</strong></p>
  </div>
  
  <div class="footer">
    <p>Đây là email tự động, vui lòng không trả lời email này.</p>
    <p>Nếu cần hỗ trợ, vui lòng liên hệ: support@viestay.com</p>
    <p>© ${new Date().getFullYear()} Vie Stay. Tất cả quyền được bảo lưu.</p>
  </div>
</body>
</html>
    `;
  }

  // Gửi email xác nhận hợp đồng
  async sendAgreementConfirmationEmail(tenantEmail, agreementData) {
    try {
      const mailOptions = {
        from: `"Vie Stay" <${process.env.AUTH_EMAIL}>`,
        to: tenantEmail,
        subject: "Xác nhận hợp đồng thuê nhà",
        html: this.generateAgreementConfirmationTemplate(agreementData),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Agreement confirmation email sent successfully to: ${tenantEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Error sending agreement confirmation email: ${error}`);
      throw error;
    }
  }

  // Gửi email phản hồi báo cáo
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

  // Hàm hỗ trợ cho báo cáo
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

  // Phương thức gửi email tổng quát
  async sendEmail({ to, subject, template, context, cc }) {
    try {
      let htmlContent;
      switch (template) {
        case "paymentSuccess":
          htmlContent = this.generatePaymentSuccessTemplate(context);
          break;
        case "contractSigning":
          htmlContent = this.generateContractSigningTemplate(context);
          break;
        case "agreementConfirmation":
          htmlContent = this.generateAgreementConfirmationTemplate(context);
          break;
        case "contractCompleted":
          htmlContent = this.generateContractCompletedTemplate(context);
          break;
        case "reportResponse":
          htmlContent = REPORT_RESPONSE_TEMPLATE
            .replace('{{userFullname}}', context.userFullname)
            .replace('{{reportId}}', context.reportId)
            .replace('{{reportType}}', this.getReportTypeText(context.reportType))
            .replace('{{reportMessage}}', context.reportMessage || 'Không có')
            .replace('{{reportDate}}', new Date(context.reportDate).toLocaleDateString('vi-VN'))
            .replace('{{postTitle}}', context.postTitle)
            .replace('{{postUrl}}', context.postUrl)
            .replace('{{status}}', this.getStatusText(context.status))
            .replace('{{adminNote}}', context.adminNote || 'Không có ghi chú thêm');
          break;
        default:
          throw new Error("Invalid email template");
      }

      const mailOptions = {
        from: `"Vie Stay" <${process.env.AUTH_EMAIL}>`,
        to,
        cc: cc || [],
        subject,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${result.messageId}`);
      console.log(`Recipients: TO=${to}, CC=${cc ? cc.join(", ") : "none"}`);
      return result;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}

module.exports = new EmailService();