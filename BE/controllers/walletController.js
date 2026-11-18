const crypto = require("crypto");
const qs = require("qs");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const PremiumSubscription = require("../models/PremiumSubscription");
const { getWalletSettings } = require("../utils/walletLedger");
const { transactionHistoryFilter } = require("../utils/walletHistory");
const Booking = require("../models/Booking");
const { notifyUser, notifyRole } = require("../utils/notifications");
const { settleLocalEarning } = require("../utils/walletLedger");
const {
  generateOrderCode,
  createPaymentLink,
  getPaymentLinkInformation,
  verifyWebhookData,
  isPayOSConfigured,
} = require("../utils/payos");

let exchangeRateCache = null;
let exchangeRateFetchedAt = 0;

async function notifyWalletChange(userId, role, amount, description) {
  const notification = {
    title: role === "admin" ? "Số dư ví Admin đã thay đổi" : "Số dư ví đã thay đổi",
    message: description || `Số dư ví đã thay đổi ${Number(amount || 0).toLocaleString("vi-VN")} đ.`,
    link: "/wallet",
    type: "wallet_changed",
  };
  if (role === "admin") {
    await notifyRole("admin", {
      ...notification,
    });
  } else {
    await notifyUser(userId, notification);
  }
}

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

function getVnPayDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const vnTime = new Date(date.getTime() + (date.getTimezoneOffset() + 420) * 60000);
  return (
    vnTime.getFullYear() +
    pad(vnTime.getMonth() + 1) +
    pad(vnTime.getDate()) +
    pad(vnTime.getHours()) +
    pad(vnTime.getMinutes()) +
    pad(vnTime.getSeconds())
  );
}

function getVNPayMessage(responseCode) {
  const map = {
    "00": "Giao dịch thành công.",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).",
    "09": "Thẻ/Tài khoản của bạn chưa đăng ký dịch vụ InternetBanking tại ngân hàng.",
    "10": "Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
    "11": "Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch.",
    "12": "Thẻ/Tài khoản của khách hàng bị khóa.",
    "13": "Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).",
    "24": "Khách hàng đã hủy giao dịch.",
    "51": "Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.",
    "65": "Tài khoản đã vượt quá hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng thanh toán đang bảo trì.",
    "79": "Nhập sai mật khẩu thanh toán quá số lần quy định.",
  };
  return map[responseCode] || `Giao dịch không thành công (Mã phản hồi: ${responseCode}).`;
}

// 1. Tạo thanh toán PayOS QR (Nạp tiền ví)
exports.createPayOSPaymentUrl = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Ví Admin không hỗ trợ nạp tiền." });
    }
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (!Number.isInteger(numAmount) || numAmount < 2000 || numAmount > 50000000) {
      return res.status(400).json({
        message: "Số tiền nạp tối thiểu là 5.000 VNĐ và tối đa là 50.000.000 VNĐ.",
      });
    }

    const orderCode = generateOrderCode();
    const clientUrl = process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:5173";
    const returnUrl = process.env.PAYOS_RETURN_URL || `${clientUrl}/payment/payos-return`;
    const cancelUrl = process.env.PAYOS_CANCEL_URL || `${clientUrl}/payment/payos-return?cancel=true`;

    const paymentLink = await createPaymentLink({
      orderCode,
      amount: numAmount,
      description: `LBTOPUP ${orderCode}`,
      returnUrl,
      cancelUrl,
      items: [
        {
          name: "Nap vi Local Buddy",
          quantity: 1,
          price: numAmount,
        },
      ],
    });

    const transaction = await Transaction.create({
      user: req.user._id,
      type: "TopUp",
      amount: numAmount,
      status: "Pending",
      orderId: String(orderCode),
      payosOrderCode: orderCode,
      payosPaymentLinkId: paymentLink.paymentLinkId || "",
      paymentMethod: "PAYOS_QR",
      description: `Nạp tiền ví Local Buddy (${numAmount.toLocaleString("vi-VN")} đ) qua PayOS-QR`,
    });

    return res.json({
      success: true,
      orderCode,
      orderId: String(orderCode),
      amount: numAmount,
      qrCodeUrl: paymentLink.qrCodeUrl,
      checkoutUrl: paymentLink.checkoutUrl,
      paymentUrl: paymentLink.checkoutUrl,
      bin: paymentLink.bin,
      accountNumber: paymentLink.accountNumber,
      accountName: paymentLink.accountName,
      description: paymentLink.description,
      transactionId: transaction._id,
      isMock: paymentLink.isMock || false,
    });
  } catch (error) {
    console.error("Lỗi tạo PayOS payment URL:", error);
    return res.status(500).json({ message: "Không thể tạo liên kết thanh toán PayOS." });
  }
};

// 1. Tạo URL thanh toán VNPay (Giữ lại để tương thích ngược, mặc định trỏ về PayOS)
exports.createPaymentUrl = exports.createPayOSPaymentUrl;

