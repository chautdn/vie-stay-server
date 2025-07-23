const VERIFICATION_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
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
      background: linear-gradient(to right, #2196F3, #00BCD4);
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
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
    <h1>Verify Your Email</h1>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p>Thank you for signing up! Your verification code is:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2196F3;">{verificationCode}</span>
    </div>
    <p>Enter this code on the verification page to complete your registration.</p>
    <p>This code will expire in 15 minutes for security reasons.</p>
    <p>If you didn't create an account with us, please ignore this email.</p>
    <p>Best regards,<br>Travelofy Team</p>
  </div>
  <div class="footer">
    <p>This is an automated message, please do not reply to this email.</p>   
    <p>© ${new Date().getFullYear()} Travelofy. All rights reserved.</p>
  </div>
</body>
</html>
`;

const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .button {
      display: inline-block;
      background-color: #2196F3;
      color: white;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 30px 0;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Hi {userName},</p>
      <p>We received a request to reset your password for your account. If you didn’t request this, you can safely ignore this email.</p>
      <p>To reset your password, please click the button below:</p>
      <div style="text-align: center;">
        <a href="{resetURL}" class="button">Reset Password</a>
      </div>
      <p>This link will expire in 1 hour for security reasons.</p>
      <p>If you have any questions or need further assistance, feel free to contact our support team.</p>
      <p>Best regards,<br>Travelofy Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message; please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} Travelofy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const REPORT_RESPONSE_TEMPLATE = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phản hồi báo cáo</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
      color: white;
      border-radius: 5px 5px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      color: white;
      background-color: #28a745;
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Phản hồi báo cáo từ VieStay</h1>
    </div>
    
    <div class="content">
      <p>Xin chào <strong>{{userFullname}}</strong>,</p>
      
      <p>Chúng tôi đã xử lý báo cáo của bạn và có phản hồi như sau:</p>
      
      <div class="info-box">
        <h3>📋 Thông tin báo cáo</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Mã báo cáo:</strong> #{{reportId}}</li>
          <li><strong>Loại báo cáo:</strong> {{reportType}}</li>
          <li><strong>Nội dung:</strong> {{reportMessage}}</li>
          <li><strong>Ngày gửi:</strong> {{reportDate}}</li>
          <li><strong>Bài đăng:</strong> <a href="{{postUrl}}">{{postTitle}}</a></li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>✅ Kết quả xử lý</h3>
        <p><strong>Trạng thái:</strong> <span class="status-badge">{{status}}</span></p>
        <p><strong>Ghi chú từ admin:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
          {{adminNote}}
        </p>
      </div>
      
      <p>Cảm ơn bạn đã giúp VieStay cải thiện chất lượng dịch vụ!</p>
      
      <p>Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi.</p>
    </div>
    
    <div class="footer">
      <p>Email này được gửi tự động, vui lòng không trả lời.</p>
      <p>© ${new Date().getFullYear()} VieStay. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = {
  VERIFICATION_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  REPORT_RESPONSE_TEMPLATE,
};
