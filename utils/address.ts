type AddressLike = {
  label?: string;
  city?: string;
  postalCode?: string;
};

export function formatShortAddress(address: AddressLike | null | undefined, fallback: string) {
  if (!address) return fallback;

  const street = address.label?.split(",")[0]?.trim();
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ").trim();

  if (street && cityLine) return `${street}, ${cityLine}`;
  if (street) return street;
  if (cityLine) return cityLine;

  return fallback;
}
