const crypto = require("crypto");
const qs = require("qs");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { getWalletSettings } = require("../utils/walletLedger");
const { transactionHistoryFilter } = require("../utils/walletHistory");

let exchangeRateCache = null;
let exchangeRateFetchedAt = 0;

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

// 1. Tạo URL thanh toán VNPay
exports.createPaymentUrl = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Ví Admin không hỗ trợ nạp tiền." });
    }
    const { amount, bankCode = "VNPAYQR" } = req.body;
    const numAmount = Number(amount);

    if (!Number.isInteger(numAmount) || numAmount < 10000 || numAmount > 50000000) {
      return res.status(400).json({
        message: "Số tiền nạp tối thiểu là 10.000 VNĐ và tối đa là 50.000.000 VNĐ.",
      });
    }

    const tmnCode = process.env.VNP_TMN_CODE || "CGXZLS0Z";
    const secretKey = process.env.VNP_HASH_SECRET || "XNBCJFAKAZQSGCSFRLZJTCZWTXNKGKYZ";
    const vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl = process.env.VNP_RETURN_URL || "http://localhost:5173/payment/vnpay-return";

    const orderId = `LB${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
    const createDate = getVnPayDateString();

    const transaction = await Transaction.create({
      user: req.user._id,
      type: "TopUp",
      amount: numAmount,
      status: "Pending",
      orderId,
      paymentMethod: bankCode === "VNPAYQR" ? "VNPAY_QR" : "VNPAY",
      description: `Nạp tiền ví Local Buddy (${numAmount.toLocaleString("vi-VN")} đ)`,
    });

    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    if (ipAddr && ipAddr.includes(",")) {
      ipAddr = ipAddr.split(",")[0].trim();
    }
    if (ipAddr === "::1") ipAddr = "127.0.0.1";

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Nap tien vi Local Buddy ${numAmount} VND`,
      vnp_OrderType: "topup",
      vnp_Amount: numAmount * 100, // VNPay quy định nhân 100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    if (bankCode && bankCode.trim()) {
      vnp_Params.vnp_BankCode = bankCode.trim();
    }

    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params.vnp_SecureHash = signed;

    const paymentUrl = `${vnpUrl}?${qs.stringify(vnp_Params, { encode: false })}`;

    // Tạo mã QR VietQR / VNPAY-QR trực tiếp
    const qrCodeUrl = `https://api.vietqr.io/image/970419-0123456789-compact2.jpg?amount=${numAmount}&addInfo=LOCALBUDDY%20${orderId}&accountName=LOCAL%20BUDDY`;

    return res.json({
      paymentUrl,
      qrCodeUrl,
      orderId,
      amount: numAmount,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error("Lỗi tạo URL thanh toán VNPay:", error);
    return res.status(500).json({ message: "Không thể tạo liên kết thanh toán VNPay." });
  }
};

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
    const { amount = 100000, orderId } = req.body;
    const numAmount = Math.max(10000, Number(amount) || 100000);

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
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "Thiếu mã đơn hàng giao dịch." });
    }

    const transaction = await Transaction.findOne({ orderId, user: req.user._id });
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

    transaction.status = "Completed";
    transaction.vnpTransactionNo = `QR${Date.now()}`;
    transaction.vnpBankCode = "VNPAYQR";
    transaction.vnpPayDate = getVnPayDateString();
    transaction.vnpResponseCode = "00";
    await transaction.save();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: transaction.amount } },
      { new: true }
    );

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

