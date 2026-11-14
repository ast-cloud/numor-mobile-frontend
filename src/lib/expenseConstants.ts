// Constants and helpers copied unchanged from the web frontend's Expenses page.
export type SortField = "date" | "totalPrice" | "category";
export type SortOrder = "asc" | "desc";
export type TimeRangePreset = "all" | "today" | "this_week" | "this_month" | "this_quarter" | "custom";

export type Expense = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxType: string;
  taxPercentage: number;
  category: string;
  date: string;
};

export type ExpenseItem = {
  title: string;
  merchant: string;
  quantity: string;
  unitType: string;
  unitPrice: string;
  taxType: string;
  taxPercentage: string;
  category: string;
  paymentMethod: string;
  date: string;
};

// Bill upload form types
export type BillCommon = {
  merchant: string;
  billDate: string;
  totalAmount: string;
  category: string;
  paymentMethod: string;
};

export type BillItem = {
  name: string;
  quantity: string;
  unitType: string;
  unitPrice: string;
  taxRate: string;
  itemPrice: string;
};

export type DialogMode = "default" | "bill";

export const paymentMethods = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Cheque", "Other"];
export const billPaymentMethods = ["Card", "UPI", "Cash", "Bank Transfer"];

export const createEmptyBillItem = (): BillItem => ({
  name: "",
  quantity: "1",
  unitType: "Units",
  unitPrice: "",
  taxRate: "",
  itemPrice: "",
});

export const categories = [
  "Food & Dining",
  "Transportation",
  "Utilities",
  "Office Supplies",
  "Travel",
  "Entertainment",
  "Other",
];

// Country-to-currency mapping
export const countryCurrency: Record<string, string> = {
  "India": "INR", "UAE": "AED", "US": "USD", "UK": "GBP", "United States": "USD", "United Kingdom": "GBP", "United Arab Emirates": "AED",
  "Austria": "EUR", "Belgium": "EUR", "Bulgaria": "EUR", "Croatia": "EUR",
  "Cyprus": "EUR", "Czech Republic": "EUR", "Denmark": "EUR", "Estonia": "EUR",
  "Finland": "EUR", "France": "EUR", "Germany": "EUR", "Greece": "EUR",
  "Hungary": "EUR", "Ireland": "EUR", "Italy": "EUR", "Latvia": "EUR",
  "Lithuania": "EUR", "Luxembourg": "EUR", "Malta": "EUR", "Netherlands": "EUR",
  "Poland": "EUR", "Portugal": "EUR", "Romania": "EUR", "Slovakia": "EUR",
  "Slovenia": "EUR", "Spain": "EUR", "Sweden": "EUR",
};

// Country-to-tax defaults mapping (shared with invoice logic)
export const countryTaxDefaults: Record<string, { taxType: string; taxPercent: string }> = {
  "India": { taxType: "GST", taxPercent: "18" },
  "UAE": { taxType: "VAT", taxPercent: "5" },
  "US": { taxType: "Sales Tax", taxPercent: "" },
  "United States": { taxType: "Sales Tax", taxPercent: "" },
  "UK": { taxType: "VAT", taxPercent: "20" },
  "United Kingdom": { taxType: "VAT", taxPercent: "20" },
  "United Arab Emirates": { taxType: "VAT", taxPercent: "5" },
  "Austria": { taxType: "VAT", taxPercent: "20" },
  "Belgium": { taxType: "VAT", taxPercent: "21" },
  "Bulgaria": { taxType: "VAT", taxPercent: "20" },
  "Croatia": { taxType: "VAT", taxPercent: "25" },
  "Cyprus": { taxType: "VAT", taxPercent: "19" },
  "Czech Republic": { taxType: "VAT", taxPercent: "21" },
  "Denmark": { taxType: "VAT", taxPercent: "25" },
  "Estonia": { taxType: "VAT", taxPercent: "22" },
  "Finland": { taxType: "VAT", taxPercent: "24" },
  "France": { taxType: "VAT", taxPercent: "20" },
  "Germany": { taxType: "VAT", taxPercent: "19" },
  "Greece": { taxType: "VAT", taxPercent: "24" },
  "Hungary": { taxType: "VAT", taxPercent: "27" },
  "Ireland": { taxType: "VAT", taxPercent: "23" },
  "Italy": { taxType: "VAT", taxPercent: "22" },
  "Latvia": { taxType: "VAT", taxPercent: "21" },
  "Lithuania": { taxType: "VAT", taxPercent: "21" },
  "Luxembourg": { taxType: "VAT", taxPercent: "17" },
  "Malta": { taxType: "VAT", taxPercent: "18" },
  "Netherlands": { taxType: "VAT", taxPercent: "21" },
  "Poland": { taxType: "VAT", taxPercent: "23" },
  "Portugal": { taxType: "VAT", taxPercent: "23" },
  "Romania": { taxType: "VAT", taxPercent: "19" },
  "Slovakia": { taxType: "VAT", taxPercent: "20" },
  "Slovenia": { taxType: "VAT", taxPercent: "22" },
  "Spain": { taxType: "VAT", taxPercent: "21" },
  "Sweden": { taxType: "VAT", taxPercent: "25" },
};

