const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('Cloudinary secret:', process.env.CLOUDINARY_API_SECRET);
console.log('Cloudinary key:', process.env.CLOUDINARY_API_KEY);
console.log('Cloudinary cloud name:', process.env.CLOUDINARY_CLOUD_NAME);

module.exports = cloudinary;
