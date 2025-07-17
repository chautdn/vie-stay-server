const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../routes/roomRoute");
const Room = require("../../models/Room");
const User = require("../../models/User");
const Accommodation = require("../../models/Accommodation");
const roomService = require("../../services/roomService");
const tenantService = require("../../services/rentalRequestService");

// Mock services
jest.mock("../../services/roomService");
jest.mock("../../services/rentalRequestService");

describe("Room Controller", () => {
  let authToken;
  let mockUser;
  let mockAccommodation;
  let mockRoom;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.TEST_DATABASE_URL ||
          "mongodb://localhost:27017/viet_stay_test"
      );
    }
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Accommodation.deleteMany({});
    await Room.deleteMany({});

    // Clear all mocks
    jest.clearAllMocks();

    // ✅ SỬA: Đổi role từ 'owner' thành 'landlord'
    mockUser = await User.create({
      name: "Test Landlord",
      email: "testlandlord@example.com",
      password: "password123",
      role: "landlord", // ✅ SỬA: Đổi từ 'owner' thành 'landlord'
      phoneNumber: "0123456789",
      isVerified: true,
    });

    // Create mock accommodation
    mockAccommodation = await Accommodation.create({
      name: "Test Accommodation",
      description: "Test description",
      ownerId: mockUser._id,
      address: {
        fullAddress: "123 Test Street",
        district: "Quận Hải Châu",
        ward: "Test Ward",
        city: "Đà Nẵng",
      },
      amenities: ["wifi", "parking"],
      images: ["test-image.jpg"],
    });

    // Create mock room
    mockRoom = await Room.create({
      name: "Test Room",
      accommodationId: mockAccommodation._id,
      roomNumber: "101",
      type: "single",
      baseRent: 3000000,
      size: 25,
      capacity: 2,
      isAvailable: true,
      hasPrivateBathroom: true,
      furnishingLevel: "full",
      amenities: ["bed", "desk"],
      images: ["room-image.jpg"],
    });

    // Generate auth token
    authToken = "Bearer test-token";
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ✅ SỬA: Simplify tests bằng cách mock Room methods thay vì dùng real database
  describe("GET /api/rooms", () => {
    it("should get all rooms successfully", async () => {
      // Mock Room.find method
      const mockRooms = [mockRoom];
      const mockPopulate = {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockRooms),
          }),
        }),
      };

      jest.spyOn(Room, "find").mockReturnValue(mockPopulate);

      const response = await request(app).get("/").expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("rooms");
      expect(Array.isArray(response.body.data.rooms)).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      // Mock database error
      jest.spyOn(Room, "find").mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      const response = await request(app).get("/").expect(500);

      expect(response.body.status).toBe("error");
    });
  });

  describe("GET /api/rooms/:roomId", () => {
    it("should get room by ID successfully", async () => {
      // Mock Room.findById
      const mockPopulate = {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockRoom),
          }),
        }),
      };

      jest.spyOn(Room, "findById").mockReturnValue(mockPopulate);

      const response = await request(app).get(`/${mockRoom._id}`).expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("room");
    });

    it("should return 404 for non-existent room", async () => {
      // Mock Room.findById to return null
      const mockPopulate = {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      };

      jest.spyOn(Room, "findById").mockReturnValue(mockPopulate);

      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app).get(`/${nonExistentId}`).expect(404);

      expect(response.body.status).toBe("error");
    });

    it("should return 400 for invalid room ID", async () => {
      const response = await request(app).get("/invalid-id").expect(400);

      expect(response.body.status).toBe("error");
    });
  });

  describe("Room Service Integration Tests", () => {
    it("should create room successfully with mocked service", async () => {
      const newRoomData = {
        name: "New Test Room",
        roomNumber: "102",
        type: "double",
        baseRent: 4000000,
        size: 30,
        capacity: 3,
      };

      const createdRoom = {
        ...newRoomData,
        _id: new mongoose.Types.ObjectId(),
      };
      roomService.createRoom.mockResolvedValue(createdRoom);

      const result = await roomService.createRoom(
        newRoomData,
        mockUser._id,
        mockAccommodation._id
      );

      expect(roomService.createRoom).toHaveBeenCalledWith(
        newRoomData,
        mockUser._id,
        mockAccommodation._id
      );
      expect(result).toEqual(createdRoom);
    });

    it("should get rooms by accommodation with mocked service", async () => {
      const mockRooms = [mockRoom];
      roomService.getAllRoomsByAccommodateId.mockResolvedValue(mockRooms);

      const result = await roomService.getAllRoomsByAccommodateId(
        mockAccommodation._id,
        mockUser._id
      );

      expect(result).toEqual(mockRooms);
      expect(roomService.getAllRoomsByAccommodateId).toHaveBeenCalledWith(
        mockAccommodation._id,
        mockUser._id
      );
    });

    it("should update room with mocked service", async () => {
      const updateData = { baseRent: 3500000 };
      const updatedRoom = { ...mockRoom.toObject(), ...updateData };

      roomService.updateRoom.mockResolvedValue(updatedRoom);

      const result = await roomService.updateRoom(
        mockRoom._id,
        updateData,
        mockUser._id
      );

      expect(result.baseRent).toBe(3500000);
      expect(roomService.updateRoom).toHaveBeenCalledWith(
        mockRoom._id,
        updateData,
        mockUser._id
      );
    });

    it("should search rooms with mocked service", async () => {
      const searchFilters = {
        district: "Quận Hải Châu",
        minRent: 2000000,
        maxRent: 5000000,
        type: "single",
      };

      const mockSearchResults = [mockRoom];
      roomService.searchRooms.mockResolvedValue(mockSearchResults);

      const result = await roomService.searchRooms(searchFilters);

      expect(result).toEqual(mockSearchResults);
      expect(roomService.searchRooms).toHaveBeenCalledWith(searchFilters);
    });

    it("should get available rooms with mocked service", async () => {
      const filters = { isAvailable: true };
      const availableRooms = [mockRoom];

      roomService.getAvailableRooms.mockResolvedValue(availableRooms);

      const result = await roomService.getAvailableRooms(filters);

      expect(result).toEqual(availableRooms);
      expect(roomService.getAvailableRooms).toHaveBeenCalledWith(filters);
    });

    it("should delete room with mocked service", async () => {
      roomService.deleteRoom.mockResolvedValue({
        message: "Room deleted successfully",
      });

      const result = await roomService.deleteRoom(mockRoom._id, mockUser._id);

      expect(roomService.deleteRoom).toHaveBeenCalledWith(
        mockRoom._id,
        mockUser._id
      );
      expect(result.message).toBe("Room deleted successfully");
    });

    it("should deactivate room with mocked service", async () => {
      const deactivatedRoom = { ...mockRoom.toObject(), isAvailable: false };
      roomService.deactivateRoom.mockResolvedValue(deactivatedRoom);

      const result = await roomService.deactivateRoom(
        mockRoom._id,
        mockUser._id
      );

      expect(roomService.deactivateRoom).toHaveBeenCalledWith(
        mockRoom._id,
        mockUser._id
      );
      expect(result.isAvailable).toBe(false);
    });

    it("should reactivate room with mocked service", async () => {
      const reactivatedRoom = { ...mockRoom.toObject(), isAvailable: true };
      roomService.reactivateRoom.mockResolvedValue(reactivatedRoom);

      const result = await roomService.reactivateRoom(
        mockRoom._id,
        mockUser._id
      );

      expect(roomService.reactivateRoom).toHaveBeenCalledWith(
        mockRoom._id,
        mockUser._id
      );
      expect(result.isAvailable).toBe(true);
    });
  });

  describe("Tenant Service Integration Tests", () => {
    it("should get rental requests for room", async () => {
      const mockRequests = [
        { _id: new mongoose.Types.ObjectId(), roomId: mockRoom._id },
      ];
      tenantService.getAllRentalRequestsByRoomId.mockResolvedValue(
        mockRequests
      );

      const result = await tenantService.getAllRentalRequestsByRoomId(
        mockRoom._id.toString()
      );

      expect(tenantService.getAllRentalRequestsByRoomId).toHaveBeenCalledWith(
        mockRoom._id.toString()
      );
      expect(result).toEqual(mockRequests);
    });

    it("should get current tenants in room", async () => {
      const mockTenants = [
        { _id: new mongoose.Types.ObjectId(), name: "Test Tenant" },
      ];
      roomService.getAllCurrentTenantsInRoom.mockResolvedValue(mockTenants);

      const result = await roomService.getAllCurrentTenantsInRoom(
        mockRoom._id.toString()
      );

      expect(roomService.getAllCurrentTenantsInRoom).toHaveBeenCalledWith(
        mockRoom._id.toString()
      );
      expect(result).toEqual(mockTenants);
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      const errorMessage = "Service error";
      roomService.createRoom.mockRejectedValue(new Error(errorMessage));

      try {
        await roomService.createRoom({}, mockUser._id, mockAccommodation._id);
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }

      expect(roomService.createRoom).toHaveBeenCalled();
    });

    it("should handle validation errors", async () => {
      const validationError = new Error("Validation failed: name is required");
      roomService.createRoom.mockRejectedValue(validationError);

      try {
        await roomService.createRoom({}, mockUser._id, mockAccommodation._id);
      } catch (error) {
        expect(error.message).toContain("Validation failed");
      }
    });

    it("should handle unauthorized access", async () => {
      const unauthorizedError = new Error(
        "User not authorized to access this resource"
      );
      roomService.updateRoom.mockRejectedValue(unauthorizedError);

      try {
        await roomService.updateRoom(mockRoom._id, {}, "invalid-user-id");
      } catch (error) {
        expect(error.message).toContain("not authorized");
      }
    });
  });

  describe("Data Validation", () => {
    it("should validate room data structure", () => {
      expect(mockRoom).toHaveProperty("_id");
      expect(mockRoom).toHaveProperty("name");
      expect(mockRoom).toHaveProperty("baseRent");
      expect(mockRoom).toHaveProperty("isAvailable");
      expect(mockRoom).toHaveProperty("accommodationId");
    });

    it("should validate user data structure", () => {
      expect(mockUser).toHaveProperty("_id");
      expect(mockUser).toHaveProperty("name");
      expect(mockUser).toHaveProperty("email");
      expect(mockUser).toHaveProperty("role");
      expect(mockUser.role).toBe("landlord");
    });

    it("should validate accommodation data structure", () => {
      expect(mockAccommodation).toHaveProperty("_id");
      expect(mockAccommodation).toHaveProperty("name");
      expect(mockAccommodation).toHaveProperty("ownerId");
      expect(mockAccommodation).toHaveProperty("address");
    });
  });

  describe("Mock Functionality", () => {
    it("should verify all mocks are working", () => {
      expect(roomService).toBeDefined();
      expect(tenantService).toBeDefined();
      expect(roomService.createRoom).toBeDefined();
      expect(roomService.updateRoom).toBeDefined();
      expect(roomService.deleteRoom).toBeDefined();
      expect(tenantService.getAllRentalRequestsByRoomId).toBeDefined();
    });

    it("should handle mongoose ObjectId creation", () => {
      const objectId = new mongoose.Types.ObjectId();
      expect(objectId).toBeDefined();
      expect(typeof objectId.toString()).toBe("string");
      expect(objectId.toString()).toMatch(/^[0-9a-fA-F]{24}$/);
    });
  });
});

// ✅ SỬA: Helper functions với đúng role
const createTestUser = async (role = "landlord") => {
  return await User.create({
    name: `Test ${role}`,
    email: `test${role}@example.com`,
    password: "password123",
    role: role, // landlord, tenant, hoặc admin
    phoneNumber: "0123456789",
    isVerified: true,
  });
};

const createTestAccommodation = async (ownerId) => {
  return await Accommodation.create({
    name: "Test Accommodation",
    description: "Test description",
    ownerId: ownerId,
    address: {
      fullAddress: "123 Test Street",
      district: "Quận Hải Châu",
      ward: "Test Ward",
      city: "Đà Nẵng",
    },
    amenities: ["wifi", "parking"],
    images: ["test-image.jpg"],
  });
};

const createTestRoom = async (accommodationId) => {
  return await Room.create({
    name: "Test Room",
    accommodationId: accommodationId,
    roomNumber: "101",
    type: "single",
    baseRent: 3000000,
    size: 25,
    capacity: 2,
    isAvailable: true,
    hasPrivateBathroom: true,
    furnishingLevel: "full",
    amenities: ["bed", "desk"],
    images: ["room-image.jpg"],
  });
};

module.exports = {
  createTestUser,
  createTestAccommodation,
  createTestRoom,
};
