// Invoice form state and business rules, moved over unchanged from the web frontend's
// CreateInvoiceDialog so the app builds, validates and submits invoices identically.
// Only the browser-specific calls (crypto.randomUUID, DOM scrolling, zod) were swapped.
import { useEffect, useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { fetchCurrentOrganization, fetchOrganizationLogo } from "@/lib/api/user";
import { fetchClients, type ClientData } from "@/lib/api/clients";
import { fetchInvoiceUnits } from "@/lib/api/invoiceUnits";
import { fetchPaymentAccounts, type PaymentAccount } from "@/lib/api/paymentAccounts";
import { getTaxLabel, getTaxSystem } from "@/lib/taxSystem";
import { useAuth } from "@/hooks/use-auth";
import { createInvoice, updateInvoice, finalizeInvoice, fetchInvoice, type InvoiceData } from "@/lib/api/invoices";
import { toast } from "@/hooks/use-toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

import type { InvoiceCustomField } from "@/lib/api/invoiceCustomFields";

export interface InvoiceCustomFieldValue {
  /**
   * Row identity while editing. For a field that comes from settings this is the
   * definition id; for one defined on the invoice it is generated, because its
   * name is being typed and so cannot key anything.
   */
  uid: string;
  /** Null for a field defined on this invoice rather than in settings. */
  definitionId: string | null;
  name: string;
  value: string;
}

/** Last four digits only - a card in the picker should not print a full account. */
export const maskAccountNumber = (value?: string | null) => {
  const trimmed = (value ?? "").replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.length <= 4 ? trimmed : `•••• ${trimmed.slice(-4)}`;
};

// Fallback used until the organization's active units load (or if that fetch fails).
const DEFAULT_UNIT_OPTIONS = [
  "Units", "Hours", "Days", "Weeks", "Months", "Kg", "Grams", "Liters",
  "Meters", "Sq. Meters", "Feet", "Sq. Feet", "Boxes", "Cartons",
];

export interface CreateInvoiceDialogProps {
  onInvoiceCreated?: () => void;
  /** Edits this draft in place. The invoice keeps its id and its number. */
  editInvoiceId?: string | null;
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  /**
   * Loads this invoice into the form but saves a NEW one, for re-issuing an
   * invoice that has already gone out. The original is left untouched - it is
   * the record of what the client actually received.
   */
  prefillFromInvoiceId?: string | null;
  prefillOpen?: boolean;
  onPrefillOpenChange?: (open: boolean) => void;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
}

export interface SellerInfo {
  logo: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxId: string;
  email: string;
  phone: string;
}

export interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: Date | undefined;
  dueDate: Date | undefined;
  currency: string;
  taxType: string;
  seller: SellerInfo;
  clientName: string;
  clientEmail: string;
  clientStreetAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientCountry: string;
  clientTaxId: string;
  lineItems: LineItem[];
  bankName: string;
  accountName: string;
  iban: string;
  swiftBic: string;
  ifscCode: string;
  bankAddress: string;
  notes: string;
  customFields: InvoiceCustomFieldValue[];
}

// Country-to-currency/tax defaults mapping
export const countryDefaults: Record<string, { currency: string; taxType: string }> = {
  India: { currency: "INR", taxType: "GST" },
  UAE: { currency: "AED", taxType: "VAT" },
  US: { currency: "USD", taxType: "Sales Tax" },
  UK: { currency: "GBP", taxType: "VAT" },
  // EU Countries (27)
  Austria: { currency: "EUR", taxType: "VAT" },
  Belgium: { currency: "EUR", taxType: "VAT" },
  Bulgaria: { currency: "EUR", taxType: "VAT" },
  Croatia: { currency: "EUR", taxType: "VAT" },
  Cyprus: { currency: "EUR", taxType: "VAT" },
  "Czech Republic": { currency: "EUR", taxType: "VAT" },
  Denmark: { currency: "EUR", taxType: "VAT" },
  Estonia: { currency: "EUR", taxType: "VAT" },
  Finland: { currency: "EUR", taxType: "VAT" },
  France: { currency: "EUR", taxType: "VAT" },
  Germany: { currency: "EUR", taxType: "VAT" },
  Greece: { currency: "EUR", taxType: "VAT" },
  Hungary: { currency: "EUR", taxType: "VAT" },
  Ireland: { currency: "EUR", taxType: "VAT" },
  Italy: { currency: "EUR", taxType: "VAT" },
  Latvia: { currency: "EUR", taxType: "VAT" },
  Lithuania: { currency: "EUR", taxType: "VAT" },
  Luxembourg: { currency: "EUR", taxType: "VAT" },
  Malta: { currency: "EUR", taxType: "VAT" },
  Netherlands: { currency: "EUR", taxType: "VAT" },
  Poland: { currency: "EUR", taxType: "VAT" },
  Portugal: { currency: "EUR", taxType: "VAT" },
  Romania: { currency: "EUR", taxType: "VAT" },
  Slovakia: { currency: "EUR", taxType: "VAT" },
  Slovenia: { currency: "EUR", taxType: "VAT" },
  Spain: { currency: "EUR", taxType: "VAT" },
  Sweden: { currency: "EUR", taxType: "VAT" },
};

