const Accommodation = require("../models/Accommodation");
const mongoose = require("mongoose");

// Lấy accommodations với stats tính toán từ rooms
const getAccommodationByOwner = async (ownerId) => {
  try {
    const accommodations = await Accommodation.aggregate([
      // Match accommodations của owner
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          isActive: true,
        },
      },

      // Lookup rooms để tính toán
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "accommodationId",
          as: "rooms",
        },
      },

      // Tính toán stats từ rooms
      {
        $addFields: {
          // Tổng số phòng thực tế từ rooms array
          totalRooms: { $size: "$rooms" },

          // Số phòng đã thuê
          occupiedRooms: {
            $size: {
              $filter: {
                input: "$rooms",
                cond: {
                  $or: [
                    { $eq: ["$$this.status", "occupied"] },
                    { $eq: ["$$this.isOccupied", true] },
                    { $ne: ["$$this.currentTenant", null] },
                  ],
                },
              },
            },
          },
        },
      },

      // Tính thêm các field khác
      {
        $addFields: {
          // Số phòng trống
          availableRooms: { $subtract: ["$totalRooms", "$occupiedRooms"] },

          // Tỷ lệ lấp đầy (%)
          occupancyRate: {
            $cond: {
              if: { $gt: ["$totalRooms", 0] },
              then: {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$occupiedRooms", "$totalRooms"] },
                      100,
                    ],
                  },
                  0,
                ],
              },
              else: 0,
            },
          },

          // Doanh thu tháng (3M per occupied room)
          monthlyRevenue: {
            $multiply: ["$occupiedRooms", 3000000],
          },
        },
      },

      // Project fields cần thiết
      {
        $project: {
          name: 1,
          type: 1,
          description: 1,
          address: 1,
          images: 1,
          amenities: 1,
          isActive: 1,
          isFeatured: 1,
          averageRating: 1,
          totalReviews: 1,
          approvalStatus: 1,

          // Stats đã tính toán
          totalRooms: 1,
          occupiedRooms: 1,
          availableRooms: 1,
          occupancyRate: 1,
          monthlyRevenue: 1,

          rooms: 1, // Giữ rooms data cho chi tiết
          policies: 1,
          contactInfo: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },

      // Sort theo ngày tạo
      { $sort: { createdAt: -1 } },
    ]);

    return accommodations;
  } catch (error) {
    console.error("Error in getAccommodationByOwner:", error);
    throw error;
  }
};

module.exports = {
  getAccommodationByOwner,
};