// 2. Xác thực và xử lý kết quả trả về từ VNPay (Return URL)
exports.handleVNPayReturn = async (req, res) => {
  try {
    const secretKey = process.env.VNP_HASH_SECRET || "XNBCJFAKAZQSGCSFRLZJTCZWTXNKGKYZ";
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    const orderId = vnp_Params.vnp_TxnRef;
    const responseCode = vnp_Params.vnp_ResponseCode;
    const transactionStatus = vnp_Params.vnp_TransactionStatus;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Thiếu mã đơn hàng giao dịch." });
    }

    if (signed.toLowerCase() !== (secureHash || "").toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Chữ ký bảo mật không hợp lệ (Checksum failed).",
      });
    }

    const transaction = await Transaction.findOne({ orderId }).populate("user", "fullName email walletBalance");
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giao dịch tương ứng." });
    }

    const isSuccess = responseCode === "00" && (!transactionStatus || transactionStatus === "00");

    if (isSuccess) {
      if (transaction.status !== "Completed") {
        transaction.status = "Completed";
        transaction.vnpTransactionNo = vnp_Params.vnp_TransactionNo || "";
        transaction.vnpBankCode = vnp_Params.vnp_BankCode || "";
        transaction.vnpPayDate = vnp_Params.vnp_PayDate || "";
        transaction.vnpResponseCode = responseCode;
        await transaction.save();

        const updatedUser = await User.findByIdAndUpdate(
          transaction.user._id,
          { $inc: { walletBalance: transaction.amount } },
          { new: true }
        );
        await notifyWalletChange(updatedUser._id, transaction.user.role, transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);

        return res.json({
          success: true,
          message: "Nạp tiền vào ví Local Buddy thành công!",
          orderId,
          amount: transaction.amount,
          newBalance: updatedUser.walletBalance,
          bankCode: vnp_Params.vnp_BankCode || "VNPAYQR",
          transactionNo: vnp_Params.vnp_TransactionNo,
          payDate: vnp_Params.vnp_PayDate,
          user: {
            _id: updatedUser._id,
            fullName: updatedUser.fullName,
            walletBalance: updatedUser.walletBalance,
          },
        });
      }

      const user = await User.findById(transaction.user._id);
      return res.json({
        success: true,
        message: "Giao dịch đã được ghi nhận thành công.",
        orderId,
        amount: transaction.amount,
        newBalance: user?.walletBalance || 0,
        bankCode: transaction.vnpBankCode,
        transactionNo: transaction.vnpTransactionNo,
        payDate: transaction.vnpPayDate,
        user: {
          _id: user._id,
          fullName: user.fullName,
          walletBalance: user.walletBalance,
        },
      });
    }

    if (transaction.status === "Pending") {
      transaction.status = "Failed";
      transaction.vnpResponseCode = responseCode;
      await transaction.save();
    }

    return res.status(400).json({
      success: false,
      message: getVNPayMessage(responseCode),
      orderId,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error("Lỗi xác thực VNPay Return:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý kết quả VNPay." });
  }
};

// 3. Xử lý IPN từ VNPay Server
exports.handleVNPayIpn = async (req, res) => {
  try {
    const secretKey = process.env.VNP_HASH_SECRET || "XNBCJFAKAZQSGCSFRLZJTCZWTXNKGKYZ";
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (signed.toLowerCase() !== (secureHash || "").toLowerCase()) {
      return res.status(200).json({ RspCode: "97", Message: "Checksum failed" });
    }

    const orderId = vnp_Params.vnp_TxnRef;
    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) {
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    }

    if (transaction.amount * 100 !== Number(vnp_Params.vnp_Amount)) {
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }

    if (transaction.status === "Completed") {
      return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
    }

    if (vnp_Params.vnp_ResponseCode === "00") {
      transaction.status = "Completed";
      transaction.vnpTransactionNo = vnp_Params.vnp_TransactionNo || "";
      transaction.vnpBankCode = vnp_Params.vnp_BankCode || "";
      transaction.vnpPayDate = vnp_Params.vnp_PayDate || "";
      await transaction.save();

      await User.findByIdAndUpdate(transaction.user, {
        $inc: { walletBalance: transaction.amount },
      });
      await notifyWalletChange(transaction.user, "traveler", transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);
      return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
    } else {
      transaction.status = "Failed";
      await transaction.save();
      return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
    }
  } catch (err) {
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

// 4. Lấy lịch sử giao dịch ví của người dùng
exports.getMyTransactions = async (req, res) => {
  try {
    const filter = transactionHistoryFilter(req.user);
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .populate("user", "fullName role")
      .populate("booking", "date status price");
    return res.json({ transactions });
  } catch (error) {
    console.error("Load wallet transactions error:", error);
    return res.status(500).json({ message: "Không thể lấy lịch sử giao dịch ví." });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Transaction.find({ type: "Withdrawal", status: "Pending" })
      .sort({ createdAt: -1 })
      .populate("user", "fullName role");
    return res.json({ withdrawals });
  } catch (error) {
    console.error("Load pending withdrawals error:", error);
    return res.status(500).json({ message: "Không thể tải yêu cầu rút tiền." });
  }
};

// 5. Mô phỏng nạp tiền thành công cho môi trường test/sandbox
exports.simulateTopUp = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Ví Admin không hỗ trợ nạp tiền." });
    }
    const { amount = 50000, orderId } = req.body;
    const numAmount = Math.max(2000, Number(amount) || 50000);

    let transaction;
    if (orderId) {
      transaction = await Transaction.findOne({ orderId, user: req.user._id });
    }

    if (!transaction) {
      transaction = await Transaction.create({
        user: req.user._id,
        type: "TopUp",
        amount: numAmount,
        status: "Pending",
        orderId: `SIM${Date.now()}`,
        paymentMethod: "VNPAY_QR",
        description: `Nạp tiền ví Local Buddy qua VNPAY-QR (Mô phỏng Sandbox)`,
      });
    }

    transaction.status = "Completed";
    transaction.vnpTransactionNo = `SIM${Date.now()}`;
    transaction.vnpBankCode = "VNPAYQR";
    transaction.vnpPayDate = getVnPayDateString();
    transaction.vnpResponseCode = "00";
    await transaction.save();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: transaction.amount } },
      { new: true }
    );
    await notifyWalletChange(user._id, req.user.role, transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);

    return res.json({
      success: true,
      message: `Mô phỏng nạp thành công ${transaction.amount.toLocaleString("vi-VN")} đ vào ví Local Buddy!`,
      transaction,
      newBalance: user.walletBalance,
      user: {
        _id: user._id,
        fullName: user.fullName,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Lỗi mô phỏng nạp tiền:", error);
    return res.status(500).json({ message: "Lỗi mô phỏng nạp tiền." });
  }
};

// 6. Xác nhận hoàn tất quét mã QR (từ modal quét mã trực tiếp)
exports.confirmDeposit = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Ví Admin không hỗ trợ nạp tiền." });
    }
    const { orderId, orderCode } = req.body;
    const code = orderCode || orderId;
    if (!code) {
      return res.status(400).json({ message: "Thiếu mã đơn hàng giao dịch." });
    }
    const numOrderCode = Number(code);

    const transaction = await Transaction.findOne({
      $or: [
        { payosOrderCode: numOrderCode || 0 },
        { orderId: String(code) },
      ],
      user: req.user._id,
    });
    if (!transaction) {
      return res.status(404).json({ message: "Không tìm thấy giao dịch tương ứng." });
    }

    if (transaction.status === "Completed") {
      const user = await User.findById(req.user._id);
      return res.json({
        success: true,
        message: "Giao dịch đã được ghi nhận trước đó.",
        newBalance: user?.walletBalance || 0,
        transaction,
      });
    }

    if (isPayOSConfigured()) {
      const info = await getPaymentLinkInformation(numOrderCode || transaction.payosOrderCode);
      if (info && info.status !== "PAID") {
        return res.status(400).json({
          message: "PayOS chưa ghi nhận thanh toán thành công. Vui lòng thử lại sau vài giây hoặc kiểm tra ứng dụng ngân hàng.",
          status: info.status,
        });
      }
    }

    transaction.status = "Completed";
    transaction.payosStatus = "PAID";
    transaction.vnpTransactionNo = `QR${Date.now()}`;
    transaction.vnpBankCode = "PAYOS";
    transaction.vnpPayDate = getVnPayDateString();
    transaction.vnpResponseCode = "00";
    await transaction.save();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: transaction.amount } },
      { new: true }
    );
    await notifyWalletChange(user._id, req.user.role, transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);

    return res.json({
      success: true,
      message: `Đã xác nhận nạp ${transaction.amount.toLocaleString("vi-VN")} đ vào ví thành công!`,
      newBalance: user.walletBalance,
      transaction,
      user: {
        _id: user._id,
        fullName: user.fullName,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Lỗi xác nhận nạp tiền:", error);
    return res.status(500).json({ message: "Lỗi xác nhận nạp tiền." });
  }
};

// 7. Kiểm tra trạng thái giao dịch PayOS (cho polling từ FE)
exports.checkPayOSStatus = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const numOrderCode = Number(orderCode);

    const transaction = await Transaction.findOne({
      $or: [
        { payosOrderCode: numOrderCode || 0 },
        { orderId: String(orderCode) },
      ],
      user: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Không tìm thấy giao dịch." });
    }

    if (transaction.status === "Completed") {
      const user = await User.findById(req.user._id).select("walletBalance");
      return res.json({
        success: true,
        completed: true,
        status: "PAID",
        newBalance: user?.walletBalance || 0,
      });
    }

    if (isPayOSConfigured()) {
      const payosInfo = await getPaymentLinkInformation(numOrderCode || transaction.payosOrderCode);
      if (payosInfo && payosInfo.status === "PAID") {
        transaction.status = "Completed";
        transaction.payosStatus = "PAID";
        await transaction.save();

        const user = await User.findByIdAndUpdate(
          transaction.user,
          { $inc: { walletBalance: transaction.amount } },
          { new: true }
        );
        await notifyWalletChange(user._id, req.user.role, transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);

        return res.json({
          success: true,
          completed: true,
          status: "PAID",
          newBalance: user?.walletBalance || 0,
        });
      }
      return res.json({
        success: true,
        completed: false,
        status: payosInfo?.status || transaction.status,
      });
    }

    return res.json({
      success: true,
      completed: false,
      status: transaction.status,
    });
  } catch (error) {
    console.error("Check PayOS status error:", error);
    return res.status(500).json({ message: "Lỗi kiểm tra trạng thái PayOS." });
  }
};

