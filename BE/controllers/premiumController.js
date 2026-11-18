const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const Transaction = require("../models/Transaction");
const PremiumSubscription = require("../models/PremiumSubscription");
const { notifyUser } = require("../utils/notifications");
const { getWalletSettings } = require("../utils/walletLedger");
const {
  generateOrderCode,
  createPaymentLink,
  getPaymentLinkInformation,
  isPayOSConfigured,
} = require("../utils/payos");

async function getPremiumPackages() {
  const settings = await getWalletSettings();
  const std = settings.standardCommissionPercent ?? 15;
  const prm = settings.premiumCommissionPercent ?? 10;

  return [
    {
      id: "premium_1m",
      name: "Gói 1 Tháng",
      durationDays: 30,
      price: 199000,
      originalPrice: 199000,
      discountBadge: "",
      description: "Trải nghiệm đầy đủ đặc quyền Local Premium trong 30 ngày.",
      benefits: [
        "Ưu tiên hiển thị vị trí đầu khi du khách tìm kiếm Local",
        "Huy hiệu vàng 👑 Local Premium độc quyền trên hồ sơ",
        `Giảm phí hoa hồng sàn (từ ${std}% xuống chỉ còn ${prm}%)`,
        "Tăng cơ hội nhận booking lên gấp 3 lần",
        "Huy hiệu nhận diện nổi bật trong kết quả tìm kiếm",
      ],
      isPopular: false,
      active: true,
      commissions: { standard: std, premium: prm },
    },
    {
      id: "premium_3m",
      name: "Gói 3 Tháng",
      durationDays: 90,
      price: 499000,
      originalPrice: 597000,
      discountBadge: "Tiết kiệm 16%",
      description: "Gói phổ biến nhất, tối ưu chi phí và tăng trưởng thu nhập vượt trội.",
      benefits: [
        "Toàn bộ đặc quyền của gói 1 Tháng",
        "Ưu tiên hiển thị vị trí đầu khi du khách tìm kiếm Local",
        "Huy hiệu vàng 👑 Local Premium độc quyền trên hồ sơ",
        `Giảm phí hoa hồng sàn (từ ${std}% xuống chỉ còn ${prm}%)`,
        "Tăng cơ hội nhận booking lên gấp 3 lần",
        "Huy hiệu nhận diện nổi bật trong kết quả tìm kiếm",
        "Ưu tiên hỗ trợ từ đội ngũ vận hành LocalBuddy 24/7",
      ],
      isPopular: true,
      active: true,
      commissions: { standard: std, premium: prm },
    },
    {
      id: "premium_12m",
      name: "Gói 1 Năm (12 Tháng)",
      durationDays: 365,
      price: 1699000,
      originalPrice: 2388000,
      discountBadge: "Tiết kiệm 29%",
      description: "Đồng hành cả năm cùng LocalBuddy với mức chiết khấu siêu ưu đãi.",
      benefits: [
        "Toàn bộ đặc quyền của gói 3 Tháng",
        `Tối đa hoá doanh thu cả năm với hoa hồng cố định chỉ ${prm}%`,
        "Được vinh danh vào danh sách Top Local dẫn tour tiêu biểu",
        "Được giới thiệu nổi bật trên trang chủ và fanpage LocalBuddy",
        "Hỗ trợ quảng bá hình ảnh cá nhân và chuyên gia tư vấn",
      ],
      isPopular: false,
      active: true,
      commissions: { standard: std, premium: prm },
    },
  ];
}

