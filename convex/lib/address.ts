type AddressLike = {
  label?: string;
  city?: string;
  postalCode?: string;
};

export function formatAddressShort(address: AddressLike): string {
  const street = address.label?.split(",")[0]?.trim();
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ").trim();

  if (street && cityLine) return `${street}, ${cityLine}`;
  if (street) return street;
  if (cityLine) return cityLine;
  return address.label?.trim() ?? "";
}