// 8. Xử lý kết quả trả về từ PayOS Web Checkout (Return URL)
exports.handlePayOSReturn = async (req, res) => {
  try {
    const { orderCode, status, cancel } = req.query;
    const numOrderCode = Number(orderCode);

    if (!orderCode) {
      return res.status(400).json({ success: false, message: "Thiếu mã đơn hàng." });
    }

    const transaction = await Transaction.findOne({
      $or: [
        { payosOrderCode: numOrderCode || 0 },
        { orderId: String(orderCode) },
      ],
    }).populate("user", "fullName email walletBalance");

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giao dịch." });
    }

    if (cancel === "true" || status === "CANCELLED") {
      if (transaction.status === "Pending") {
        transaction.status = "Failed";
        transaction.payosStatus = "CANCELLED";
        await transaction.save();
      }
      return res.json({
        success: false,
        message: "Giao dịch thanh toán đã bị hủy.",
        orderCode: numOrderCode || transaction.payosOrderCode,
        amount: transaction.amount,
      });
    }

    let isPaid = status === "PAID";
    if (!isPaid && isPayOSConfigured()) {
      const info = await getPaymentLinkInformation(numOrderCode || transaction.payosOrderCode);
      if (info?.status === "PAID") isPaid = true;
    }

    if (isPaid || transaction.status === "Completed") {
      if (transaction.status !== "Completed") {
        transaction.status = "Completed";
        transaction.payosStatus = "PAID";
        await transaction.save();

        if (transaction.type === "TopUp") {
          const updatedUser = await User.findByIdAndUpdate(
            transaction.user._id,
            { $inc: { walletBalance: transaction.amount } },
            { new: true }
          );
          await notifyWalletChange(updatedUser._id, transaction.user.role, transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);
          return res.json({
            success: true,
            message: "Nạp tiền vào ví Local Buddy thành công!",
            orderCode: numOrderCode || transaction.payosOrderCode,
            amount: transaction.amount,
            newBalance: updatedUser.walletBalance,
            user: updatedUser,
          });
        } else if (transaction.type === "Booking") {
          const Booking = require("../models/Booking");
          const booking = await Booking.findById(transaction.booking);
          if (booking && booking.paymentStatus !== "Paid") {
            const { holdBookingFunds } = require("../utils/walletLedger");
            await holdBookingFunds(booking, transaction.user._id, "PAYOS_QR", false);
          }
          return res.json({
            success: true,
            message: "Thanh toán đặt lịch thành công!",
            orderCode: numOrderCode || transaction.payosOrderCode,
            amount: transaction.amount,
            bookingId: transaction.booking,
          });
        } else if (transaction.type === "PremiumSubscription") {
          const { activateSubscriptionInternal } = require("./premiumController");
          const sub = await PremiumSubscription.findOne({
            $or: [
              { orderCode: numOrderCode || transaction.payosOrderCode },
              { _id: transaction.relatedSubscription },
            ],
          });
          if (sub) {
            await activateSubscriptionInternal(sub);
          }
          return res.json({
            success: true,
            message: "Đăng ký Local Premium thành công!",
            orderCode: numOrderCode || transaction.payosOrderCode,
            amount: transaction.amount,
            isPremium: true,
          });
        }
      }

      const user = await User.findById(transaction.user._id);
      return res.json({
        success: true,
        message: "Giao dịch đã được ghi nhận thành công.",
        orderCode: numOrderCode || transaction.payosOrderCode,
        amount: transaction.amount,
        newBalance: user?.walletBalance || 0,
        user,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Thanh toán chưa hoàn tất.",
      status,
      orderCode: numOrderCode || transaction.payosOrderCode,
    });
  } catch (error) {
    console.error("PayOS return error:", error);
    return res.status(500).json({ success: false, message: "Lỗi xử lý kết quả PayOS." });
  }
};

