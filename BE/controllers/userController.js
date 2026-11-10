const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const UploadedFile = require("../models/UploadedFile");
const path = require("path");
const { filterFutureAvailability } = require("../utils/availability");

function isProfileComplete(user) {
  return Boolean(
    user.fullName?.trim() &&
    user.phone?.trim() &&
    user.city?.trim() &&
    user.bio?.trim() &&
    user.languages?.length > 0 &&
    (user.role !== "local" || user.interests?.length > 0),
  );
}

function safeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance,
    bio: user.bio || "",
    city: user.city || "",
    areas: user.areas?.length ? user.areas : [user.city].filter(Boolean),
    languages: user.languages || [],
    interests: user.interests || [],
    avatar: user.avatar || "",
    profilePhotos: user.profilePhotos || [],
    languageCertificates: user.languageCertificates || [],
    pricePerHour: user.pricePerHour || 100000,
    profileComplete: Boolean(user.profileComplete),
    kycStatus: user.kycStatus,
    isPremium: Boolean(user.isPremium),
    status: user.status,
  };
}

function mediaIds(user) {
  const urls = [
    user.avatar,
    ...(user.profilePhotos || []),
    ...(user.languageCertificates || []).map((item) => item.certificateUrl),
  ];
  return new Set(urls.map((url) => {
    if (typeof url !== "string") return null;
    return url.match(/(?:^|\/)media\/([a-f\d]{24})(?:[?#]|$)/i)?.[1]?.toLowerCase() || null;
  }).filter(Boolean));
}

function normalizeInterests(interests = []) {
  const map = {
    "Ẩm thực": "Ẩm thực",
    "ẩm thực": "Ẩm thực",
    Food: "Ẩm thực",
    "cà phê": "cà phê",
    "Cà phê": "cà phê",
    "Coffee & Chill": "cà phê",
    "du lịch": "du lịch",
    "Du lịch": "du lịch",
    "Travel & Danh Lam": "du lịch",
    "Food & Street Food": "Ẩm thực",
  };
  return [
    ...new Set(
      interests
        .map((item) => map[String(item).trim()] || String(item).trim())
        .filter((item) => ["Ẩm thực", "cà phê", "du lịch"].includes(item)),
    ),
  ];
}

async function syncBuddyProfile(user) {
  // Chỉ đồng bộ tài khoản Local.
  if (user.role !== "local") return;

  const interests = normalizeInterests(user.interests || []);
  const pricePerHour = Number(user.pricePerHour ?? 100000);

  await BuddyProfile.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        fullName: user.fullName,
        area: `${(user.areas?.length ? user.areas : [user.city].filter(Boolean)).join(", ") || "Sơn Trà"}, Đà Nẵng`,
        areas: user.areas?.length ? user.areas : [user.city].filter(Boolean),
        bio: user.bio || "",
        coverImage: user.avatar || "",
        photos: user.profilePhotos || [],
        languages: user.languages || ["Tiếng Việt"],
        languageCertificates: user.languageCertificates || [],
        interests,
        pricePerHour,
        price: pricePerHour * 3,
        categories: interests,
        active: user.status === "Active",
      },
      // Chỉ đặt giá trị mặc định cho trường chưa được $set.
      $setOnInsert: {
        verified: false,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

exports.getMyBuddyProfile = async (req, res) => {
  try {
    if (req.user.role !== "local")
      return res.status(403).json({ message: "Chức năng này dành cho Local." });
    const profile = await BuddyProfile.findOne({ user: req.user._id }).populate(
      "user",
      "fullName email status kycStatus",
    );
    if (!profile)
      return res.status(404).json({
        message: "Chưa có hồ sơ dịch vụ. Hãy lưu hồ sơ cá nhân trước.",
      });
    const availability = filterFutureAvailability(profile.availability);
    if (availability.length !== profile.availability.length) {
      profile.availability = availability;
      await profile.save();
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Không thể tải hồ sơ dịch vụ Local." });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Không thể tải hồ sơ." });
  }
};

exports.updateMyProfile = async (req, res) => {
  const uploadedIds = [];
  let userSaved = false;
  try {
    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });

    const previousMedia = mediaIds(user);
    const allowedFields = [
      "fullName",
      "phone",
      "bio",
      "city",
      "areas",
      "languages",
      "interests",
      "avatar",
      "profilePhotos",
      "languageCertificates",
      "pricePerHour",
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (
          ["areas", "languages", "interests", "languageCertificates", "profilePhotos"].includes(field) &&
          typeof value === "string"
        ) {
          try {
            value = JSON.parse(value);
          } catch {
            value = value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
          }
        }
        user[field] = value;
      }
    }
    if (!user.fullName?.trim())
      return res.status(400).json({ message: "Vui lòng nhập họ và tên." });
    if (!user.phone?.trim())
      return res.status(400).json({ message: "Vui lòng nhập số điện thoại." });
    if (!/^0\d{9}$/.test(user.phone))
      return res.status(400).json({
        message: "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.",
      });

    if (!Array.isArray(user.languages) || !Array.isArray(user.interests)) {
      return res
        .status(400)
        .json({ message: "Ngôn ngữ và sở thích phải ở dạng danh sách." });
    }
    if (!Array.isArray(user.areas) || user.areas.some((area) => typeof area !== "string")) {
      return res.status(400).json({ message: "Khu vực hoạt động không hợp lệ." });
    }
    if (user.role === "local") {
      user.areas = [...new Set(user.areas.map((area) => area.trim()).filter(Boolean))];
      if (!user.areas.length && user.city) user.areas = [user.city];
      user.city = user.areas[0] || "";
    } else {
      user.areas = user.city ? [user.city] : [];
    }
    user.interests =
      user.role === "local"
        ? normalizeInterests(user.interests)
        : user.interests;
    if (user.role === "local" && req.body.pricePerHour !== undefined) {
      const pricePerHour = Number(user.pricePerHour);
      if (!Number.isFinite(pricePerHour) || pricePerHour < 0)
        return res.status(400).json({ message: "Giá mỗi giờ không hợp lệ." });
      user.pricePerHour = pricePerHour;
    }
    const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };
    for (const file of req.files || []) {
      const certificate = file.fieldname.match(/^certificate_(\d+)$/);
      const extension = path.extname(file.originalname).toLowerCase();
      if ((!certificate && !["avatarFile", "profilePhotoFiles"].includes(file.fieldname)) ||
          (!certificate && extension === ".pdf") ||
          (certificate && (!user.languageCertificates || !user.languageCertificates[Number(certificate[1])]))) {
        return res.status(400).json({ message: "Tệp hồ sơ không hợp lệ." });
      }
    }
    for (const file of req.files || []) {
      const certificate = file.fieldname.match(/^certificate_(\d+)$/);
      const stored = await UploadedFile.create({
        owner: user._id,
        contentType: types[path.extname(file.originalname).toLowerCase()],
        data: file.buffer,
      });
      uploadedIds.push(stored._id);
      const fileUrl = `${req.protocol}://${req.get("host")}/media/${stored._id}`;
      if (file.fieldname === "avatarFile") user.avatar = fileUrl;
      if (file.fieldname === "profilePhotoFiles") {
        user.profilePhotos = [...(user.profilePhotos || []), fileUrl].slice(-10);
      }
      if (certificate) {
        const index = Number(certificate[1]);
        const certificates = [...(user.languageCertificates || [])];
        const current = certificates[index];
        certificates[index] = { ...(current.toObject ? current.toObject() : current), certificateUrl: fileUrl };
        user.languageCertificates = certificates;
      }
    }
    user.profileComplete = isProfileComplete(user);
    await user.save();
    userSaved = true;
    await syncBuddyProfile(user);
    const currentMedia = mediaIds(user);
    const removedMedia = [...new Set([...previousMedia, ...uploadedIds.map(String)])]
      .filter((id) => !currentMedia.has(id));
    if (removedMedia.length) {
      await UploadedFile.deleteMany({ _id: { $in: removedMedia }, owner: user._id });
    }

    res.json({ message: "Cập nhật hồ sơ thành công.", user: safeUser(user) });
  } catch (error) {
    if (!userSaved && uploadedIds.length) {
      try {
        await UploadedFile.deleteMany({ _id: { $in: uploadedIds }, owner: req.user._id });
      } catch (cleanupError) {
        console.error("Could not clean up uploaded files:", cleanupError);
      }
    }
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Không thể cập nhật hồ sơ." });
  }
};

/**
 * DEMO eKYC: chỉ mô phỏng hoàn tất xác minh.
 * Không thực hiện OCR, NFC hoặc sinh trắc học thật.
 */
exports.completeDemoKyc = async (req, res) => {
  try {
    // Chỉ tài khoản Local mới được chạy luồng demo này.
    if (!["local", "traveler"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Chức năng này chỉ dành cho Traveler và Local.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản.",
      });
    }

    const requiredSteps = [0, 1, 2, 3, 4];
    if (
      !Array.isArray(req.body.completedSteps) ||
      !requiredSteps.every((step) => req.body.completedSteps.includes(step))
    ) {
      return res.status(400).json({
        message: "Vui lòng hoàn tất toàn bộ các bước eKYC demo trước.",
      });
    }

    // Chỉ cập nhật trạng thái demo sau khi người dùng hoàn tất 5 bước.
    user.kycStatus = "Verified";
    await user.save();

    res.json({
      message: "Đã hoàn thành quy trình eKYC demo.",
      user: safeUser(user),
      demo: true,
    });
  } catch (error) {
    console.error("Complete demo eKYC error:", error);
    res.status(500).json({
      message: "Không thể hoàn thành eKYC demo.",
    });
  }
};
