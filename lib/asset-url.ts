const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ((process.env.NODE_ENV ?? "").toLowerCase() === "production" ? "https://localhost:4000" : "http://127.0.0.1:4000");

export function resolveAssetUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) {
    return null;
  }

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  if (fileUrl.startsWith("/api/assets/")) {
    return fileUrl;
  }

  return `${API_BASE}${fileUrl}`;
}