// Helper: Kích hoạt gói Premium cho User và đồng bộ BuddyProfile
async function activateSubscriptionInternal(subscription) {
  if (subscription.status === "Active") return subscription;

  const user = await User.findById(subscription.user);
  if (!user) throw new Error("Không tìm thấy người dùng.");

  const durationMs = subscription.durationDays * 24 * 60 * 60 * 1000;
  const now = new Date();

  let startedAt;
  let expiresAt;

  // Nếu user đang có gói active chưa hết hạn thì gia hạn nối tiếp
  if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now) {
    startedAt = user.premiumStartedAt || now;
    expiresAt = new Date(new Date(user.premiumExpiresAt).getTime() + durationMs);
  } else {
    startedAt = now;
    expiresAt = new Date(now.getTime() + durationMs);
  }

  subscription.status = "Active";
  subscription.startedAt = startedAt;
  subscription.expiresAt = expiresAt;
  await subscription.save();

  user.isPremium = true;
  user.premiumStatus = "Active";
  user.premiumStartedAt = startedAt;
  user.premiumExpiresAt = expiresAt;
  await user.save();

  await BuddyProfile.updateOne(
    { user: user._id },
    { $set: { isPremium: true } }
  );

  await Transaction.updateOne(
    {
      $or: [
        { payosOrderCode: subscription.orderCode },
        { relatedSubscription: subscription._id },
      ],
    },
    { $set: { status: "Completed" } }
  );

  await notifyUser(user._id, {
    title: "👑 Kích hoạt Local Premium thành công!",
    message: `Bạn đã nâng cấp thành công ${subscription.packageName} (hạn dùng đến ${expiresAt.toLocaleDateString("vi-VN")}). Chúc bạn có thêm nhiều booking!`,
    link: "/dashboard/local",
    type: "premium_activated",
  });

  return subscription;
}

