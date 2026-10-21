const BuddyProfile = require("../models/BuddyProfile");
const {
  availabilityInstant,
  filterFutureAvailability,
  getDaNangDate,
} = require("../utils/availability");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const interestMap = {
  Food: "Ẩm thực",
  "Cà phê": "cà phê",
  "Du lịch": "du lịch",
  "Ẩm thực": "Ẩm thực",
  "cà phê": "cà phê",
  "du lịch": "du lịch",
};

exports.list = async (req, res) => {
  try {
    const q = { active: true, verified: true };
    const { search, category, area, language, minPrice, maxPrice, date, startTime } = req.query;

    if (search && search.trim()) {
      const keyword = new RegExp(escapeRegex(search.trim()), "i");
      q.$or = [{ fullName: keyword }, { bio: keyword }, { area: keyword }];
    }
    if (category && category !== "Tất cả") {
      const selectedInterest = interestMap[category];
      if (!selectedInterest)
        return res
          .status(400)
          .json({ message: "Sở thích tìm kiếm không hợp lệ." });
      q.interests = selectedInterest;
    }
    if (area && area !== "Tất cả khu vực")
      q.area = { $regex: escapeRegex(area.trim()), $options: "i" };
    if (language && language !== "Tất cả ngôn ngữ") q.languages = language;

    if (minPrice !== undefined && minPrice !== "") {
      const min = Number(minPrice);
      if (!Number.isFinite(min) || min < 0)
        return res.status(400).json({ message: "Giá tối thiểu không hợp lệ." });
      q.price = { ...q.price, $gte: min };
    }
    if (maxPrice !== undefined && maxPrice !== "") {
      const max = Number(maxPrice);
      if (!Number.isFinite(max) || max < 0)
        return res.status(400).json({ message: "Giá tối đa không hợp lệ." });
      if (q.price?.$gte !== undefined && max < q.price.$gte)
        return res.status(400).json({
          message: "Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.",
        });
      q.price = { ...q.price, $lte: max };
    }

    
    if (date || startTime) {
      const start = toMinutes(startTime);
      const requestedStart = availabilityInstant(date, startTime);

      if (
        !date ||
        !requestedStart ||
        requestedStart <= new Date() ||
        date < getDaNangDate() ||
        !Number.isFinite(start)
      ) {
        return res.status(400).json({
          message: "Ngày hoặc giờ bắt đầu không hợp lệ.",
        });
      }

      // Chỉ đối chiếu ngày và giờ bắt đầu; thời lượng không lọc danh sách.
      q.availability = {
        $elemMatch: {
          date,
          startTime: { $lte: startTime },
          endTime: { $gt: startTime },
        },
      };
    }

    const items = await BuddyProfile.find(q).sort({ rating: -1 }).lean();
    const now = new Date();
    res.json(
      items.map((item) => ({
        ...item,
        availability: filterFutureAvailability(item.availability, now),
        id: item._id.toString(),
      })),
    );
  } catch (error) {
    console.error("Lỗi lấy danh sách Buddy Profile:", error);
    res.status(500).json({ message: "Không tải được danh sách Local Buddy." });
  }
};

exports.detail = async (req, res) => {
  try {
    const item = await BuddyProfile.findOne({
      _id: req.params.id,
      active: true,
      verified: true,
    }).lean();
    if (!item)
      return res.status(404).json({
        message: "Không tìm thấy Local Buddy hoặc hồ sơ chưa được xác minh.",
      });
    res.json({
      ...item,
      availability: filterFutureAvailability(item.availability),
      id: item._id.toString(),
    });
  } catch (error) {
    res.status(400).json({ message: "Mã Local Buddy không hợp lệ." });
  }
};


function toMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return NaN;
  }

  const [hour, minute] = value.split(":").map(Number);

  if (hour > 23 || minute > 59) return NaN;

  return hour * 60 + minute;
}

// PATCH /api/buddies/mine/availability
// Local cập nhật các ngày và giờ rảnh.
exports.updateAvailability = async (req, res) => {
  try {
    if (req.user.role !== "local") {
      return res.status(403).json({
        message: "Chỉ Local mới được cập nhật lịch rảnh.",
      });
    }

    const { availability } = req.body;

    if (!Array.isArray(availability)) {
      return res.status(400).json({
        message: "Danh sách lịch rảnh không hợp lệ.",
      });
    }

    const today = getDaNangDate();

    for (const slot of availability) {
      const start = availabilityInstant(slot.date, slot.startTime);
      const end = availabilityInstant(slot.date, slot.endTime);
      const endTime = toMinutes(slot.endTime);

      if (
        !start ||
        !end ||
        slot.date < today ||
        endTime <= toMinutes(slot.startTime) ||
        end <= new Date()
      ) {
        return res.status(400).json({
          message: "Ngày hoặc khung giờ rảnh không hợp lệ hoặc đã qua.",
        });
      }
    }

    // Không cho khai báo hai khung giờ bị chồng nhau trong cùng ngày.
    const sorted = [...availability].sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime)
    );

    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];

      if (
        previous.date === current.date &&
        toMinutes(current.startTime) < toMinutes(previous.endTime)
      ) {
        return res.status(400).json({
          message: "Các khung giờ trong cùng ngày không được chồng nhau.",
        });
      }
    }

    const BuddyProfile = require("../models/BuddyProfile");

    const profile = await BuddyProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { availability } },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        message: "Bạn chưa có hồ sơ dịch vụ Local.",
      });
    }

    res.json({
      message: "Đã cập nhật lịch rảnh.",
      availability: profile.availability,
    });
  } catch (error) {
    console.error("Update availability error:", error);
    res.status(500).json({
      message: "Không thể cập nhật lịch rảnh.",
    });
  }
};
