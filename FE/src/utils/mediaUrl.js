export function resolveMediaUrl(value, apiBaseUrl) {
  if (!value) return "";

  const mediaMatch = value.match(/^(?:https?:\/\/[^/]+)?(\/media\/[a-f\d]{24})([?#].*)?$/i);
  const relativeUpload = value.startsWith("/uploads/");
  if (!mediaMatch && !relativeUpload) return value;

  const backendUrl = apiBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "");
  if (!backendUrl) {
    throw new Error("VITE_API_URL is required to resolve uploaded media URLs.");
  }
  return `${backendUrl}${mediaMatch ? mediaMatch[1] + (mediaMatch[2] || "") : value}`;
}
