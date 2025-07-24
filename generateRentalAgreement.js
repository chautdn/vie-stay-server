require("dotenv").config();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm tạo file PDF với font TimesNewRoman - CHỈ 2 TRANG
function createRentalAgreementPDF(data, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `Hợp đồng thuê nhà - ${data.contractId}`,
          Author: "Vie Stay",
          Subject: "Rental Agreement",
          Creator: "Vie Stay System",
          Producer: "PDFKit",
        },
      });

      // Đăng ký font TimesNewRoman
      const fontPath = path.join(__dirname, "fonts/TimesNewRoman.TTF");
      const fontBoldPath = path.join(__dirname, "fonts/TimesNewRomanBold.TTF");

      if (fs.existsSync(fontPath) && fs.existsSync(fontBoldPath)) {
        doc.registerFont("TimesNewRoman", fontPath);
        doc.registerFont("TimesNewRoman-Bold", fontBoldPath);
      }

      const fontName = fs.existsSync(fontPath) ? "TimesNewRoman" : "Helvetica";
      const fontBold = fs.existsSync(fontBoldPath)
        ? "TimesNewRoman-Bold"
        : "Helvetica-Bold";

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Màu sắc
      const primaryColor = "#1E3A8A";
      const accentColor = "#F59E0B";
      const textColor = "#1F2937";

      // =========================
      // TRANG 1: THÔNG TIN VÀ ĐIỀU KHOẢN
      // =========================

      // Header
      doc.rect(0, 0, doc.page.width, 70).fill(primaryColor);

      // Logo
      const logoPath = path.join(__dirname, "fonts/images.png");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 15, { width: 40, height: 40 });
      }

      // Tiêu đề
      doc
        .fillColor("#FFFFFF")
        .font(fontBold)
        .fontSize(18)
        .text("HỢP ĐỒNG THUÊ NHÀ", 100, 20);

      doc
        .fontSize(9)
        .text(
          `Số: ${data.contractId} | Ngày: ${new Date().toLocaleDateString("vi-VN")}`,
          100,
          40
        );

      // Reset position
      doc.y = 85;

      // BÊN CHO THUÊ - Compact
      doc.rect(40, doc.y, doc.page.width - 80, 20).fill(primaryColor);

      doc
        .fillColor("#FFFFFF")
        .font(fontBold)
        .fontSize(10)
        .text("🏠 BÊN CHO THUÊ (BÊN A)", 50, doc.y + 6);

      doc.y += 25;
      doc
        .fillColor(textColor)
        .font(fontName)
        .fontSize(9)
        .text(
          `Họ tên: ${data.landlordName} | CMND: ${data.landlordIdNumber}`,
          50,
          doc.y
        )
        .text(`Địa chỉ: ${data.landlordAddress}`, 50, doc.y + 12, {
          width: 450,
        })
        .text(`Điện thoại: ${data.landlordPhone}`, 50, doc.y + 24);

      doc.y += 45;

      // BÊN THUÊ - Compact
      doc.rect(40, doc.y, doc.page.width - 80, 20).fill(accentColor);

      doc
        .fillColor("#FFFFFF")
        .font(fontBold)
        .fontSize(10)
        .text("👤 BÊN THUÊ (BÊN B)", 50, doc.y + 6);

      doc.y += 25;
      doc
        .fillColor(textColor)
        .font(fontName)
        .fontSize(9)
        .text(
          `Họ tên: ${data.tenantName} | CMND: ${data.tenantIdNumber}`,
          50,
          doc.y
        )
        .text(`Địa chỉ: ${data.tenantAddress}`, 50, doc.y + 12, {
          width: 450,
        })
        .text(`Điện thoại: ${data.tenantPhone}`, 50, doc.y + 24);

      doc.y += 45;

      // THÔNG TIN TÀI SẢN - Compact
      doc.rect(40, doc.y, doc.page.width - 80, 20).fill(primaryColor);

      doc
        .fillColor("#FFFFFF")
        .font(fontBold)
        .fontSize(10)
        .text("🏢 THÔNG TIN TÀI SẢN", 50, doc.y + 6);

      doc.y += 25;
      doc
        .fillColor(textColor)
        .font(fontName)
        .fontSize(9)
        .text(`Địa chỉ: ${data.propertyAddress}`, 50, doc.y, {
          width: 450,
        })
        .text(`Loại: ${data.propertyType}`, 50, doc.y + 12);

      doc.y += 35;

      // ĐIỀU KHOẢN HỢP ĐỒNG - Compact
      doc
        .fillColor(textColor)
        .font(fontBold)
        .fontSize(11)
        .text("📋 ĐIỀU KHOẢN HỢP ĐỒNG", 50, doc.y);

      doc.y += 20;

      const terms = [
        `⏰ Từ ${new Date(data.startDate).toLocaleDateString("vi-VN")} đến ${new Date(
          data.endDate
        ).toLocaleDateString("vi-VN")}`,
        `💰 Giá thuê: ${new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(data.monthlyRent)}/tháng`,
        `🏦 Tiền cọc: ${new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(data.deposit)}`,
        `💳 Thanh toán: ${data.paymentTerms}`,
        `⚡ Tiện ích: ${data.utilityTerms}`,
      ];

      terms.forEach((term) => {
        doc.font(fontName).fontSize(9).text(term, 60, doc.y, { width: 460 });
        doc.y += 15;
      });

      doc.y += 15;

      // TRÁCH NHIỆM - Compact
      doc.font(fontBold).fontSize(11).text("⚖️ TRÁCH NHIỆM CÁC BÊN", 50, doc.y);

      doc.y += 15;
      doc
        .font(fontName)
        .fontSize(9)
        .text(
          "• Bên A: Cung cấp tài sản đúng mô tả, đảm bảo an toàn pháp lý",
          60,
          doc.y,
          { width: 460 }
        )
        .text(
          "• Bên B: Thanh toán đúng hạn, giữ gìn tài sản, tuân thủ quy định",
          60,
          doc.y + 12,
          { width: 460 }
        );

      doc.y += 35;

      // CAM KẾT
      doc
        .font(fontName)
        .fontSize(9)
        .text(
          "Hai bên đã đọc, hiểu rõ và đồng ý với tất cả các điều khoản trong hợp đồng này.",
          50,
          doc.y,
          { width: doc.page.width - 100, align: "center" }
        );

      // =========================
      // TRANG 2: CHỮ KÝ DUY NHẤT
      // =========================
      doc.addPage();

      // Header trang 2
      doc.rect(0, 0, doc.page.width, 50).fill(primaryColor);

      doc
        .fillColor("#FFFFFF")
        .font(fontBold)
        .fontSize(14)
        .text("✍️ CHỮ KÝ XÁC NHẬN", 0, 15, { align: "center" });

      // Vị trí chữ ký từ giữa trang
      doc.y = 200;

      // Cam kết lại
      doc
        .fillColor(textColor)
        .font(fontName)
        .fontSize(10)
        .text(
          "Hai bên đã đọc, hiểu rõ và đồng ý với tất cả các điều khoản trong hợp đồng này.",
          40,
          doc.y,
          { width: doc.page.width - 80, align: "center" }
        );

      doc.y += 50;

      // Khung chữ ký - Trang 2
      const signY = doc.y;

      // Chữ ký bên A (đã ký sẵn) - Bên trái
      doc.rect(80, signY, 180, 100).fillAndStroke("#F8FAFC", "#D1D5DB");

      doc
        .fillColor(textColor)
        .font(fontBold)
        .fontSize(11)
        .text("BÊN A (Chủ nhà)", 80, signY + 15, {
          align: "center",
          width: 180,
        });

      doc
        .font(fontName)
        .fontSize(14)
        .text(data.landlordName, 80, signY + 45, {
          align: "center",
          width: 180,
        });

      doc
        .fontSize(8)
        .text(
          `Đã ký: ${new Date().toLocaleDateString("vi-VN")}`,
          80,
          signY + 75,
          {
            align: "center",
            width: 180,
          }
        );

      // Chữ ký bên B (chờ ký) - Bên phải TRANG 2
      doc
        .rect(340, signY, 180, 100)
        .fillAndStroke("#FEF2F2", "#EF4444")
        .lineWidth(2);

      doc
        .fillColor("#DC2626")
        .font(fontBold)
        .fontSize(11)
        .text("BÊN B (Người thuê)", 340, signY + 15, {
          align: "center",
          width: 180,
        });

      doc.fontSize(9).text("VUI LÒNG KÝ TẠI ĐÂY", 340, signY + 35, {
        align: "center",
        width: 180,
      });

      doc
        .fillColor(textColor)
        .fontSize(8)
        .text(data.tenantName, 340, signY + 60, {
          align: "center",
          width: 180,
        });

      doc
        .fontSize(7)
        .text("Ngày ký: .........................", 340, signY + 80, {
          align: "center",
          width: 180,
        });

      // Footer
      doc.y = doc.page.height - 60;
      doc.rect(0, doc.y, doc.page.width, 40).fill(primaryColor);

      doc
        .fillColor("#FFFFFF")
        .font(fontName)
        .fontSize(8)
        .text(
          "📧 contact@viestay.com | 📞 0123-456-789 | 🌐 www.viestay.com",
          0,
          doc.y + 12,
          { align: "center" }
        );

      doc.end();

      stream.on("finish", () => {
        console.log("PDF created successfully:", outputPath);
        resolve(outputPath);
      });

      stream.on("error", (err) => {
        console.error("PDF creation error:", err);
        reject(err);
      });
    } catch (error) {
      console.error("Error creating PDF:", error);
      reject(error);
    }
  });
}

