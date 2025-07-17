const mongoose = require("mongoose");

beforeAll(async () => {
  // Setup test database connection
  if (process.env.NODE_ENV !== "test") {
    process.env.NODE_ENV = "test";
  }
});

afterAll(async () => {
  // Close database connection
  await mongoose.connection.close();
});