// Country-specific tax percentage options
export const expenseTaxPercentOptions: Record<string, number[]> = {
  "India": [0, 5, 12, 18, 28],
  "UAE": [0, 5],
  "UK": [0, 5, 20],
  "US": [0],
  "Austria": [0, 10, 13, 20],
  "Belgium": [0, 6, 12, 21],
  "Bulgaria": [0, 9, 20],
  "Croatia": [0, 5, 13, 25],
  "Cyprus": [0, 5, 9, 19],
  "Czech Republic": [0, 10, 15, 21],
  "Denmark": [0, 25],
  "Estonia": [0, 9, 22],
  "Finland": [0, 10, 14, 24],
  "France": [0, 5.5, 10, 20],
  "Germany": [0, 7, 19],
  "Greece": [0, 6, 13, 24],
  "Hungary": [0, 5, 18, 27],
  "Ireland": [0, 9, 13.5, 23],
  "Italy": [0, 4, 10, 22],
  "Latvia": [0, 5, 12, 21],
  "Lithuania": [0, 5, 9, 21],
  "Luxembourg": [0, 3, 8, 17],
  "Malta": [0, 5, 7, 18],
  "Netherlands": [0, 9, 21],
  "Poland": [0, 5, 8, 23],
  "Portugal": [0, 6, 13, 23],
  "Romania": [0, 5, 9, 19],
  "Slovakia": [0, 10, 20],
  "Slovenia": [0, 5, 9.5, 22],
  "Spain": [0, 4, 10, 21],
  "Sweden": [0, 6, 12, 25],
};

export const getTaxPercentOptions = (country?: string): number[] => {
  if (!country) return [0, 5, 12, 18, 20, 25, 28];
  return expenseTaxPercentOptions[country] || [0, 5, 12, 18, 20, 25, 28];
};

export const unitTypes = ["Kg", "g", "Ltr", "ml", "m", "ft", "Box", "Pack", "Units", "Hrs", "Sq ft"];

// Map OCR/backend unit type values to valid dropdown values
export const normalizeUnitType = (raw?: string): string => {
  if (!raw) return "Units";
  const lower = raw.toLowerCase();
  const mapping: Record<string, string> = {
    each: "Units", unit: "Units", units: "Units", pcs: "Units", piece: "Units", pieces: "Units", nos: "Units", no: "Units",
    kg: "Kg", kgs: "Kg", kilogram: "Kg", kilograms: "Kg",
    g: "g", gm: "g", gms: "g", gram: "g", grams: "g",
    ltr: "Ltr", l: "Ltr", litre: "Ltr", liter: "Ltr", litres: "Ltr", liters: "Ltr",
    ml: "ml", millilitre: "ml", milliliter: "ml",
    m: "m", meter: "m", meters: "m", metre: "m", metres: "m",
    ft: "ft", feet: "ft", foot: "ft",
    box: "Box", boxes: "Box",
    pack: "Pack", packs: "Pack", packet: "Pack", packets: "Pack",
    hrs: "Hrs", hr: "Hrs", hour: "Hrs", hours: "Hrs",
    "sq ft": "Sq ft", sqft: "Sq ft",
  };
  return mapping[lower] || (unitTypes.find(u => u.toLowerCase() === lower) ? unitTypes.find(u => u.toLowerCase() === lower)! : "Units");
};

export const quickPaymentMethods = ["Card", "UPI", "Cash", "Bank Transfer"];

export const createEmptyItem = (orgCountry?: string): ExpenseItem => {
  const defaults = orgCountry ? countryTaxDefaults[orgCountry] : undefined;
  return {
    title: "",
    merchant: "",
    quantity: "",
    unitType: "Units",
    unitPrice: "",
    taxType: defaults?.taxType || "",
    taxPercentage: defaults?.taxPercent || "",
    category: "",
    paymentMethod: "",
    date: new Date().toISOString().split("T")[0],
  };
};

