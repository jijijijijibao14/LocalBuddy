const { PayOS } = require("@payos/node");

let payOSInstance = null;

/**
 * Khởi tạo hoặc lấy instance PayOS singleton
 */
function getPayOS() {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim();
  const apiKey = process.env.PAYOS_API_KEY?.trim();
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();

  if (!clientId || !apiKey || !checksumKey) {
    return null;
  }

  if (!payOSInstance) {
    payOSInstance = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
  }
  return payOSInstance;
}

/**
 * Kiểm tra xem đã có đầy đủ key cấu hình PayOS hay chưa
 */
function isPayOSConfigured() {
  return Boolean(getPayOS());
}

/**
 * Tạo URL ảnh VietQR chuẩn
 */
function generateVietQRUrl({
  bin = "970422",
  accountNumber = "0123456789",
  accountName = "LOCAL BUDDY",
  amount,
  description,
}) {
  const safeDesc = encodeURIComponent(description);
  const safeName = encodeURIComponent(accountName);
  return `https://api.vietqr.io/image/${bin}-${accountNumber}-compact2.jpg?amount=${amount}&addInfo=${safeDesc}&accountName=${safeName}`;
}

/**
 * Chuẩn hóa nội dung chuyển khoản theo yêu cầu PayOS:
 * Không dấu, tối đa 25 ký tự, chỉ gồm chữ cái, số và khoảng trắng
 */
function sanitizePayOSDescription(text) {
  if (!text) return "LOCALBUDDY";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, 25);
}

/**
 * Tạo orderCode dạng số nguyên dương cho PayOS
 */
function generateOrderCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return Number(`${timestamp}${random}`);
}

/**
 * Tạo link thanh toán PayOS (hoặc fallback mô phỏng nếu chưa có keys)
 */
async function createPaymentLink({
  orderCode,
  amount,
  description,
  returnUrl,
  cancelUrl,
  items = [],
}) {
  const payos = getPayOS();
  const cleanDesc = sanitizePayOSDescription(description || `LB ${orderCode}`);

  if (!payos) {
    console.warn(
      "[PayOS] Chưa cấu hình đầy đủ PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY. Sử dụng chế độ QR VietQR Sandbox.",
    );
    const bin = "970422"; // MBBank
    const accountNumber = "0123456789";
    const accountName = "LOCAL BUDDY";
    const qrCodeUrl = generateVietQRUrl({
      bin,
      accountNumber,
      accountName,
      amount,
      description: cleanDesc,
    });

    return {
      isMock: true,
      orderCode,
      amount,
      description: cleanDesc,
      bin,
      accountNumber,
      accountName,
      qrCodeUrl,
      checkoutUrl: returnUrl ? `${returnUrl}?orderCode=${orderCode}&status=PAID` : "",
      status: "PENDING",
    };
  }

  const paymentData = {
    orderCode,
    amount,
    description: cleanDesc,
    returnUrl,
    cancelUrl,
    items,
  };

  const response = await payos.paymentRequests.create(paymentData);

  const bin = response.bin || "970422";
  const accountNumber = response.accountNumber;
  const accountName = response.accountName || "LOCAL BUDDY";
  const qrCodeUrl = response.qrCode?.startsWith("http")
    ? response.qrCode
    : generateVietQRUrl({
        bin,
        accountNumber,
        accountName,
        amount,
        description: cleanDesc,
      });

  return {
    isMock: false,
    ...response,
    bin,
    accountNumber,
    accountName,
    qrCodeUrl,
  };
}

/**
 * Kiểm tra trạng thái đơn hàng từ PayOS
 */
async function getPaymentLinkInformation(orderCode) {
  const payos = getPayOS();
  if (!payos) {
    return null;
  }
  return await payos.paymentRequests.get(orderCode);
}

/**
 * Hủy link thanh toán
 */
async function cancelPaymentLink(orderCode, cancellationReason = "Khách hàng hủy") {
  const payos = getPayOS();
  if (!payos) {
    return null;
  }
  return await payos.paymentRequests.cancel(orderCode, cancellationReason);
}

/**
 * Xác thực dữ liệu webhook từ PayOS
 */
async function verifyWebhookData(webhookBody) {
  const payos = getPayOS();
  if (!payos) {
    throw new Error("PayOS chưa được cấu hình.");
  }
  return await payos.webhooks.verify(webhookBody);
}

module.exports = {
  getPayOS,
  isPayOSConfigured,
  generateVietQRUrl,
  sanitizePayOSDescription,
  generateOrderCode,
  createPaymentLink,
  getPaymentLinkInformation,
  cancelPaymentLink,
  verifyWebhookData,
};