// Tax percentage options by country
const taxPercentOptions: Record<string, number[]> = {
  UAE: [0, 5],
  India: [0, 5, 18, 28],
  UK: [0, 5, 20],
};

// EU countries that should have free input for tax %
export const euCountries = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

export const hasTaxDropdown = (country: string): boolean => {
  return country in taxPercentOptions;
};

export const getTaxOptions = (country: string): number[] => {
  return taxPercentOptions[country] || [];
};

// Line-item columns: Description, Qty, Unit, Rate, Tax %, Total, delete. Shared
// by the header and every row so the two stay aligned. Explicit fractions rather
// than a 12-column grid, which can only move widths a whole column at a time.

// Empty default seller - will be filled from org API
const emptySellerInfo: SellerInfo = {
  logo: "",
  name: "",
  streetAddress: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  taxId: "",
  email: "",
  phone: "",
};

const getInitialFormData = (seller?: SellerInfo): InvoiceFormData => {
  const s = seller || emptySellerInfo;
  const defaults =
    s.country && countryDefaults[s.country] ? countryDefaults[s.country] : { currency: "USD", taxType: "None" };
  return {
    invoiceNumber: "",
    invoiceDate: new Date(),
    dueDate: undefined,
    currency: defaults.currency,
    taxType: defaults.taxType,
    seller: { ...s },
    clientName: "",
    clientEmail: "",
    clientStreetAddress: "",
    clientCity: "",
    clientState: "",
    clientZip: "",
    clientCountry: "",
    clientTaxId: "",
    // No rows to begin with: the table offers a single button to add the first.
    lineItems: [],
    bankName: "",
    accountName: "",
    iban: "",
    swiftBic: "",
    ifscCode: "",
    bankAddress: "",
    notes: "",
    customFields: [],
  };
};