// 9. Xử lý webhook từ server PayOS
exports.handlePayOSWebhook = async (req, res) => {
  try {
    let webhookData = req.body?.data;
    if (isPayOSConfigured()) {
      webhookData = await verifyWebhookData(req.body);
    }
    if (!webhookData || !webhookData.orderCode) {
      return res.status(200).json({ success: false, message: "Dữ liệu webhook không hợp lệ" });
    }

    const { orderCode, code } = webhookData;
    const numOrderCode = Number(orderCode);

    const transaction = await Transaction.findOne({
      $or: [
        { payosOrderCode: numOrderCode },
        { orderId: String(orderCode) },
      ],
    });

    if (!transaction) {
      return res.status(200).json({ success: false, message: "Order not found" });
    }

    if (transaction.status === "Completed") {
      return res.status(200).json({ success: true, message: "Order already completed" });
    }

    if (code === "00") {
      transaction.status = "Completed";
      transaction.payosStatus = "PAID";
      await transaction.save();

      if (transaction.type === "TopUp") {
        await User.findByIdAndUpdate(transaction.user, {
          $inc: { walletBalance: transaction.amount },
        });
        await notifyWalletChange(transaction.user, "traveler", transaction.amount, `Ví đã được cộng ${transaction.amount.toLocaleString("vi-VN")} đ.`);
      } else if (transaction.type === "Booking") {
        const Booking = require("../models/Booking");
        const booking = await Booking.findById(transaction.booking);
        if (booking && booking.paymentStatus !== "Paid") {
          const { holdBookingFunds } = require("../utils/walletLedger");
          await holdBookingFunds(booking, transaction.user, "PAYOS_QR", false);
        }
      } else if (transaction.type === "PremiumSubscription") {
        const { activateSubscriptionInternal } = require("./premiumController");
        const sub = await PremiumSubscription.findOne({
          $or: [
            { orderCode: numOrderCode },
            { _id: transaction.relatedSubscription },
          ],
        });
        if (sub) {
          await activateSubscriptionInternal(sub);
        }
      }
    } else {
      transaction.status = "Failed";
      transaction.payosStatus = code;
      await transaction.save();
    }

    return res.status(200).json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    console.error("PayOS webhook error:", error);
    return res.status(200).json({ success: false, message: error.message });
  }
};

exports.getOverview = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const settings = await getWalletSettings();
      const adminBalance = settings.adminBalance || 0;
      const adminPending = settings.adminPendingWithdrawalAmount || 0;
      const availableBalance = Math.max(0, adminBalance - adminPending);
      return res.json({
        role: "admin",
        systemBalance: settings.systemBalance || 0,
        adminBalance,
        balance: adminBalance,
        walletBalance: adminBalance,
        pendingWithdrawalAmount: adminPending,
        availableBalance,
        commissions: {
          standard: settings.standardCommissionPercent,
          premium: settings.premiumCommissionPercent,
        },
        isPremium: false,
      });
    }

    const user = await User.findById(req.user._id).select(
      "walletBalance pendingWithdrawalAmount isPremium premiumStatus premiumStartedAt premiumExpiresAt role fullName email"
    );
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản." });

    // Kiểm tra hết hạn Premium tự động
    if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
      user.isPremium = false;
      user.premiumStatus = "Expired";
      await user.save();
      const BuddyProfile = require("../models/BuddyProfile");
      await BuddyProfile.updateOne({ user: user._id }, { $set: { isPremium: false } });
    }

    const walletBalance = user.walletBalance || 0;
    const pendingWithdrawalAmount = user.pendingWithdrawalAmount || 0;
    const availableBalance = Math.max(0, walletBalance - pendingWithdrawalAmount);
    const settings = await getWalletSettings();

    res.json({
      role: req.user.role,
      balance: walletBalance,
      walletBalance,
      pendingWithdrawalAmount,
      availableBalance,
      isPremium: Boolean(user.isPremium),
      premiumStatus: user.premiumStatus,
      premiumStartedAt: user.premiumStartedAt,
      premiumExpiresAt: user.premiumExpiresAt,
      commissions: {
        standard: settings.standardCommissionPercent,
        premium: settings.premiumCommissionPercent,
      },
    });
  } catch (error) {
    console.error("Load wallet overview error:", error);
    res.status(500).json({ message: "Không thể tải thông tin ví." });
  }
};

exports.getPendingSettlements = async (req, res) => {
  try {
    const bookings = await Booking.find({ status: "Completed", settlementStatus: "Pending" })
      .populate("customer", "fullName email")
      .populate({
        path: "buddy",
        select: "fullName area user",
        populate: { path: "user", select: "fullName email" },
      })
      .populate("feedback.author", "fullName")
      .populate("feedback.repliedBy", "fullName")
      .sort({ updatedAt: -1 })
      .limit(200);
    res.json(bookings);
  } catch (error) {
    console.error("Load pending local settlements error:", error);
    res.status(500).json({ message: "Không thể tải danh sách tất toán." });
  }
};

