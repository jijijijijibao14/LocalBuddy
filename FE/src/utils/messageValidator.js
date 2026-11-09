import i18n from "../i18n";

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
    return { valid: false, reason: i18n.t("chat:validation.empty") };
  }
  if (content.trim().length > 2000) {
    return {
      valid: false,
      reason: i18n.t("chat:validation.tooLong", { max: 2000 }),
    };
  }

  if (PHONE_RE.test(content)) {
    PHONE_RE.lastIndex = 0;
    return {
      valid: false,
      reason:
        i18n.t("chat:validation.phone"),
    };
  }
  PHONE_RE.lastIndex = 0;

  if (ZALO_RE.test(content)) {
    ZALO_RE.lastIndex = 0;
    return {
      valid: false,
      reason: i18n.t("chat:validation.zalo"),
    };
  }
  ZALO_RE.lastIndex = 0;

  if (DEP_LAO_RE.test(content)) {
    DEP_LAO_RE.lastIndex = 0;
    return {
      valid: false,
      reason: i18n.t("chat:validation.inappropriate"),
    };
  }
  DEP_LAO_RE.lastIndex = 0;

  const urls = content.match(URL_RE) || [];
  for (const url of urls) {
    if (!MAPS_WHITELIST_RE.test(url)) {
      return {
        valid: false,
        reason:
          i18n.t("chat:validation.link"),
      };
    }
  }

  return { valid: true };
}

