const bcrypt = require('bcrypt');

// Giả lập hằng số cấu hình
const AUTH = {
  SALT_ROUNDS: 10 // Số vòng lặp cho bcrypt
};

// Định nghĩa schema đơn giản (giả lập userSchema)
const userSchema = {
  password: null, // Trường password
  isModified: function (field) {
    // Giả lập: coi như password luôn được sửa đổi khi gán giá trị mới
    return true;
  },
  pre: function (event, handler) {
    // Giả lập middleware của Mongoose
    this._preSave = handler;
  },
  save: async function () {
    await this._preSave(function () {}); // Gọi middleware trước khi "lưu"
    console.log('User saved with password:', this.password);
  }
};

// Middleware băm mật khẩu
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, AUTH.SALT_ROUNDS);
  next();
});

// Hàm tạo và lưu user với mật khẩu "admin123"
async function createUser() {
  const user = Object.create(userSchema);
  user.password = '123123'; // Gán mật khẩu ban đầu
  await user.save(); // Kích hoạt middleware và băm mật khẩu
  return user.password; // Trả về mật khẩu đã băm
}

// Chạy hàm và in kết quả
createUser()
  .then((hashedPassword) => {
    console.log('Mật khẩu đã băm:', hashedPassword);
  })
  .catch((err) => {
    console.error('Lỗi:', err);
  });