exports.settleLocalBooking = async (req, res) => {
  try {
    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã yêu cầu tất toán không hợp lệ." });
    }
    const booking = await Booking.findOne({
      _id: req.params.id,
      status: "Completed",
      settlementStatus: "Pending",
    });
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy khoản tất toán đang chờ." });
    }
    if (!(await settleLocalEarning(booking))) {
      return res.status(409).json({ message: "Khoản tất toán vừa được xử lý hoặc không còn hợp lệ." });
    }
    const buddy = await require("../models/BuddyProfile")
      .findById(booking.buddy)
      .populate("user", "fullName email");
    const localName = buddy?.user?.fullName || "Local";
    await notifyWalletChange(
      buddy?.user?._id,
      "local",
      booking.localEarning,
      `Admin đã tất toán ${booking.localEarning.toLocaleString("vi-VN")} đ vào ví.`,
    );
    await notifyRole("admin", {
      title: "Đã tất toán cho Local",
      message: `Đã thanh toán ${booking.localEarning.toLocaleString("vi-VN")} đ cho ${localName}.`,
      link: "/wallet",
      type: "local_settlement",
      booking: booking._id,
    });
    res.json({
      success: true,
      bookingId: booking._id,
      settlementStatus: "Completed",
      amount: booking.localEarning,
    });
  } catch (error) {
    console.error("Settle local booking earnings error:", error);
    res.status(500).json({ message: "Không thể tất toán khoản thu nhập cho Local." });
  }
};

exports.updateCommission = async (req, res) => {
  const { standard, premium } = req.body;
  if (
    !Number.isFinite(Number(standard)) ||
    !Number.isFinite(Number(premium)) ||
    Number(standard) < 0 ||
    Number(standard) > 100 ||
    Number(premium) < 0 ||
    Number(premium) > 100
  ) {
    return res.status(400).json({ message: "Hoa hồng phải nằm trong khoảng 0–100%." });
  }
  try {
    const settings = await getWalletSettings();
    settings.standardCommissionPercent = Number(standard);
    settings.premiumCommissionPercent = Number(premium);
    await settings.save();

    // Đồng bộ cấu hình hoa hồng mới nhất vào các gói Premium đang hoạt động
    try {
      const PremiumSubscription = require("../models/PremiumSubscription");
      await PremiumSubscription.updateMany(
        { status: "Active" },
        {
          $set: {
            "metadata.appliedStandardCommission": settings.standardCommissionPercent,
            "metadata.appliedPremiumCommission": settings.premiumCommissionPercent,
            "metadata.updatedAt": new Date(),
          },
        },
      );
    } catch (subErr) {
      console.warn("Không thể cập nhật metadata gói Premium active:", subErr.message);
    }

    res.json({
      commissions: {
        standard: settings.standardCommissionPercent,
        premium: settings.premiumCommissionPercent,
      },
    });
  } catch (error) {
    console.error("Update commission settings error:", error);
    res.status(500).json({ message: "Không thể lưu cấu hình hoa hồng." });
  }
};

// POST /api/wallet/withdraw (Người dùng hoặc Admin tạo yêu cầu rút tiền)
exports.requestWithdrawal = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const { bankName, bankCode = "", accountNumber, accountName, note = "" } = req.body;

    if (!Number.isSafeInteger(amount) || amount < 1000) {
      return res.status(400).json({ message: "Số tiền rút tối thiểu là 1.000 VNĐ." });
    }

    if (
      typeof bankName !== "string" ||
      !bankName.trim() ||
      typeof accountNumber !== "string" ||
      !/^\d{6,40}$/.test(accountNumber.trim()) ||
      typeof accountName !== "string" ||
      !accountName.trim()
    ) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin: Ngân hàng, Số tài khoản (6-40 chữ số) và Tên chủ tài khoản.",
      });
    }

    const cleanBankName = bankName.trim();
    const cleanAccountNumber = accountNumber.trim();
    const cleanAccountName = accountName.trim().toUpperCase();
    const cleanNote = typeof note === "string" ? note.trim() : "";

    const userRole = req.user.role;
    const walletOwner = userRole === "admin" ? "Admin" : "User";

    // Thực hiện giữ tiền (reserve) vào pendingWithdrawalAmount một cách nguyên tử
    if (userRole === "admin") {
      const settings = await getWalletSettings();
      const updated = await require("../models/WalletSettings").findOneAndUpdate(
        {
          _id: settings._id,
          $expr: {
            $gte: [
              { $subtract: ["$adminBalance", { $ifNull: ["$adminPendingWithdrawalAmount", 0] }] },
              amount,
            ],
          },
        },
        { $inc: { adminPendingWithdrawalAmount: amount } },
        { new: true },
      );
      if (!updated) {
        return res.status(400).json({ message: "Số dư khả dụng của ví Admin không đủ để tạo yêu cầu rút." });
      }
    } else {
      const updated = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          $expr: {
            $gte: [
              { $subtract: ["$walletBalance", { $ifNull: ["$pendingWithdrawalAmount", 0] }] },
              amount,
            ],
          },
        },
        { $inc: { pendingWithdrawalAmount: amount } },
        { new: true },
      );
      if (!updated) {
        return res.status(400).json({ message: "Số dư khả dụng trong ví không đủ để tạo yêu cầu rút tiền." });
      }
    }

    // Tạo yêu cầu rút tiền với trạng thái Pending
    const withdrawal = await WithdrawalRequest.create({
      user: req.user._id,
      userRole,
      amount,
      bankName: cleanBankName,
      bankCode: bankCode ? bankCode.trim() : "",
      accountNumber: cleanAccountNumber,
      accountName: cleanAccountName,
      note: cleanNote,
      status: "Pending",
      history: [
        {
          action: "Tạo yêu cầu rút tiền",
          performedBy: req.user._id,
          timestamp: new Date(),
          note: cleanNote || "Khởi tạo yêu cầu rút tiền về tài khoản ngân hàng",
          details: {
            amount,
            bankName: cleanBankName,
            accountNumber: cleanAccountNumber,
            accountName: cleanAccountName,
          },
        },
      ],
    });

    // Tạo bản ghi Transaction tạm giữ
    const transaction = await Transaction.create({
      user: req.user._id,
      type: "WithdrawalReserved",
      amount,
      status: "Pending",
      walletOwner,
      paymentMethod: "Bank Transfer",
      relatedWithdrawal: withdrawal._id,
      description: `Tạm giữ ${amount.toLocaleString("vi-VN")} đ để xử lý yêu cầu rút tiền về ${cleanBankName} (${cleanAccountNumber})`,
      withdrawalDetails: {
        bankName: cleanBankName,
        accountNumber: cleanAccountNumber,
        accountName: cleanAccountName,
      },
    });

    await notifyUser(req.user._id, {
      title: "Yêu cầu rút tiền đang chờ xử lý",
      message: `Yêu cầu rút ${amount.toLocaleString("vi-VN")} đ về ${cleanBankName} đã được tiếp nhận và đang chờ Admin xử lý.`,
      link: "/wallet",
      type: "withdrawal_pending",
    });

    await notifyRole("admin", {
      title: "Yêu cầu rút tiền mới",
      message: `Người dùng ${req.user.fullName} (${userRole}) đã gửi yêu cầu rút ${amount.toLocaleString("vi-VN")} đ.`,
      link: "/admin/dashboard",
      type: "withdrawal_requested",
    });

    return res.status(201).json({
      success: true,
      message: "Tạo yêu cầu rút tiền thành công. Yêu cầu đang được chờ xử lý.",
      withdrawal,
      transaction,
    });
  } catch (error) {
    console.error("Lỗi tạo yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể tạo yêu cầu rút tiền. Vui lòng thử lại." });
  }
};

