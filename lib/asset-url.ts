import { getApiBase } from "@/lib/api-base";

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

  return `${getApiBase()}${fileUrl}`;
}
