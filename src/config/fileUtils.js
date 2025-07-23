const axios = require("axios");

const fileUtils = {
  async getBase64FromUrl(url) {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      if (response.status !== 200) {
        throw new Error(
          `Failed to fetch file from ${url}: Status ${response.status}`
        );
      }
      const fileBuffer = Buffer.from(response.data, "binary");
      const base64String = fileBuffer.toString("base64");
      return base64String;
    } catch (error) {
      console.error("Error fetching file from URL:", error.message);
      throw error;
    }
  },
};

module.exports = fileUtils;