// GET /api/wallet/withdrawals/mine (Lấy danh sách yêu cầu rút tiền của user)
exports.getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("processedBy", "fullName email")
      .populate("completedBy", "fullName email");
    return res.json({ success: true, withdrawals });
  } catch (error) {
    console.error("Lỗi lấy danh sách rút tiền của tôi:", error);
    return res.status(500).json({ message: "Không thể lấy danh sách yêu cầu rút tiền." });
  }
};

// GET /api/wallet/withdrawals/:id (Chi tiết yêu cầu rút tiền)
exports.getWithdrawalDetail = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id)
      .populate("user", "fullName email phone role")
      .populate("processedBy", "fullName email")
      .populate("completedBy", "fullName email")
      .populate("history.performedBy", "fullName role");

    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (req.user.role !== "admin" && String(withdrawal.user._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "Bạn không có quyền xem yêu cầu rút tiền này." });
    }

    return res.json({ success: true, withdrawal });
  } catch (error) {
    console.error("Lỗi lấy chi tiết yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể lấy thông tin yêu cầu rút tiền." });
  }
};

// PATCH /api/wallet/withdrawals/:id (Chỉnh sửa khi còn Pending)
exports.updatePendingWithdrawal = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (String(withdrawal.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa yêu cầu này." });
    }

    if (withdrawal.status !== "Pending") {
      return res.status(400).json({
        message: "Chỉ có thể chỉnh sửa yêu cầu khi ở trạng thái Chờ xử lý (Pending).",
      });
    }

    const { bankName, bankCode, accountNumber, accountName, note, amount } = req.body;

    // Nếu người dùng thay đổi số tiền rút
    if (amount !== undefined && Number(amount) !== withdrawal.amount) {
      const newAmount = Number(amount);
      if (!Number.isSafeInteger(newAmount) || newAmount < 1000) {
        return res.status(400).json({ message: "Số tiền rút mới không hợp lệ." });
      }
      const delta = newAmount - withdrawal.amount;
      if (delta > 0) {
        // Cần giữ thêm delta
        const user = await User.findOneAndUpdate(
          {
            _id: req.user._id,
            $expr: {
              $gte: [
                { $subtract: ["$walletBalance", { $ifNull: ["$pendingWithdrawalAmount", 0] }] },
                delta,
              ],
            },
          },
          { $inc: { pendingWithdrawalAmount: delta } },
          { new: true },
        );
        if (!user) {
          return res.status(400).json({ message: "Số dư khả dụng không đủ để tăng số tiền rút." });
        }
      } else if (delta < 0) {
        // Giảm số tiền giữ
        await User.updateOne(
          { _id: req.user._id },
          { $inc: { pendingWithdrawalAmount: delta } }
        );
      }
      withdrawal.amount = newAmount;
    }

    if (bankName) withdrawal.bankName = bankName.trim();
    if (bankCode !== undefined) withdrawal.bankCode = bankCode.trim();
    if (accountNumber) withdrawal.accountNumber = accountNumber.trim();
    if (accountName) withdrawal.accountName = accountName.trim().toUpperCase();
    if (note !== undefined) withdrawal.note = note.trim();

    withdrawal.history.push({
      action: "Chỉnh sửa thông tin",
      performedBy: req.user._id,
      timestamp: new Date(),
      note: "Người dùng cập nhật thông tin yêu cầu rút tiền",
      details: {
        bankName: withdrawal.bankName,
        accountNumber: withdrawal.accountNumber,
        accountName: withdrawal.accountName,
        amount: withdrawal.amount,
      },
    });

    await withdrawal.save();

    return res.json({
      success: true,
      message: "Cập nhật yêu cầu rút tiền thành công.",
      withdrawal,
    });
  } catch (error) {
    console.error("Lỗi cập nhật yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể cập nhật yêu cầu rút tiền." });
  }
};