// 1. Lấy danh sách gói Premium đang mở bán
exports.getPlans = async (req, res) => {
  try {
    const allPackages = await getPremiumPackages();
    const plans = allPackages.filter((p) => p.active);
    const settings = await getWalletSettings();
    res.json({
      success: true,
      plans,
      commissions: {
        standard: settings.standardCommissionPercent,
        premium: settings.premiumCommissionPercent,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách gói Premium:", error);
    res.status(500).json({ message: "Không thể lấy danh sách gói Premium." });
  }
};

// 2. Tạo đơn đăng ký gói Premium & Link PayOS QR
exports.subscribe = async (req, res) => {
  try {
    const { packageId } = req.body;
    const allPackages = await getPremiumPackages();
    const plan = allPackages.find((p) => p.id === packageId && p.active);
    if (!plan) {
      return res.status(400).json({ message: "Gói Premium đã chọn không hợp lệ." });
    }

    const orderCode = generateOrderCode();
    const clientUrl = process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:5173";
    const returnUrl = process.env.PAYOS_RETURN_URL || `${clientUrl}/payment/payos-return`;
    const cancelUrl = process.env.PAYOS_CANCEL_URL || `${clientUrl}/payment/payos-return?cancel=true`;

    const description = `LBPREM ${orderCode}`.slice(0, 25);

    const paymentLink = await createPaymentLink({
      orderCode,
      amount: plan.price,
      description,
      returnUrl: `${returnUrl}?type=premium`,
      cancelUrl: `${cancelUrl}&type=premium`,
      items: [
        {
          name: plan.name,
          quantity: 1,
          price: plan.price,
        },
      ],
    });

    const subscription = await PremiumSubscription.create({
      user: req.user._id,
      packageId: plan.id,
      packageName: plan.name,
      amount: plan.price,
      durationDays: plan.durationDays,
      status: "Pending",
      orderCode,
      paymentLinkId: paymentLink.paymentLinkId || "",
      paymentMethod: "PAYOS_QR",
      qrCodeUrl: paymentLink.qrCodeUrl || "",
      checkoutUrl: paymentLink.checkoutUrl || "",
      benefits: plan.benefits,
    });

    await Transaction.create({
      user: req.user._id,
      type: "PremiumSubscription",
      amount: plan.price,
      status: "Pending",
      orderId: String(orderCode),
      payosOrderCode: orderCode,
      payosPaymentLinkId: paymentLink.paymentLinkId || "",
      paymentMethod: "PAYOS_QR",
      relatedSubscription: subscription._id,
      description: `Đăng ký ${plan.name} (${plan.durationDays} ngày) qua PayOS QR`,
    });

    res.json({
      success: true,
      subscriptionId: subscription._id,
      orderCode,
      amount: plan.price,
      packageName: plan.name,
      durationDays: plan.durationDays,
      qrCodeUrl: paymentLink.qrCodeUrl,
      checkoutUrl: paymentLink.checkoutUrl,
      bin: paymentLink.bin,
      accountNumber: paymentLink.accountNumber,
      accountName: paymentLink.accountName,
      description: paymentLink.description || description,
      isMock: paymentLink.isMock || false,
    });
  } catch (error) {
    console.error("Lỗi tạo đơn đăng ký Premium:", error);
    res.status(500).json({ message: "Không thể khởi tạo thanh toán gói Premium." });
  }
};

// 3. Kiểm tra trạng thái thanh toán gói Premium (dùng cho polling FE)
exports.checkStatus = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const numOrderCode = Number(orderCode);

    const subscription = await PremiumSubscription.findOne({
      $or: [
        { orderCode: numOrderCode || 0 },
        { _id: req.params.orderCode.match(/^[0-9a-fA-F]{24}$/) ? req.params.orderCode : null },
      ],
      user: req.user._id,
    });

    if (!subscription) {
      return res.status(404).json({ message: "Không tìm thấy thông tin đăng ký Premium." });
    }

    if (subscription.status === "Active") {
      const user = await User.findById(req.user._id).select(
        "isPremium premiumStatus premiumStartedAt premiumExpiresAt"
      );
      return res.json({
        success: true,
        completed: true,
        status: "PAID",
        subscription,
        user,
      });
    }

    if (isPayOSConfigured()) {
      const payosInfo = await getPaymentLinkInformation(numOrderCode || subscription.orderCode);
      if (payosInfo && payosInfo.status === "PAID") {
        await activateSubscriptionInternal(subscription);
        const user = await User.findById(req.user._id).select(
          "isPremium premiumStatus premiumStartedAt premiumExpiresAt"
        );
        return res.json({
          success: true,
          completed: true,
          status: "PAID",
          subscription,
          user,
        });
      }
      return res.json({
        success: true,
        completed: false,
        status: payosInfo?.status || subscription.status,
        subscription,
      });
    }

    return res.json({
      success: true,
      completed: false,
      status: subscription.status,
      subscription,
    });
  } catch (error) {
    console.error("Lỗi kiểm tra trạng thái Premium:", error);
    res.status(500).json({ message: "Lỗi kiểm tra trạng thái thanh toán." });
  }
};

// 4. Lấy thông tin gói Premium hiện tại của user
exports.getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "isPremium premiumStatus premiumStartedAt premiumExpiresAt"
    );
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    // Tự động kiểm tra hết hạn
    if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
      user.isPremium = false;
      user.premiumStatus = "Expired";
      await user.save();
      await BuddyProfile.updateOne({ user: user._id }, { $set: { isPremium: false } });
    }

    const latestActive = await PremiumSubscription.findOne({
      user: req.user._id,
      status: "Active",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      isPremium: Boolean(user.isPremium),
      premiumStatus: user.premiumStatus,
      premiumStartedAt: user.premiumStartedAt,
      premiumExpiresAt: user.premiumExpiresAt,
      activeSubscription: latestActive,
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin gói Premium hiện tại:", error);
    res.status(500).json({ message: "Không thể lấy thông tin gói Premium." });
  }
};

// 5. Lịch sử đăng ký Premium của người dùng
exports.getHistory = async (req, res) => {
  try {
    const history = await PremiumSubscription.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, history });
  } catch (error) {
    console.error("Lỗi lấy lịch sử gói Premium:", error);
    res.status(500).json({ message: "Không thể lấy lịch sử đăng ký Premium." });
  }
};

exports.activateSubscriptionInternal = activateSubscriptionInternal;

