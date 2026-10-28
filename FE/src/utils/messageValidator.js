/**
 * Utility: validate tin nhắn trên client trước khi gửi.
 * Logic phải khớp với chatUtils.js phía backend.
 */

const PHONE_RE = /(?:(?:\+84|84|0)[3-9]\d{8})|(?:0[1-9]\d{8,9})/g;
const ZALO_RE =
  /(?:zalo\s*[:\-]?\s*\S+|zl\s*[:\-]\s*\S+|zalo\.me\/\S+|id\s+zalo\s*[:\-]?\s*\S+)/gi;
const DEP_LAO_RE = /d[eêé3]p\s*l[aà4][oô0]/gi;
const URL_RE = /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;
const MAPS_WHITELIST_RE =
  /^https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)/i;

/**
 * @param {string} content
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateMessage(content) {
  if (!content || !content.trim()) {
    return { valid: false, reason: "Tin nhắn không được để trống." };
  }
  if (content.trim().length > 2000) {
    return {
      valid: false,
      reason: "Tin nhắn không được vượt quá 2000 ký tự.",
    };
  }

  if (PHONE_RE.test(content)) {
    PHONE_RE.lastIndex = 0;
    return {
      valid: false,
      reason:
        "Không được chia sẻ số điện thoại. Vui lòng liên lạc qua nền tảng.",
    };
  }
  PHONE_RE.lastIndex = 0;

  if (ZALO_RE.test(content)) {
    ZALO_RE.lastIndex = 0;
    return {
      valid: false,
      reason: "Không được chia sẻ thông tin Zalo trong chat.",
    };
  }
  ZALO_RE.lastIndex = 0;

  if (DEP_LAO_RE.test(content)) {
    DEP_LAO_RE.lastIndex = 0;
    return {
      valid: false,
      reason: "Tin nhắn chứa từ ngữ không phù hợp.",
    };
  }
  DEP_LAO_RE.lastIndex = 0;

  const urls = content.match(URL_RE) || [];
  for (const url of urls) {
    if (!MAPS_WHITELIST_RE.test(url)) {
      return {
        valid: false,
        reason:
          "Chỉ được chia sẻ liên kết Google Maps. Các link khác không được phép.",
      };
    }
  }

  return { valid: true };
}