const mapInvoiceDataToForm = (
  inv: InvoiceData,
  orgSeller?: SellerInfo,
  clients?: ClientData[],
  customFieldDefs?: InvoiceCustomField[],
): InvoiceFormData => {
  // Build seller from nested object OR flat fields
  const seller: SellerInfo = inv.seller
    ? {
        logo: "",
        name: inv.seller.name || "",
        streetAddress: inv.seller.streetAddress || "",
        city: inv.seller.city || "",
        state: inv.seller.state || "",
        zip: inv.seller.zipCode || "",
        country: inv.seller.country || "",
        taxId: inv.seller.taxId || "",
        email: inv.seller.email || "",
        phone: inv.seller.phone || "",
      }
    : {
        logo: "",
        name: inv.sellerName || orgSeller?.name || "",
        streetAddress: inv.sellerStreetAddress || orgSeller?.streetAddress || "",
        city: inv.sellerCity || orgSeller?.city || "",
        state: inv.sellerState || orgSeller?.state || "",
        zip: inv.sellerZipCode || orgSeller?.zip || "",
        country: inv.sellerCountry || orgSeller?.country || "",
        taxId: inv.sellerTaxId || orgSeller?.taxId || "",
        email: inv.sellerEmail || orgSeller?.email || "",
        phone: inv.sellerPhone || orgSeller?.phone || "",
      };

  // Resolve client from nested object, or look up from clients list
  let clientName = inv.client?.name || "";
  let clientEmail = inv.client?.email || "";
  let clientStreetAddress = inv.client?.streetAddress || "";
  let clientCity = inv.client?.city || "";
  let clientState = inv.client?.state || "";
  let clientZip = inv.client?.zipCode || "";
  let clientCountry = inv.client?.country || "";
  let clientTaxId = "";

  if (!clientName && clients && inv.clientId) {
    const matched = clients.find((c) => c.id === inv.clientId);
    if (matched) {
      clientName = matched.name || "";
      clientEmail = matched.email || "";
      clientStreetAddress = matched.streetAddress || "";
      clientCity = matched.city || "";
      clientState = matched.state || "";
      clientZip = matched.zipCode || "";
      clientCountry = matched.country || "";
      clientTaxId = matched.taxId || "";
    }
  }

  return {
    invoiceNumber: inv.invoiceNumber || "",
    invoiceDate: inv.issueDate ? new Date(inv.issueDate) : new Date(),
    dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
    currency: inv.currency || "USD",
    taxType: inv.taxType || (seller.country && countryDefaults[seller.country]?.taxType) || "None",
    seller,
    clientName,
    clientEmail,
    clientStreetAddress,
    clientCity,
    clientState,
    clientZip,
    clientCountry,
    clientTaxId,
    lineItems: inv.items?.length
      ? inv.items.map((item, i) => ({
          id: String(i + 1),
          description: item.itemName || item.description || "",
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unitType || "Units",
          rate: parseFloat(item.unitPrice) || 0,
          taxPercent: parseFloat(item.taxRate) || 0,
        }))
      : [],
    bankName: inv.bankDetails?.bankName || "",
    accountName: inv.bankDetails?.accountName || "",
    iban: inv.bankDetails?.accountNumber || "",
    swiftBic: inv.bankDetails?.swift || "",
    ifscCode: inv.bankDetails?.ifsc || "",
    bankAddress: inv.bankAddress || "",
    notes: inv.notes || "",
    // The invoice carries the field's name and value, but the checkboxes below
    // are keyed by definition id. Fall back to matching on name when the API
    // does not send an id - without a real id the field renders unticked, the
    // user ticks it again, and the invoice ends up holding it twice.
    customFields: (inv.customFields ?? []).map((f) => {
      // No id and no definition of that name means the field was defined on the
      // invoice itself, or its definition has since been deleted. Either way it
      // edits as a free-form row from here on.
      const definitionId =
        f.definitionId != null
          ? String(f.definitionId)
          : (customFieldDefs?.find((d) => d.name === f.name)?.id ?? null);

      return {
        uid: definitionId ?? randomUUID(),
        definitionId,
        name: f.name,
        value: f.value ?? "",
      };
    }),
  };
};