// PATCH /api/wallet/withdrawals/:id/cancel (Hủy khi còn Pending)
exports.cancelPendingWithdrawal = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (req.user.role !== "admin" && String(withdrawal.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Bạn không có quyền hủy yêu cầu này." });
    }

    if (withdrawal.status !== "Pending") {
      return res.status(400).json({
        message: "Chỉ có thể hủy yêu cầu khi đang ở trạng thái Chờ xử lý (Pending).",
      });
    }

    // Hoàn trả số tiền tạm giữ về số dư khả dụng
    if (withdrawal.userRole === "admin") {
      const settings = await getWalletSettings();
      await require("../models/WalletSettings").updateOne(
        { _id: settings._id },
        { $inc: { adminPendingWithdrawalAmount: -withdrawal.amount } }
      );
    } else {
      await User.updateOne(
        { _id: withdrawal.user },
        { $inc: { pendingWithdrawalAmount: -withdrawal.amount } }
      );
    }

    withdrawal.status = "Cancelled";
    withdrawal.history.push({
      action: "Hủy yêu cầu",
      performedBy: req.user._id,
      timestamp: new Date(),
      note: req.body.reason || "Người dùng đã hủy yêu cầu rút tiền",
    });
    await withdrawal.save();

    // Tạo bản ghi giao dịch giải phóng tiền giữ
    await Transaction.create({
      user: withdrawal.user,
      type: "WithdrawalReleased",
      amount: withdrawal.amount,
      status: "Completed",
      walletOwner: withdrawal.userRole === "admin" ? "Admin" : "User",
      relatedWithdrawal: withdrawal._id,
      description: `Giải phóng ${withdrawal.amount.toLocaleString("vi-VN")} đ tiền tạm giữ do hủy yêu cầu rút tiền`,
    });

    await notifyUser(withdrawal.user, {
      title: "Yêu cầu rút tiền đã được hủy",
      message: `Đã hoàn lại ${withdrawal.amount.toLocaleString("vi-VN")} đ vào số dư khả dụng của bạn.`,
      link: "/wallet",
      type: "withdrawal_cancelled",
    });

    return res.json({
      success: true,
      message: "Đã hủy yêu cầu rút tiền thành công. Số dư khả dụng đã được khôi phục.",
      withdrawal,
    });
  } catch (error) {
    console.error("Lỗi hủy yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể hủy yêu cầu rút tiền." });
  }
};

// GET /api/wallet/admin/withdrawals (Danh sách yêu cầu rút tiền cho Admin)
exports.getAdminWithdrawals = async (req, res) => {
  try {
    const { status, role, search, from, to, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== "All") {
      query.status = status;
    }
    if (role && role !== "All") {
      query.userRole = role;
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    if (search && search.trim()) {
      const keyword = search.trim();
      const users = await User.find({
        $or: [
          { fullName: { $regex: keyword, $options: "i" } },
          { email: { $regex: keyword, $options: "i" } },
        ],
      }).select("_id");
      const userIds = users.map((u) => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { accountNumber: { $regex: keyword, $options: "i" } },
        { accountName: { $regex: keyword, $options: "i" } },
        { bankTransactionCode: { $regex: keyword, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, withdrawals] = await Promise.all([
      WithdrawalRequest.countDocuments(query),
      WithdrawalRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user", "fullName email phone role walletBalance pendingWithdrawalAmount")
        .populate("processedBy", "fullName email")
        .populate("completedBy", "fullName email"),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      withdrawals,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách rút tiền cho Admin:", error);
    return res.status(500).json({ message: "Không thể tải danh sách yêu cầu rút tiền." });
  }
};

// PATCH /api/wallet/admin/withdrawals/:id/process (Admin bắt đầu xử lý)
exports.processWithdrawal = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (withdrawal.status !== "Pending") {
      return res.status(400).json({
        message: `Chỉ có thể chuyển sang Đang xử lý khi yêu cầu đang ở trạng thái Chờ duyệt. (Hiện tại: ${withdrawal.status})`,
      });
    }

    withdrawal.status = "Processing";
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    withdrawal.history.push({
      action: "Bắt đầu xử lý",
      performedBy: req.user._id,
      timestamp: new Date(),
      note: req.body.adminNote || "Admin bắt đầu tiến hành kiểm tra và thực hiện chuyển khoản.",
    });
    await withdrawal.save();

    await notifyUser(withdrawal.user, {
      title: "Yêu cầu rút tiền đang được xử lý",
      message: `Yêu cầu rút ${withdrawal.amount.toLocaleString("vi-VN")} đ của bạn đang được Admin thực hiện chuyển khoản.`,
      link: "/wallet",
      type: "withdrawal_processing",
    });

    return res.json({
      success: true,
      message: "Đã cập nhật trạng thái sang Đang xử lý (Processing).",
      withdrawal,
    });
  } catch (error) {
    console.error("Lỗi xử lý yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái xử lý." });
  }
};

// PATCH /api/wallet/admin/withdrawals/:id/complete (Admin xác nhận đã chuyển khoản thành công)
exports.completeWithdrawal = async (req, res) => {
  try {
    const { bankTransactionCode, transferDate, adminNote = "" } = req.body;
    if (!bankTransactionCode || !bankTransactionCode.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập Mã giao dịch ngân hàng / Mã tham chiếu chuyển khoản.",
      });
    }

    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (!["Pending", "Processing"].includes(withdrawal.status)) {
      return res.status(400).json({
        message: `Không thể hoàn tất yêu cầu ở trạng thái ${withdrawal.status}.`,
      });
    }

    const cleanTxCode = bankTransactionCode.trim();
    const cleanTransferDate = transferDate ? new Date(transferDate) : new Date();

    // Trừ số dư thực tế và giải phóng số tiền tạm giữ
    if (withdrawal.userRole === "admin") {
      const settings = await getWalletSettings();
      await require("../models/WalletSettings").updateOne(
        { _id: settings._id },
        {
          $inc: {
            adminBalance: -withdrawal.amount,
            adminPendingWithdrawalAmount: -withdrawal.amount,
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: withdrawal.user },
        {
          $inc: {
            walletBalance: -withdrawal.amount,
            pendingWithdrawalAmount: -withdrawal.amount,
          },
        }
      );
    }

    withdrawal.status = "Completed";
    withdrawal.completedBy = req.user._id;
    withdrawal.completedAt = new Date();
    withdrawal.bankTransactionCode = cleanTxCode;
    withdrawal.transferDate = cleanTransferDate;
    withdrawal.adminNote = adminNote.trim();

    withdrawal.history.push({
      action: "Hoàn tất chuyển khoản",
      performedBy: req.user._id,
      timestamp: new Date(),
      note: adminNote.trim() || `Admin đã chuyển tiền thành công với Mã GD: ${cleanTxCode}`,
      details: {
        bankTransactionCode: cleanTxCode,
        transferDate: cleanTransferDate,
      },
    });
    await withdrawal.save();

    // Ghi nhận bản ghi Transaction rút tiền hoàn tất
    await Transaction.create({
      user: withdrawal.user,
      type: "WithdrawalCompleted",
      amount: withdrawal.amount,
      status: "Completed",
      walletOwner: withdrawal.userRole === "admin" ? "Admin" : "User",
      paymentMethod: "Bank Transfer",
      relatedWithdrawal: withdrawal._id,
      description: `Rút tiền thành công ${withdrawal.amount.toLocaleString("vi-VN")} đ về ${withdrawal.bankName} (${withdrawal.accountNumber}). Mã GD: ${cleanTxCode}`,
      withdrawalDetails: {
        bankName: withdrawal.bankName,
        accountNumber: withdrawal.accountNumber,
        accountName: withdrawal.accountName,
      },
    });

    await notifyUser(withdrawal.user, {
      title: "Rút tiền thành công!",
      message: `Đã hoàn tất chuyển ${withdrawal.amount.toLocaleString("vi-VN")} đ về tài khoản ${withdrawal.bankName} (${withdrawal.accountNumber}). Mã GD: ${cleanTxCode}`,
      link: "/wallet",
      type: "withdrawal_completed",
    });

    return res.json({
      success: true,
      message: "Đã xác nhận chuyển khoản rút tiền thành công.",
      withdrawal,
    });
  } catch (error) {
    console.error("Lỗi xác nhận hoàn tất rút tiền:", error);
    return res.status(500).json({ message: "Không thể hoàn tất yêu cầu rút tiền." });
  }
};

// PATCH /api/wallet/admin/withdrawals/:id/reject (Admin từ chối yêu cầu)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { rejectionReason, adminNote = "" } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do từ chối yêu cầu rút tiền.",
      });
    }

    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (!["Pending", "Processing"].includes(withdrawal.status)) {
      return res.status(400).json({
        message: `Không thể từ chối yêu cầu ở trạng thái ${withdrawal.status}.`,
      });
    }

    const cleanReason = rejectionReason.trim();

    // Giải phóng số tiền tạm giữ lại cho số dư khả dụng
    if (withdrawal.userRole === "admin") {
      const settings = await getWalletSettings();
      await require("../models/WalletSettings").updateOne(
        { _id: settings._id },
        { $inc: { adminPendingWithdrawalAmount: -withdrawal.amount } }
      );
    } else {
      await User.updateOne(
        { _id: withdrawal.user },
        { $inc: { pendingWithdrawalAmount: -withdrawal.amount } }
      );
    }

    withdrawal.status = "Rejected";
    withdrawal.completedBy = req.user._id;
    withdrawal.completedAt = new Date();
    withdrawal.rejectionReason = cleanReason;
    withdrawal.adminNote = adminNote.trim();

    withdrawal.history.push({
      action: "Từ chối yêu cầu",
      performedBy: req.user._id,
      timestamp: new Date(),
      note: cleanReason,
    });
    await withdrawal.save();

    // Ghi nhận bản ghi Transaction giải phóng tiền
    await Transaction.create({
      user: withdrawal.user,
      type: "WithdrawalReleased",
      amount: withdrawal.amount,
      status: "Completed",
      walletOwner: withdrawal.userRole === "admin" ? "Admin" : "User",
      relatedWithdrawal: withdrawal._id,
      description: `Hoàn trả ${withdrawal.amount.toLocaleString("vi-VN")} đ vào số dư khả dụng do yêu cầu rút tiền bị từ chối (${cleanReason})`,
    });

    await notifyUser(withdrawal.user, {
      title: "Yêu cầu rút tiền bị từ chối",
      message: `Yêu cầu rút ${withdrawal.amount.toLocaleString("vi-VN")} đ của bạn đã bị từ chối. Lý do: "${cleanReason}". Số tiền đã được hoàn lại vào số dư khả dụng.`,
      link: "/wallet",
      type: "withdrawal_rejected",
    });

    return res.json({
      success: true,
      message: "Đã từ chối yêu cầu rút tiền và hoàn lại số dư khả dụng.",
      withdrawal,
    });
  } catch (error) {
    console.error("Lỗi từ chối yêu cầu rút tiền:", error);
    return res.status(500).json({ message: "Không thể từ chối yêu cầu rút tiền." });
  }
};

