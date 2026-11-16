const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/../.env" });

const User = require("../models/User");
const BuddyProfile = require("../models/BuddyProfile");
const Transaction = require("../models/Transaction");
const PremiumSubscription = require("../models/PremiumSubscription");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const WalletSettings = require("../models/WalletSettings");
const { activateSubscriptionInternal } = require("../controllers/premiumController");

async function runVerification() {
  console.log("=== BẮT ĐẦU KIỂM THỬ HỆ THỐNG LOCAL PREMIUM & RÚT TIỀN THỰC TẾ ===");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/localbuddy";
  await mongoose.connect(uri);
  console.log("✓ Kết nối MongoDB thành công.");

  const testEmailPrefix = `test_fin_${Date.now()}`;

  try {
    // 1. TẠO TEST USER VÀ TEST BUDDY
    const testLocalUser = await User.create({
      fullName: "Local Test Premium",
      email: `${testEmailPrefix}_local@example.com`,
      password: "hashedpassword123",
      role: "local",
      status: "Active",
      kycStatus: "Verified",
      walletBalance: 1000000, // 1 triệu VND
      pendingWithdrawalAmount: 0,
      isPremium: false,
    });

    const testBuddy = await BuddyProfile.create({
      user: testLocalUser._id,
      fullName: testLocalUser.fullName,
      area: "Hải Châu, Đà Nẵng",
      price: 300000,
      pricePerHour: 100000,
      rating: 4.8,
      verified: true,
      active: true,
      isPremium: false,
    });

    console.log("✓ Tạo tài khoản Local Test thành công. Số dư ban đầu: 1.000.000 đ");

    // 2. KIỂM THỬ RÚT TIỀN & ĐẶT CỌC GIỮ TIỀN (RESERVATION)
    console.log("\n--- KIỂM THỬ HỆ THỐNG RÚT TIỀN BẢO TOÀN SỐ DƯ (RESERVATION) ---");
    const withdrawAmount = 400000;

    // Giữ tiền nguyên tử
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: testLocalUser._id,
        $expr: {
          $gte: [
            { $subtract: ["$walletBalance", { $ifNull: ["$pendingWithdrawalAmount", 0] }] },
            withdrawAmount,
          ],
        },
      },
      { $inc: { pendingWithdrawalAmount: withdrawAmount } },
      { new: true }
    );

    if (!updatedUser) throw new Error("Thất bại khi giữ tiền rút!");

    const availableBal = updatedUser.walletBalance - updatedUser.pendingWithdrawalAmount;
    console.log(`✓ Đã giữ tiền rút: ${withdrawAmount.toLocaleString("vi-VN")} đ`);
    console.log(`  - Tổng số dư ví (authoritative): ${updatedUser.walletBalance.toLocaleString("vi-VN")} đ`);
    console.log(`  - Số tiền đang chờ rút: ${updatedUser.pendingWithdrawalAmount.toLocaleString("vi-VN")} đ`);
    console.log(`  - Số dư khả dụng: ${availableBal.toLocaleString("vi-VN")} đ`);

    if (availableBal !== 600000) {
      throw new Error(`Số dư khả dụng sai kỳ vọng: ${availableBal} !== 600000`);
    }

    // Kiểm tra không cho rút vượt quá số dư khả dụng
    const invalidExcessive = 700000;
    const shouldFail = await User.findOneAndUpdate(
      {
        _id: testLocalUser._id,
        $expr: {
          $gte: [
            { $subtract: ["$walletBalance", { $ifNull: ["$pendingWithdrawalAmount", 0] }] },
            invalidExcessive,
          ],
        },
      },
      { $inc: { pendingWithdrawalAmount: invalidExcessive } },
      { new: true }
    );

    if (shouldFail) {
      throw new Error("Lỗi: Cho phép rút tiền vượt quá số dư khả dụng!");
    }
    console.log("✓ Chặn rút tiền vượt quá số dư khả dụng thành công!");

    // Tạo WithdrawalRequest model
    const withdrawal = await WithdrawalRequest.create({
      user: testLocalUser._id,
      userRole: "local",
      amount: withdrawAmount,
      bankName: "MB Bank",
      accountNumber: "0905123456",
      accountName: "LOCAL TEST PREMIUM",
      status: "Pending",
      history: [{ action: "Tạo yêu cầu rút tiền", timestamp: new Date() }],
    });
    console.log(`✓ Tạo WithdrawalRequest thành công, Mã ID: ${withdrawal._id}, Status: ${withdrawal.status}`);

    // Admin xử lý -> Processing
    withdrawal.status = "Processing";
    withdrawal.history.push({ action: "Bắt đầu xử lý", timestamp: new Date() });
    await withdrawal.save();
    console.log("✓ Chuyển trạng thái sang Processing thành công.");

    // Admin hoàn tất -> Deduct authoritative balance & release reservation
    await User.updateOne(
      { _id: testLocalUser._id },
      {
        $inc: {
          walletBalance: -withdrawAmount,
          pendingWithdrawalAmount: -withdrawAmount,
        },
      }
    );
    withdrawal.status = "Completed";
    withdrawal.bankTransactionCode = "FT2408998811";
    withdrawal.transferDate = new Date();
    await withdrawal.save();

    const finalizedUser = await User.findById(testLocalUser._id);
    console.log(`✓ Admin hoàn tất chuyển tiền (Mã GD: ${withdrawal.bankTransactionCode})`);
    console.log(`  - Tổng số dư ví sau khi chuyển: ${finalizedUser.walletBalance.toLocaleString("vi-VN")} đ`);
    console.log(`  - Tiền chờ rút còn lại: ${finalizedUser.pendingWithdrawalAmount.toLocaleString("vi-VN")} đ`);
    console.log(`  - Số dư khả dụng: ${(finalizedUser.walletBalance - finalizedUser.pendingWithdrawalAmount).toLocaleString("vi-VN")} đ`);

    if (finalizedUser.walletBalance !== 600000 || finalizedUser.pendingWithdrawalAmount !== 0) {
      throw new Error("Khấu trừ số dư sau khi hoàn tất rút tiền không chính xác!");
    }

    // 3. KIỂM THỬ LOCAL PREMIUM SUBSCRIPTION & SẮP XẾP TÌM KIẾM
    console.log("\n--- KIỂM THỬ KÍCH HOẠT VÀ SẮP XẾP LOCAL PREMIUM ---");

    // Tạo thêm 1 standard buddy để test so sánh vị trí tìm kiếm
    const testStandardUser = await User.create({
      fullName: "Local Standard Mate",
      email: `${testEmailPrefix}_std@example.com`,
      password: "hashedpassword123",
      role: "local",
      status: "Active",
      kycStatus: "Verified",
      isPremium: false,
    });
    const testStandardBuddy = await BuddyProfile.create({
      user: testStandardUser._id,
      fullName: testStandardUser.fullName,
      area: "Hải Châu, Đà Nẵng",
      rating: 5.0, // Đánh giá 5.0 sao (cao hơn Premium 4.8)
      verified: true,
      active: true,
      isPremium: false,
    });

    // Kích hoạt Premium cho testLocalUser
    const subscription = await PremiumSubscription.create({
      user: testLocalUser._id,
      packageId: "premium_1m",
      packageName: "Gói 1 Tháng",
      amount: 199000,
      durationDays: 30,
      status: "Pending",
      orderCode: 98765432,
    });

    await activateSubscriptionInternal(subscription);

    const activeUser = await User.findById(testLocalUser._id);
    const activeBuddy = await BuddyProfile.findById(testBuddy._id);

    console.log(`✓ Kích hoạt Premium thành công:`);
    console.log(`  - User isPremium: ${activeUser.isPremium}`);
    console.log(`  - User premiumStatus: ${activeUser.premiumStatus}`);
    console.log(`  - User premiumExpiresAt: ${activeUser.premiumExpiresAt}`);
    console.log(`  - BuddyProfile isPremium: ${activeBuddy.isPremium}`);

    if (!activeUser.isPremium || !activeBuddy.isPremium || activeUser.premiumStatus !== "Active") {
      throw new Error("Kích hoạt Premium thất bại hoặc không đồng bộ BuddyProfile!");
    }

    // KIỂM TRA SẮP XẾP TÌM KIẾM: Premium (rating 4.8) PHẢI xuất hiện TRƯỚC Standard (rating 5.0)
    const searchResults = await BuddyProfile.find({
      _id: { $in: [testBuddy._id, testStandardBuddy._id] },
    })
      .sort({ isPremium: -1, rating: -1, createdAt: -1 })
      .lean();

    console.log("\nKết quả truy vấn tìm kiếm Local:");
    searchResults.forEach((b, idx) => {
      console.log(`  ${idx + 1}. ${b.fullName} | Premium: ${b.isPremium} | Rating: ${b.rating} sao`);
    });

    if (searchResults[0]._id.toString() !== testBuddy._id.toString()) {
      throw new Error("LỖI: Local Premium không được ưu tiên hiển thị đầu trang tìm kiếm!");
    }
    console.log("✓ XÁC NHẬN: Local Premium xuất hiện đầu tiên bất kể số sao của standard buddy!");

    // 4. KIỂM THỬ GIA HẠN NỐI TIẾP KHI CÒN HẠN
    console.log("\n--- KIỂM THỬ GIA HẠN GÓI NỐI TIẾP ---");
    const currentExpiry = activeUser.premiumExpiresAt.getTime();
    const renewalSub = await PremiumSubscription.create({
      user: testLocalUser._id,
      packageId: "premium_3m",
      packageName: "Gói 3 Tháng",
      amount: 499000,
      durationDays: 90,
      status: "Pending",
      orderCode: 98765433,
    });

    await activateSubscriptionInternal(renewalSub);
    const renewedUser = await User.findById(testLocalUser._id);
    const newExpiry = renewedUser.premiumExpiresAt.getTime();
    const expectedExpiryMin = currentExpiry + (90 * 24 * 60 * 60 * 1000) - 10000;

    console.log(`✓ Hạn dùng trước gia hạn: ${new Date(currentExpiry).toISOString()}`);
    console.log(`✓ Hạn dùng sau khi gia hạn 90 ngày: ${new Date(newExpiry).toISOString()}`);

    if (newExpiry < expectedExpiryMin) {
      throw new Error("Gia hạn không cộng dồn nối tiếp vào hạn dùng hiện tại!");
    }
    console.log("✓ XÁC NHẬN: Gia hạn gói nối tiếp thành công mà không làm mất số ngày còn lại!");

    // DỌN DẸP DỮ LIỆU TEST
    await User.deleteMany({ email: { $regex: testEmailPrefix } });
    await BuddyProfile.deleteMany({ _id: { $in: [testBuddy._id, testStandardBuddy._id] } });
    await WithdrawalRequest.deleteOne({ _id: withdrawal._id });
    await PremiumSubscription.deleteMany({ user: testLocalUser._id });
    console.log("\n✓ Đã dọn dẹp sạch sẽ dữ liệu test.");

    console.log("\n=== TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ VƯỢT QUA 100% HOÀN HẢO! ===");
  } catch (err) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runVerification();

