/**
 * Tạo roomId duy nhất từ cặp userId – đảm bảo thứ tự bảng chữ cái để luôn
 * ra cùng một roomId dù ai gọi trước.
 */
function buildRoomId(userIdA, userIdB) {
  const ids = [String(userIdA), String(userIdB)].sort();
  return `room_${ids[0]}_${ids[1]}`;
}

/**
 * Kiểm tra nội dung tin nhắn có chứa thông tin nhạy cảm không:
 * - Số điện thoại Việt Nam (0xxx / +84xxx)
 * - ID / username Zalo (định dạng phổ biến)
 * - "Dép lào" – ký hiệu cho hành vi rời nền tảng trái phép (chuỗi đặc biệt)
 * - URL/link bên ngoài – CHO PHÉP google.com/maps, maps.google.com, goo.gl/maps,
 *   maps.app.goo.gl
 *
 * Trả về { valid: true } nếu hợp lệ, hoặc { valid: false, reason: "..." } nếu vi phạm.
 */
function validateMessageContent(content) {
  if (!content || typeof content !== "string") {
    return { valid: false, reason: "Tin nhắn không được để trống." };
  }

  const text = content.trim();

  if (text.length === 0) {
    return { valid: false, reason: "Tin nhắn không được để trống." };
  }

  if (text.length > 2000) {
    return { valid: false, reason: "Tin nhắn không được vượt quá 2000 ký tự." };
  }

  // --- 1. Số điện thoại Việt Nam ---
  // Dạng: 0[3-9]xxxxxxxx, +84[3-9]xxxxxxx, 84[3-9]xxxxxxx
  const phoneRegex =
    /(?:(?:\+84|84|0)[3-9]\d{8})|(?:0[1-9]\d{8,9})/g;
  if (phoneRegex.test(text)) {
    return {
      valid: false,
      reason:
        "Tin nhắn không được chứa số điện thoại. Vui lòng sử dụng nền tảng để liên lạc an toàn.",
    };
  }

  // --- 2. Zalo / mạng xã hội khác ---
  // Bắt các pattern phổ biến: "zalo:", "zalo id", "zl:", tên Zalo, link zalo.me
  const zaloRegex =
    /(?:zalo\s*[:\-]?\s*\S+|zl\s*[:\-]\s*\S+|zalo\.me\/\S+|id\s+zalo\s*[:\-]?\s*\S+)/gi;
  if (zaloRegex.test(text)) {
    return {
      valid: false,
      reason:
        "Tin nhắn không được chứa thông tin Zalo. Vui lòng liên lạc qua ứng dụng.",
    };
  }

  // --- 3. Dép lào (ký tự "dép lào" – vượt qua kiểm duyệt bằng ký tự đặc biệt) ---
  // Bắt các biến thể: "dép lào", "dep lao", "dep la0", "dep l4o", v.v.
  const depLaoRegex =
    /d[eêé3]p\s*l[aà4][oô0]/gi;
  if (depLaoRegex.test(text)) {
    return {
      valid: false,
      reason:
        "Tin nhắn chứa từ ngữ không phù hợp (dép lào). Vui lòng dùng ngôn ngữ lịch sự.",
    };
  }

  // --- 4. Link bên ngoài – chỉ cho phép Google Maps ---
  // Regex bắt URL: http(s)://, www., hoặc domain.tld
  const urlRegex =
    /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;

  // Whitelist Google Maps
  const googleMapsWhitelist =
    /^https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)/i;

  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (!googleMapsWhitelist.test(url)) {
      return {
        valid: false,
        reason:
          "Tin nhắn không được chứa liên kết bên ngoài. Chỉ cho phép chia sẻ liên kết Google Maps.",
      };
    }
  }

  return { valid: true };
}

module.exports = { buildRoomId, validateMessageContent };

