export function getUserProfileHref(
  userId: string,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "",
) {
  const normalizedBasePath = basePath.replace(/\/+$/, "");
  return `${normalizedBasePath}/users/${encodeURIComponent(userId)}/`;
}
