export function isJordanAdminName(name?: string | null) {
  return (name ?? "").trim().toLowerCase() === "jordan";
}