export function useInvoiceForm({
  onInvoiceCreated,
  editInvoiceId,
  editOpen,
  onEditOpenChange,
  prefillFromInvoiceId,
  prefillOpen,
  onPrefillOpenChange,
}: CreateInvoiceDialogProps) {
  const isEditMode = !!editInvoiceId;
  // Same form, loaded from an existing invoice, but saved as a new one:
  // createdInvoiceId stays null and isEditMode stays false, so saveInvoice()
  // takes the create path and the server issues a fresh invoice number.
  const isPrefillMode = !isEditMode && !!prefillFromInvoiceId;
  const sourceInvoiceId = editInvoiceId ?? prefillFromInvoiceId ?? null;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEditMode
    ? (editOpen ?? false)
    : isPrefillMode
      ? (prefillOpen ?? false)
      : internalOpen;
  const setOpen = isEditMode
    ? (v: boolean) => onEditOpenChange?.(v)
    : isPrefillMode
      ? (v: boolean) => onPrefillOpenChange?.(v)
      : setInternalOpen;

  const [formData, setFormData] = useState<InvoiceFormData>(getInitialFormData());
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceDateOpen, setInvoiceDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [savedClients, setSavedClients] = useState<ClientData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [orgCustomFieldDefs, setOrgCustomFieldDefs] = useState<InvoiceCustomField[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>(DEFAULT_UNIT_OPTIONS);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  // The selection is held as a nickname rather than an id because that is what
  // the invoice stores, so reopening one preselects without a second lookup.
  const [selectedPaymentNickname, setSelectedPaymentNickname] = useState<string | null>(null);
  const [paymentAccountDialogOpen, setPaymentAccountDialogOpen] = useState(false);
  const { can } = useAuth();
  const canAddClient = can("income", "write");

  // Fetch organization data and clients when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetchInvoiceUnits()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.activeUnits) && data.activeUnits.length > 0) {
          setUnitOptions(data.activeUnits);
        }
      })
      .catch(() => {
        // Keep DEFAULT_UNIT_OPTIONS fallback so invoice creation never breaks.
      });

    fetchPaymentAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setPaymentAccounts(accounts);
      })
      .catch(() => {
        // No saved sets on offer, so the bank fields stay typed by hand.
      });

    // In edit mode, fetch invoice details
    if (sourceInvoiceId) {
      setEditLoading(true);
      Promise.all([
        fetchInvoice(sourceInvoiceId),
        fetchClients(),
        fetchOrganizationLogo().catch(() => null),
        fetchCurrentOrganization().catch(() => null),
      ])
        .then(([invoiceData, clientData, logoUrl, org]) => {
          if (cancelled) return;
          setSavedClients(clientData);
          const defs: InvoiceCustomField[] = Array.isArray(org?.customFieldDefinitions)
            ? org.customFieldDefinitions.map((f: { id: string | number; name: string; predefinedValues?: string[] }) => ({
                id: String(f.id),
                name: f.name,
                predefinedValues: Array.isArray(f.predefinedValues) ? f.predefinedValues : [],
              }))
            : [];
          setOrgCustomFieldDefs(defs);
          const mapped = mapInvoiceDataToForm(invoiceData, undefined, clientData, defs);
          if (logoUrl) mapped.seller.logo = logoUrl;

          if (isPrefillMode) {
            // This is a new invoice issued now, so it cannot inherit the
            // original's issue date. The gap between the two dates is kept,
            // because that is what encodes the payment terms - "14 days" stays
            // 14 days rather than becoming a due date already in the past.
            const issuedOn = mapped.invoiceDate;
            const dueOn = mapped.dueDate;
            mapped.invoiceDate = new Date();

            if (issuedOn && dueOn) {
              mapped.dueDate = new Date(Date.now() + (dueOn.getTime() - issuedOn.getTime()));
            }

            // The server issues a fresh one; carrying the old number over would
            // be the one thing that must not be copied.
            mapped.invoiceNumber = "";
          }

          setFormData(mapped);
          // Nothing is selected when the set has since been renamed or deleted;
          // the values on the invoice are unaffected either way.
          setSelectedPaymentNickname(invoiceData.bankDetails?.nickname ?? null);
          if (invoiceData.clientId) {
            setSelectedClientId(invoiceData.clientId);
          }
        })
        .catch((err) => {
          console.error("Failed to load invoice data:", err);
          toast({ title: "Error", description: "Failed to load invoice data", variant: "destructive" });
        })
        .finally(() => setEditLoading(false));
    } else {
      Promise.all([fetchCurrentOrganization(), fetchOrganizationLogo().catch(() => null)])
        .then(([org, logoUrl]) => {
          if (cancelled) return;
          const seller: SellerInfo = {
            logo: logoUrl || "",
            name: org.name || "",
            streetAddress: org.streetAddress || "",
            city: org.city || "",
            state: org.state || "",
            zip: org.zipCode || "",
            country: org.country || "",
            taxId: org.taxId || "",
            email: org.email || "",
            phone: org.phone || "",
          };
          const defs: InvoiceCustomField[] = Array.isArray(org?.customFieldDefinitions)
            ? org.customFieldDefinitions.map((f: { id: string | number; name: string; predefinedValues?: string[] }) => ({
                id: String(f.id),
                name: f.name,
                predefinedValues: Array.isArray(f.predefinedValues) ? f.predefinedValues : [],
              }))
            : [];
          setOrgCustomFieldDefs(defs);
          setFormData(getInitialFormData(seller));
        })
        .catch(() => {});

      fetchClients()
        .then((clients) => {
          if (cancelled) return;
          setSavedClients(clients);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [open, sourceInvoiceId, isPrefillMode]);

  // Resolves only while the set still exists. A nickname that no longer matches
  // one leaves the fields unlocked, holding whatever the invoice was issued with.
  const selectedPaymentAccount =
    paymentAccounts.find((a) => a.nickname === selectedPaymentNickname) ?? null;

  // Details an invoice was issued with that match no saved set - from before this
  // picker existed, or from a set since renamed. Shown rather than dropped: they
  // are still what the PDF prints.
  const legacyBankSummary = selectedPaymentAccount
    ? ""
    : [formData.bankName, maskAccountNumber(formData.iban), formData.accountName]
        .filter(Boolean)
        .join(" - ");

  /** Copies a saved set onto the invoice. The values travel, not a reference. */
  const applyPaymentAccount = (account: PaymentAccount) => {
    setSelectedPaymentNickname(account.nickname);
    setFormData((prev) => ({
      ...prev,
      bankName: account.bankName ?? "",
      accountName: account.accountName ?? "",
      iban: account.accountNumber ?? "",
      ifscCode: account.ifsc ?? "",
      swiftBic: account.swift ?? "",
      bankAddress: account.bankAddress ?? "",
    }));
  };

  const handlePaymentAccountSelect = (accountId: string) => {
    const account = paymentAccounts.find((a) => a.id === accountId);
    if (account) applyPaymentAccount(account);
  };

  // Saved from the Add New card: list it and select it, so the click that created
  // it also does what the user came for.
  const handlePaymentAccountCreated = (account: PaymentAccount) => {
    setPaymentAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
    applyPaymentAccount(account);
  };


  /**
   * Copies a saved client onto the invoice. The values travel, not a reference,
   * so editing the client later never rewrites an issued invoice.
   *
   * Shared by selecting a card and by creating one: they used to copy the fields
   * separately, and only the select path zeroed item tax for a foreign client.
   */
  const applyClient = (client: ClientData) => {
    setSelectedClientId(client.id);
    setFormData((prev) => {
      const newClientCountry = client.country || "";
      const isCrossBorder = !!(
        prev.seller.country &&
        newClientCountry &&
        prev.seller.country !== newClientCountry
      );
      return {
        ...prev,
        clientName: client.name || "",
        clientEmail: client.email || "",
        clientStreetAddress: client.streetAddress || "",
        clientCity: client.city || "",
        clientState: client.state || "",
        clientZip: client.zipCode || "",
        clientCountry: newClientCountry,
        clientTaxId: client.taxId || "",
        lineItems: isCrossBorder
          ? prev.lineItems.map((item) => ({ ...item, taxPercent: 0 }))
          : prev.lineItems,
      };
    });
  };

  const handleClientSelect = (clientId: string) => {
    const client = savedClients.find((c) => c.id === clientId);
    if (client) applyClient(client);
  };

  // Saved from the Add New card: list it and select it, so the click that created
  // it also does what the user came for.
  const handleClientCreated = (client: ClientData) => {
    setSavedClients((prev) => [client, ...prev.filter((c) => c.id !== client.id)]);
    applyClient(client);
  };

  const handleInputChange = (field: keyof InvoiceFormData, value: string | Date | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSellerChange = (field: keyof SellerInfo, value: string) => {
    setFormData((prev) => {
      const updatedSeller = { ...prev.seller, [field]: value };

      // If country changed, update currency and tax type
      if (field === "country" && countryDefaults[value]) {
        // Check if client country differs - zero-rate taxes if cross-border
        const isCrossBorder = prev.clientCountry && prev.clientCountry !== value;
        const updatedLineItems = isCrossBorder
          ? prev.lineItems.map((item) => ({ ...item, taxPercent: 0 }))
          : prev.lineItems;

        return {
          ...prev,
          seller: updatedSeller,
          currency: countryDefaults[value].currency,
          taxType: countryDefaults[value].taxType,
          lineItems: updatedLineItems,
        };
      }

      // Check if changing to/from cross-border scenario
      if (field === "country") {
        const isCrossBorder = prev.clientCountry && prev.clientCountry !== value;
        const updatedLineItems = isCrossBorder
          ? prev.lineItems.map((item) => ({ ...item, taxPercent: 0 }))
          : prev.lineItems;
        return { ...prev, seller: updatedSeller, lineItems: updatedLineItems };
      }

      return { ...prev, seller: updatedSeller };
    });
  };

  const handleClientCountryChange = (value: string) => {
    setFormData((prev) => {
      const isCrossBorder = prev.seller.country && prev.seller.country !== value;
      const updatedLineItems = isCrossBorder
        ? prev.lineItems.map((item) => ({ ...item, taxPercent: 0 }))
        : prev.lineItems;

      return {
        ...prev,
        clientCountry: value,
        lineItems: updatedLineItems,
      };
    });
  };

  const toggleCustomField = (def: InvoiceCustomField, checked: boolean) => {
    setFormData((prev) => {
      if (checked) {
        if (prev.customFields.some((f) => f.definitionId === def.id)) return prev;
        return {
          ...prev,
          customFields: [
            ...prev.customFields,
            { uid: def.id, definitionId: def.id, name: def.name, value: "" },
          ],
        };
      }
      return { ...prev, customFields: prev.customFields.filter((f) => f.definitionId !== def.id) };
    });
  };

  const setCustomFieldValue = (definitionId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((f) => (f.definitionId === definitionId ? { ...f, value } : f)),
    }));
  };

  // Rendered as their own rows, after the ones that come from settings.
  const adhocCustomFields = formData.customFields.filter((f) => f.definitionId === null);

  /** A field defined on this invoice only. definitionId stays null. */
  const addAdhocCustomField = () => {
    setFormData((prev) => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { uid: randomUUID(), definitionId: null, name: "", value: "" },
      ],
    }));
  };

  // Keyed on uid, not name: the name is what the user is editing, so using it as
  // the key would lose the row on the first keystroke.
  const updateAdhocCustomField = (uid: string, patch: Partial<InvoiceCustomFieldValue>) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((f) => (f.uid === uid ? { ...f, ...patch } : f)),
    }));
  };

  const removeAdhocCustomField = (uid: string) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => f.uid !== uid),
    }));
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        // Numbering by length collides once a row is removed - deleting row 1 of
        // two and adding another would reuse the id still held by the survivor.
        { id: randomUUID(), description: "", quantity: 1, unit: "Units", rate: 0, taxPercent: 5 },
      ],
    }));
  };

  // Every row is removable, the last one included: a draft is allowed to have none.
  const removeLineItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== id),
    }));
    setSubmittedItemIds((prev) => prev.filter((x) => x !== id));
  };

  const isCrossBorderInvoice = () =>
    !!(formData.seller.country && formData.clientCountry && formData.seller.country !== formData.clientCountry);

  const calculateLineTotal = (item: LineItem) => {
    const subtotal = item.quantity * item.rate;
    const tax = isCrossBorderInvoice() ? 0 : subtotal * (item.taxPercent / 100);
    return subtotal + tax;
  };

  const calculateSubtotal = () => {
    return formData.lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  };

  const calculateTotalTax = () => {
    if (isCrossBorderInvoice()) return 0;
    return formData.lineItems.reduce((sum, item) => {
      const subtotal = item.quantity * item.rate;
      return sum + subtotal * (item.taxPercent / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTotalTax();
  };

  const hasClientSelected = !!(selectedClientId || formData.clientName.trim());
  const hasAtLeastOneItem = formData.lineItems.length > 0;
  const allItemsHaveDescription = formData.lineItems.every((i) => i.description.trim() !== "");
  // Same rule the API applies (sellerSchema in invoice.validator.js), so a bad
  // address is caught here instead of coming back as a toast after submit.
  // Blank is allowed - the seller email is optional.
  const sellerEmailValid =
    formData.seller.email.trim() === "" ||
    EMAIL_RE.test(formData.seller.email.trim());
  // Two rules, because the buttons promise different things. A draft is a
  // work in progress: it may have no items yet, but a row that exists must be
  // described, or it would reach the API as a nameless item and be rejected.
  // Issuing is the real document, so it needs something to bill for.
  const isDraftValid = hasClientSelected && allItemsHaveDescription && sellerEmailValid;
  const isFormValid = isDraftValid && hasAtLeastOneItem;

  // Which button was pressed, so the summary below only raises rules that
  // actually applied to it - null until one is.
  const [attemptedAction, setAttemptedAction] = useState<"create" | "draft" | null>(null);
  const attemptedSubmit = attemptedAction !== null;
  const [submittedItemIds, setSubmittedItemIds] = useState<string[]>([]);
  const [jiggleKey, setJiggleKey] = useState(0);
  const formScrollRef = useRef<any>(null);

  /** Flags the offending fields and scrolls them into view. */
  const reportInvalid = (action: "create" | "draft") => {
    setAttemptedAction(action);
    setSubmittedItemIds(formData.lineItems.map((i) => i.id));
    setJiggleKey((k) => k + 1);
    requestAnimationFrame(() => {
      const el = formScrollRef.current;
      el?.scrollToEnd?.({ animated: true });
    });
  };

  const clearValidation = () => {
    setAttemptedAction(null);
    setSubmittedItemIds([]);
  };

  const handlePreview = () => {
    if (!isFormValid) {
      reportInvalid("create");
      return;
    }
    clearValidation();
    setShowPreview(true);
  };

  const handleBackToForm = () => {
    setShowPreview(false);
  };

  const [confirmingInvoice, setConfirmingInvoice] = useState(false);
  // Set on the first successful save; later attempts update it rather than
  // creating another copy.
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // One key per dialog, reused on every retry. Covers what createdInvoiceId
  // cannot: a lost create response means we never learn the id.
  const [idempotencyKey, setIdempotencyKey] = useState(() => randomUUID());

  // Union territories where UTGST applies instead of SGST
  const utgstTerritories = [
    "Lakshadweep",
    "Ladakh",
    "Chandigarh",
    "Andaman and Nicobar Islands",
    "Dadra and Nagar Haveli and Daman and Diu",
  ];

  const buildTaxSummary = (): Record<string, { rate: number; amount: number }> | undefined => {
    const { seller, clientCountry, lineItems, taxType } = formData;
    const isCrossBorder = seller.country && clientCountry && seller.country !== clientCountry;

    // Cross-border: zero-rated, no tax summary needed
    if (isCrossBorder) return undefined;

    if (taxType === "None") return undefined;

    // Calculate overall subtotal and total tax for effective rate
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const totalTax = lineItems.reduce((sum, item) => sum + item.quantity * item.rate * (item.taxPercent / 100), 0);
    const effectiveRate = subtotal > 0 ? Math.round(((totalTax * 100) / subtotal) * 100) / 100 : 0;

    if (taxType === "GST" && seller.country === "India") {
      const isIntraState = seller.state && formData.clientState && seller.state === formData.clientState;

      if (isIntraState) {
        // Intra-state: split into CGST + SGST (or UTGST for specific UTs)
        const isUT = utgstTerritories.includes(seller.state);
        const secondLabel = isUT ? "UTGST" : "SGST";
        const halfRate = Math.round((effectiveRate / 2) * 100) / 100;
        let totalCgst = 0;
        let totalSecond = 0;

        lineItems.forEach((item) => {
          const itemSubtotal = item.quantity * item.rate;
          const halfAmount = itemSubtotal * (item.taxPercent / 2 / 100);
          totalCgst += halfAmount;
          totalSecond += halfAmount;
        });

        return {
          CGST: { rate: halfRate, amount: Math.round(totalCgst * 100) / 100 },
          [secondLabel]: { rate: halfRate, amount: Math.round(totalSecond * 100) / 100 },
        };
      } else {
        // Inter-state: full IGST
        return {
          IGST: { rate: effectiveRate, amount: Math.round(totalTax * 100) / 100 },
        };
      }
    }

    // VAT / Sales Tax: single entry
    if (taxType === "VAT" || taxType === "Sales Tax") {
      return {
        [taxType]: { rate: effectiveRate, amount: Math.round(totalTax * 100) / 100 },
      };
    }

    return undefined;
  };

  // No status field - the server owns the payment lifecycle.
  const buildPayload = (): Record<string, unknown> => {
    const isCrossBorder =
      formData.seller.country && formData.clientCountry && formData.seller.country !== formData.clientCountry;
    const taxSummary = buildTaxSummary();
    return {
      clientId: selectedClientId || undefined,
      invoiceType: "TAX",
      issueDate: formData.invoiceDate ? formData.invoiceDate.toISOString() : undefined,
      dueDate: formData.dueDate ? formData.dueDate.toISOString() : undefined,
      currency: formData.currency,
      taxType: formData.taxType,
      reverseCharge: !!isCrossBorder,
      ...(taxSummary ? { taxSummary } : {}),
      seller: {
        name: formData.seller.name,
        // Trimmed because that is the value validated above: sending "  " raw
        // would pass here and be rejected by the API as a malformed address.
        email: formData.seller.email.trim(),
        phone: formData.seller.phone,
        streetAddress: formData.seller.streetAddress,
        city: formData.seller.city,
        state: formData.seller.state,
        zipCode: formData.seller.zip,
        country: formData.seller.country,
        taxId: formData.seller.taxId,
        taxSystem: getTaxLabel(formData.seller.country),
      },
      bankDetails: {
        // A copy of the nickname, not a reference: the invoice keeps these
        // numbers even if the saved set is later edited or deleted.
        nickname: selectedPaymentAccount?.nickname ?? null,
        bankName: formData.bankName,
        accountName: formData.accountName,
        accountNumber: formData.iban,
        ifsc: formData.ifscCode,
        swift: formData.swiftBic,
      },
      bankAddress: formData.bankAddress,
      notes: formData.notes,
      items: formData.lineItems.map((item) => ({
        name: item.description,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unit,
        unitPrice: item.rate,
        taxRate: isCrossBorder ? 0 : item.taxPercent,
        itemTotal: String(calculateLineTotal(item)),
      })),
      // A row needs both halves to mean anything. An ad-hoc one still being
      // filled in - a name with no value, or the reverse - is left out rather
      // than sent as a blank label.
      customFields: formData.customFields
        .filter((f) => f.name.trim() !== "" && f.value.trim() !== "")
        .map((f) => ({ name: f.name.trim(), value: f.value.trim() })),
    };
  };

  // A fresh key makes the next invoice a new request, not a retry of this one.
  const resetAfterSubmit = () => {
    setOpen(false);
    setFormData(getInitialFormData());
    setShowPreview(false);
    setSelectedClientId(null);
    setCreatedInvoiceId(null);
    setSelectedPaymentNickname(null);
    setPaymentAccountDialogOpen(false);
    setIdempotencyKey(randomUUID());
    onInvoiceCreated?.();
  };

  /** Creates the invoice, or saves this attempt's edits onto it. Returns the id. */
  const saveInvoice = async (): Promise<string> => {
    const payload = buildPayload();
    const existingId = (isEditMode && editInvoiceId) || createdInvoiceId;

    if (existingId) {
      await updateInvoice(existingId, payload);
      return existingId;
    }

    const created = await createInvoice(payload, { idempotencyKey });
    // Recorded immediately: if anything below fails, the next attempt must edit
    // this invoice rather than create another.
    setCreatedInvoiceId(created.id);
    return created.id;
  };

  const handleConfirmInvoice = async () => {
    setConfirmingInvoice(true);
    try {
      const invoiceId = await saveInvoice();

      // Issued only once the id is in hand, so every later failure is retryable.
      await finalizeInvoice(invoiceId, { sendEmail });

      // Nothing left to edit - progress moves to the row badge.
      toast({
        title: "Invoice created",
        description: "Generating the PDF - progress is shown on the invoice row.",
      });
      resetAfterSubmit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create invoice.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setConfirmingInvoice(false);
    }
  };

  const [savingDraft, setSavingDraft] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const handleSaveAsDraft = async () => {
    // This used to save unconditionally, so a draft could be stored with no
    // client, and a described-less item reached the API only to come back as
    // "Invalid input".
    if (!isDraftValid) {
      reportInvalid("draft");
      return;
    }

    setSavingDraft(true);
    try {
      // No finalize call, so the invoice stays a draft: no PDF, no email.
      await saveInvoice();
      clearValidation();
      toast({ title: "Draft saved", description: "Invoice has been saved as a draft." });
      resetAfterSubmit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save draft. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setFormData(getInitialFormData());
      setShowPreview(false);
      setSelectedClientId(null);
      setCreatedInvoiceId(null);
      setSelectedPaymentNickname(null);
      setPaymentAccountDialogOpen(false);
      setIdempotencyKey(randomUUID());
      setSendEmail(false);
      setAttemptedAction(null);
      setSubmittedItemIds([]);
    }
  };

  return {
    isEditMode,
    isPrefillMode,
    open,
    setOpen,
    formData,
    showPreview,
    invoiceDateOpen,
    setInvoiceDateOpen,
    dueDateOpen,
    setDueDateOpen,
    sellerExpanded,
    setSellerExpanded,
    savedClients,
    selectedClientId,
    addClientOpen,
    setAddClientOpen,
    editLoading,
    orgCustomFieldDefs,
    unitOptions,
    paymentAccounts,
    paymentAccountDialogOpen,
    setPaymentAccountDialogOpen,
    canAddClient,
    selectedPaymentAccount,
    legacyBankSummary,
    handlePaymentAccountSelect,
    handlePaymentAccountCreated,
    handleClientSelect,
    handleClientCreated,
    handleInputChange,
    handleSellerChange,
    toggleCustomField,
    setCustomFieldValue,
    adhocCustomFields,
    addAdhocCustomField,
    updateAdhocCustomField,
    removeAdhocCustomField,
    handleLineItemChange,
    addLineItem,
    removeLineItem,
    calculateLineTotal,
    calculateSubtotal,
    calculateTotalTax,
    calculateTotal,
    hasClientSelected,
    hasAtLeastOneItem,
    sellerEmailValid,
    attemptedAction,
    attemptedSubmit,
    submittedItemIds,
    jiggleKey,
    formScrollRef,
    handlePreview,
    handleBackToForm,
    confirmingInvoice,
    buildTaxSummary,
    handleConfirmInvoice,
    savingDraft,
    sendEmail,
    setSendEmail,
    handleSaveAsDraft,
    handleOpenChange,
  };
}