// Cập nhật các function khác giữ nguyên...
async function uploadToCloudinary(filePath, asImage = false) {
  try {
    const fileBaseName = path.basename(filePath, ".pdf");
    const timestamp = Date.now();

    const pdfOptions = {
      resource_type: "raw",
      public_id: `rental-agreements/pdf/${fileBaseName}_${timestamp}`,
      use_filename: false,
      unique_filename: true,
      format: "pdf",
    };

    console.log("Uploading PDF file...");
    const pdfResult = await cloudinary.uploader.upload(filePath, pdfOptions);

    const imageOptions = {
      resource_type: "image",
      public_id: `rental-agreements/images/${fileBaseName}_${timestamp}`,
      use_filename: false,
      unique_filename: true,
      transformation: [
        {
          format: "jpg",
          quality: "auto:good",
          page: 1,
          width: 600,
          height: 850,
          crop: "fit",
        },
      ],
    };

    console.log("Uploading preview image...");
    const imageResult = await cloudinary.uploader.upload(
      filePath,
      imageOptions
    );

    return {
      url: imageResult.secure_url,
      pdfUrl: pdfResult.secure_url,
      public_id: imageResult.public_id,
      pdfPublicId: pdfResult.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload: ${error.message}`);
  }
}

async function generateAndUploadRentalAgreement(
  data,
  options = { asImage: false }
) {
  const outputDir = path.join(__dirname, "temp");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `rental-agreement-${data.contractId}-${Date.now()}.pdf`;
  const outputPath = path.join(outputDir, fileName);

  try {
    await createRentalAgreementPDF(data, outputPath);
    const uploadResult = await uploadToCloudinary(outputPath, options.asImage);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    return uploadResult;
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw error;
  }
}

module.exports = { generateAndUploadRentalAgreement };

// Test code giữ nguyên...
if (require.main === module) {
  const agreementData = {
    contractId: "HD001",
    tenantName: "Nguyễn Văn A",
    tenantIdNumber: "123456789",
    tenantAddress: "123 Đường Láng, Hà Nội",
    tenantPhone: "0123456789",
    landlordName: "Trần Thị B",
    landlordIdNumber: "987654321",
    landlordAddress: "456 Đường Giải Phóng, Hà Nội",
    landlordPhone: "0987654321",
    propertyAddress: "789 Đường Cầu Giấy, Hà Nội",
    propertyType: "Căn hộ",
    startDate: "2025-08-01",
    endDate: "2026-07-31",
    monthlyRent: 10000000,
    deposit: 20000000,
    paymentTerms: "Thanh toán vào ngày 5 hàng tháng qua chuyển khoản",
    utilityTerms: "Người thuê chịu chi phí điện, nước, internet",
  };

  generateAndUploadRentalAgreement(agreementData, { asImage: false })
    .then((result) => console.log("Result:", result))
    .catch((err) => console.error("Error:", err));
}
