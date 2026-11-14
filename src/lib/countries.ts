// Country lists used by the web forms.
export const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
  "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];

/** Client forms store the full country names. */
export const COUNTRIES = ["India", "UAE", "United States", "United Kingdom", ...EU_COUNTRIES];

/** Seller / organisation forms store short codes for US and UK. */
export const SELLER_COUNTRY_OPTIONS = [
  { value: "India", label: "India" },
  { value: "UAE", label: "UAE" },
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  ...EU_COUNTRIES.map((c) => ({ value: c, label: c })),
];