exports.getOverview = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const settings = await getWalletSettings();
      return res.json({
        role: "admin",
        systemBalance: settings.systemBalance,
        adminBalance: settings.adminBalance,
        commissions: {
          standard: settings.standardCommissionPercent,
          premium: settings.premiumCommissionPercent,
        },
        isPremium: false,
      });
    }
    const user = await User.findById(req.user._id).select("walletBalance isPremium");
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    res.json({
      role: req.user.role,
      balance: user.walletBalance,
      isPremium: Boolean(user.isPremium),
    });
  } catch (error) {
    console.error("Load wallet overview error:", error);
    res.status(500).json({ message: "Không thể tải thông tin ví." });
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

exports.requestWithdrawal = async (req, res) => {
  const amount = Number(req.body.amount);
  const { bankName, accountNumber } = req.body;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ message: "Số tiền rút phải là số nguyên lớn hơn 0." });
  }
  if (
    typeof bankName !== "string" ||
    typeof accountNumber !== "string" ||
    !bankName.trim() ||
    bankName.trim().length > 100 ||
    !/^\d{6,40}$/.test(accountNumber.trim())
  ) {
    return res.status(400).json({ message: "Vui lòng nhập thông tin tài khoản nhận tiền hợp lệ." });
  }

  let debitedWallet = null;
  try {
    let updatedBalance;
    let walletOwner = "User";
    if (req.user.role === "admin") {
      walletOwner = "Admin";
      const settings = await getWalletSettings();
      const updated = await require("../models/WalletSettings").findOneAndUpdate(
        { _id: settings._id, adminBalance: { $gte: amount } },
        { $inc: { adminBalance: -amount } },
        { new: true },
      );
      if (!updated) {
        return res.status(400).json({ message: "Số dư ví Admin không đủ." });
      }
      updatedBalance = updated.adminBalance;
      debitedWallet = { type: "admin", id: settings._id };
    } else {
      const user = await User.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true },
      );
      if (!user) {
        return res.status(400).json({ message: "Số dư ví không đủ để rút." });
      }
      updatedBalance = user.walletBalance;
      debitedWallet = { type: "user", id: user._id };
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      type: "Withdrawal",
      amount,
      status: "Completed",
      walletOwner,
      paymentMethod: "Bank Transfer",
      description: "Rút tiền demo thành công (không chuyển khoản thực)",
      withdrawalDetails: {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
      },
    });
    res.status(201).json({ transaction, balance: updatedBalance });
  } catch (error) {
    console.error("Request withdrawal error:", error);
    if (debitedWallet) {
      try {
        const result = debitedWallet.type === "admin"
          ? await require("../models/WalletSettings").updateOne(
              { _id: debitedWallet.id }, { $inc: { adminBalance: amount } },
            )
          : await User.updateOne(
              { _id: debitedWallet.id }, { $inc: { walletBalance: amount } },
            );
        if (!result.matchedCount) throw new Error("Không tìm thấy ví cần hoàn lại.");
      } catch (rollbackError) {
        console.error("Withdrawal rollback error:", rollbackError);
        return res.status(500).json({
          message: "Không tạo được yêu cầu và chưa hoàn lại số dư. Vui lòng liên hệ Admin để kiểm tra.",
        });
      }
    }
    res.status(500).json({ message: "Không thể tạo yêu cầu rút tiền." });
  }
};

exports.resolveWithdrawal = async (req, res) => {
  const { status } = req.body;
  if (!["Completed", "Failed"].includes(status)) {
    return res.status(400).json({ message: "Trạng thái xử lý không hợp lệ." });
  }
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, type: "Withdrawal", status: "Pending" },
      { $set: { status } },
      { new: true },
    );
    if (!transaction) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền đang chờ." });
    }
    if (status === "Failed") {
      try {
        let result;
        if (transaction.walletOwner === "Admin") {
          const settings = await getWalletSettings();
          result = await settings.updateOne({ $inc: { adminBalance: transaction.amount } });
        } else {
          result = await User.updateOne(
            { _id: transaction.user },
            { $inc: { walletBalance: transaction.amount } },
          );
        }
        if (!result.matchedCount) throw new Error("Không tìm thấy ví cần hoàn tiền.");
      } catch (error) {
        await Transaction.updateOne(
          { _id: transaction._id, status: "Failed" },
          { $set: { status: "Pending" } },
        );
        throw error;
      }
    }
    res.json({ transaction });
  } catch (error) {
    console.error("Resolve withdrawal error:", error);
    res.status(500).json({ message: "Không thể cập nhật yêu cầu rút tiền." });
  }
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