// Legacy alias for old resolveWithdrawal route
exports.resolveWithdrawal = async (req, res) => {
  const { status, rejectionReason, bankTransactionCode } = req.body;
  if (status === "Completed") {
    req.body.bankTransactionCode = bankTransactionCode || `TX${Date.now()}`;
    return exports.completeWithdrawal(req, res);
  } else if (status === "Failed" || status === "Rejected") {
    req.body.rejectionReason = rejectionReason || "Từ chối bởi Admin";
    return exports.rejectWithdrawal(req, res);
  }
  return res.status(400).json({ message: "Trạng thái xử lý không hợp lệ." });
};

exports.getExchangeRates = async (req, res) => {
  const currencies = ["USD", "EUR", "JPY", "KRW"];
  try {
    if (exchangeRateCache && Date.now() - exchangeRateFetchedAt < 60 * 60 * 1000) {
      return res.json({ base: "VND", rates: exchangeRateCache, cached: true });
    }
    const response = await fetch("https://open.er-api.com/v6/latest/VND", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Exchange rate provider returned ${response.status}`);
    const data = await response.json();
    if (data.result !== "success" || !data.rates) {
      throw new Error("Exchange rate provider returned an invalid response.");
    }
    const rates = Object.fromEntries(
      currencies.map((currency) => [currency, Number(data.rates[currency])]),
    );
    if (Object.values(rates).some((rate) => !Number.isFinite(rate) || rate <= 0)) {
      throw new Error("Exchange rate response is missing a supported currency.");
    }
    exchangeRateCache = rates;
    exchangeRateFetchedAt = Date.now();
    return res.json({ base: "VND", rates, cached: false });
  } catch (error) {
    if (exchangeRateCache) {
      return res.json({ base: "VND", rates: exchangeRateCache, cached: true, stale: true });
    }
    console.error("Load exchange rates error:", error);
    return res.status(503).json({ message: "Không thể tải tỷ giá. Vui lòng thử lại sau." });
  }
};
