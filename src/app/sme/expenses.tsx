import { useEffect, useMemo, useRef, useState } from "react";
import { endOfDay, format, isWithinInterval, startOfDay, startOfMonth, startOfQuarter, startOfWeek } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarIcon, Camera, Filter, ImageIcon, IndianRupee, Pencil, Plus, Trash2, Upload, X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardScreen } from "@/components/DashboardScreen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Box,
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DateField,
  DateRange,
  Dialog,
  DialogHeader,
  DialogTitle,
  FloatingLabelInput,
  FloatingSelect,
  Icon,
  Input,
  Label,
  Popover,
  Popper,
  Press,
  Select,
  Spinner,
  Txt,
  ViewRef,
} from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api/authToken";
import { deleteExpense, fetchExpenses, updateExpense, type ExpenseAPI } from "@/lib/api/expenses";
import { fetchCurrentOrganization } from "@/lib/api/user";
import { config } from "@/lib/config";
import {
  BillCommon,
  BillItem,
  DialogMode,
  ExpenseItem,
  SortField,
  SortOrder,
  TimeRangePreset,
  billPaymentMethods,
  categories,
  countryCurrency,
  countryTaxDefaults,
  createEmptyBillItem,
  createEmptyItem,
  getTaxPercentOptions,
  normalizeUnitType,
  quickPaymentMethods,
  unitTypes,
} from "@/lib/expenseConstants";
import { appendImage, pickImage } from "@/lib/pickImage";

const TIME_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "custom", label: "Custom Range" },
];

const today = () => new Date().toISOString().split("T")[0];
const emptyBillCommon = (): BillCommon => ({ merchant: "", billDate: today(), totalAmount: "", category: "", paymentMethod: "" });

/** Tax % picker: country presets with a "Custom..." escape hatch, as on the web. */
function TaxField({
  value,
  onChange,
  isCustom,
  setCustom,
  country,
  floatingLabel,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  isCustom: boolean;
  setCustom: (v: boolean) => void;
  country?: string;
  floatingLabel: string;
  suffix?: string;
}) {
  const options = getTaxPercentOptions(country);
  const custom = isCustom || (value !== "" && !options.map(String).includes(value));
  return (
    <Box className="flex-row items-center gap-1">
      <Box className="flex-1">
        {custom ? (
          <FloatingLabelInput label={floatingLabel} type="number" value={value} onChangeText={onChange} />
        ) : (
          <Select
            value={value}
            placeholder={floatingLabel}
            options={[...options.map((p) => ({ value: String(p), label: `${p}%` })), { value: "__custom__", label: "Custom..." }]}
            onValueChange={(v) => (v === "__custom__" ? setCustom(true) : onChange(v))}
          />
        )}
      </Box>
      {suffix ? <Txt className="text-xs font-medium text-muted-foreground">{suffix}</Txt> : null}
      {custom && (
        <Button
          variant="ghost"
          size="icon"
          className={suffix ? "h-10 w-10" : "h-8 w-8"}
          accessibilityLabel="Back to presets"
          onPress={() => {
            onChange("");
            setCustom(false);
          }}
        >
          <Icon as={X} className="w-3 h-3" />
        </Button>
      )}
    </Box>
  );
}

const Expenses = () => {
  const { toast } = useToast();
  const { colors } = useTheme();
  const { can } = useAuth();
  const canWriteExpense = can("expense", "write");
  const queryClient = useQueryClient();
  const [apiExpenses, setApiExpenses] = useState<ExpenseAPI[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseAPI | null>(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([createEmptyItem()]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const uploadRef = useRef<ViewRef>(null);
  const [customTaxItems, setCustomTaxItems] = useState<Set<number>>(new Set());
  const [customTaxBillItems, setCustomTaxBillItems] = useState<Set<number>>(new Set());
  const [orgCountry, setOrgCountry] = useState<string | undefined>(undefined);
  const [dialogMode, setDialogMode] = useState<DialogMode>("default");
  const [billCommon, setBillCommon] = useState<BillCommon>(emptyBillCommon());
  const [billItems, setBillItems] = useState<BillItem[]>([createEmptyBillItem()]);
  const [ocrMeta, setOcrMeta] = useState<{ ocrExtracted: boolean; ocrConfidence: number | null; receiptUrl: string | null }>({
    ocrExtracted: false,
    ocrConfidence: null,
    receiptUrl: null,
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseAPI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currency = countryCurrency[orgCountry || ""] || "USD";
  const money = (n: number, digits = 2) =>
    n.toLocaleString(undefined, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits });

  // Fetch org country for tax defaults
  useEffect(() => {
    fetchCurrentOrganization()
      .then((org) => {
        const country = org.country || undefined;
        setOrgCountry(country);
        if (country && countryTaxDefaults[country]) {
          setExpenseItems((prev) =>
            prev.map((item) =>
              !item.taxType && !item.taxPercentage
                ? { ...item, taxType: countryTaxDefaults[country].taxType, taxPercentage: countryTaxDefaults[country].taxPercent }
                : item,
            ),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Recalculate bill total when any item price changes
  useEffect(() => {
    if (dialogMode === "bill") {
      const total = billItems.reduce((sum, item) => sum + (parseFloat(item.itemPrice) || 0), 0);
      setBillCommon((prev) => ({ ...prev, totalAmount: String(Math.round(total * 100) / 100) }));
    }
  }, [billItems, dialogMode]);

  const loadExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      setApiExpenses(await fetchExpenses());
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // Filtering & sorting state
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [totalPriceMin, setTotalPriceMin] = useState<string>("");
  const [totalPriceMax, setTotalPriceMax] = useState<string>("");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isCustomDatePopoverOpen, setIsCustomDatePopoverOpen] = useState(false);
  const [tempCustomDateRange, setTempCustomDateRange] = useState<DateRange | undefined>(undefined);

  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (timeRangePreset) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
      case "this_month":
        return { start: startOfMonth(now), end: endOfDay(now) };
      case "this_quarter":
        return { start: startOfQuarter(now), end: endOfDay(now) };
      case "custom":
        if (customDateRange?.from) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to || customDateRange.from) };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredApiExpenses = useMemo(() => {
    let result = [...apiExpenses];
    if (categoryFilter.length > 0) result = result.filter((r) => categoryFilter.includes(r.category));

    const dateRange = getDateRange();
    if (dateRange) {
      result = result.filter((r) => isWithinInterval(new Date(r.expenseDate), { start: dateRange.start, end: dateRange.end }));
    }
    if (totalPriceMin) {
      const min = parseFloat(totalPriceMin);
      if (!isNaN(min)) result = result.filter((r) => parseFloat(r.totalAmount) >= min);
    }
    if (totalPriceMax) {
      const max = parseFloat(totalPriceMax);
      if (!isNaN(max)) result = result.filter((r) => parseFloat(r.totalAmount) <= max);
    }
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime();
          break;
        case "totalPrice":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "category":
          comparison = (a.category || "").localeCompare(b.category || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiExpenses, categoryFilter, timeRangePreset, customDateRange, totalPriceMin, totalPriceMax, sortField, sortOrder]);

  const summaryStats = useMemo(() => {
    const receipts = filteredApiExpenses;
    const totalSpend = receipts.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
    let totalTax = 0;
    receipts.forEach((r) => {
      (r.items || []).forEach((item) => {
        const taxRate = parseFloat(item.taxRate) || 0;
        if (taxRate > 0) {
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const qty = parseFloat(item.quantity) || 1;
          totalTax += (unitPrice * qty * taxRate) / 100;
        }
      });
    });
    const categorySpend: Record<string, number> = {};
    receipts.forEach((r) => {
      categorySpend[r.category || "Other"] = (categorySpend[r.category || "Other"] || 0) + parseFloat(r.totalAmount);
    });
    const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0];
    return { totalSpend, receiptCount: receipts.length, totalTax, topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null };
  }, [filteredApiExpenses]);

  const handleTimeRangeChange = (value: TimeRangePreset) => {
    setTimeRangePreset(value);
    if (value !== "custom") {
      setCustomDateRange(undefined);
      setTempCustomDateRange(undefined);
    } else {
      setTempCustomDateRange(customDateRange);
      setTimeout(() => setIsCustomDatePopoverOpen(true), 100);
    }
  };

  const handleApplyCustomDateRange = () => {
    setCustomDateRange(tempCustomDateRange);
    setIsCustomDatePopoverOpen(false);
  };

  const clearFilters = () => {
    setCategoryFilter([]);
    setTimeRangePreset("all");
    setCustomDateRange(undefined);
    setTotalPriceMin("");
    setTotalPriceMax("");
  };

  const toggleCategoryFilter = (category: string) =>
    setCategoryFilter((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));

  const hasActiveFilters = categoryFilter.length > 0 || timeRangePreset !== "all" || !!totalPriceMin || !!totalPriceMax;
  const activeFilterCount = [categoryFilter.length > 0, timeRangePreset !== "all", totalPriceMin || totalPriceMax].filter(Boolean).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: string) => {
    const updated = [...expenseItems];
    updated[index] = { ...updated[index], [field]: value };
    setExpenseItems(updated);
  };

  const resetDialog = () => {
    setExpenseItems([createEmptyItem(orgCountry)]);
    setCustomTaxItems(new Set());
    setCustomTaxBillItems(new Set());
    setDialogMode("default");
    setBillCommon(emptyBillCommon());
    setBillItems([createEmptyBillItem()]);
    setOcrMeta({ ocrExtracted: false, ocrConfidence: null, receiptUrl: null });
    setEditingExpenseId(null);
  };

  const saveExpense = async (payload: unknown) => {
    const token = getToken();
    const res = await fetch(`${config.backendHost}/api/expenses/confirmAndSaveExpense`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      toast({ title: "Error", description: result.message || "Failed to save expense", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleManualSubmit = async () => {
    const incompleteItems = expenseItems
      .map((item, index) => {
        const missingFields: string[] = [];
        if (!item.title.trim()) missingFields.push("title");
        if (!item.quantity.trim()) missingFields.push("quantity");
        if (!item.unitPrice.trim()) missingFields.push("unit price");
        if (!item.category) missingFields.push("category");
        return { index: index + 1, missingFields };
      })
      .filter((item) => item.missingFields.length > 0);

    if (incompleteItems.length > 0) {
      const errorMessage = incompleteItems.map((item) => `Item ${item.index}: missing ${item.missingFields.join(", ")}`).join("; ");
      toast({ title: "Error", description: `Please fill all required fields. ${errorMessage}`, variant: "destructive" });
      return;
    }

    const item = expenseItems[0];
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const quantity = parseFloat(item.quantity) || 1;
    const taxRate = parseFloat(item.taxPercentage) || 0;

    const payload = {
      merchant: item.merchant || item.title,
      expenseDate: item.date,
      totalAmount: unitPrice * quantity * (1 + taxRate / 100),
      category: item.category || "Other",
      paymentMethod: (item.paymentMethod || "CASH").toUpperCase(),
      receiptUrl: null,
      ocrExtracted: false,
      ocrConfidence: null,
      items: expenseItems.map((ei) => {
        const qty = parseFloat(ei.quantity) || 1;
        const up = parseFloat(ei.unitPrice) || 0;
        const tax = parseFloat(ei.taxPercentage) || 0;
        return { name: ei.title, quantity: qty, unitPrice: up, unitType: (ei.unitType || "Units").toUpperCase(), taxRate: tax, total: qty * up * (1 + tax / 100) };
      }),
    };

    setIsSaving(true);
    try {
      if (!(await saveExpense(payload))) return;
      await loadExpenses();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseItems([createEmptyItem(orgCountry)]);
      setCustomTaxItems(new Set());
      setIsManualDialogOpen(false);
      toast({ title: "Success", description: "Expense saved successfully" });
    } catch (error) {
      console.error("Save expense error:", error);
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBillSubmit = async () => {
    if (!billCommon.merchant.trim()) {
      toast({ title: "Error", description: "Please enter merchant name", variant: "destructive" });
      return;
    }

    const incompleteItems = billItems
      .map((item, index) => {
        const missing: string[] = [];
        if (!item.name.trim()) missing.push("name");
        if (!item.quantity.trim()) missing.push("quantity");
        if (!item.unitPrice.trim()) missing.push("unit price");
        return { index: index + 1, missing };
      })
      .filter((item) => item.missing.length > 0);

    if (incompleteItems.length > 0) {
      const errorMessage = incompleteItems.map((item) => `Item ${item.index}: missing ${item.missing.join(", ")}`).join("; ");
      toast({ title: "Error", description: `Please fill required fields. ${errorMessage}`, variant: "destructive" });
      return;
    }

    const payload = {
      merchant: billCommon.merchant,
      expenseDate: billCommon.billDate,
      totalAmount: parseFloat(billCommon.totalAmount) || 0,
      category: billCommon.category || "Other",
      paymentMethod: (billCommon.paymentMethod || "CASH").toUpperCase(),
      receiptUrl: ocrMeta.receiptUrl,
      ocrExtracted: ocrMeta.ocrExtracted,
      ocrConfidence: ocrMeta.ocrConfidence,
      items: billItems.map((item) => ({
        name: item.name,
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        unitType: (item.unitType || "Units").toUpperCase(),
        taxRate: parseFloat(item.taxRate) || 0,
        total: parseFloat(item.itemPrice) || 0,
      })),
    };

    setIsSaving(true);
    try {
      if (editingExpenseId) await updateExpense(editingExpenseId, payload);
      else if (!(await saveExpense(payload))) return;

      await loadExpenses();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      const wasEditing = !!editingExpenseId;
      resetDialog();
      setIsManualDialogOpen(false);
      setSelectedReceipt(null);
      toast({ title: "Success", description: wasEditing ? "Expense updated successfully" : "Expense saved successfully" });
    } catch (error: any) {
      console.error("Save expense error:", error);
      toast({ title: "Error", description: error?.message || "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (source: "library" | "camera") => {
    setUploadMenuOpen(false);
    let image;
    try {
      image = await pickImage(source);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not open the image picker", variant: "destructive" });
      return;
    }
    if (!image) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      appendImage(formData, "file", image);

      const token = getToken();
      const response = await fetch(`${config.backendHost}/api/expenses/parseExpense`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "application/json" },
        body: formData,
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data?.parsedData) {
        const parsedData = result.data.parsedData;
        const items = parsedData.items || [];
        if (items.length === 0) {
          toast({ title: "No Items Found", description: "Could not extract any items from the bill", variant: "destructive" });
          return;
        }

        let expenseDate = today();
        if (parsedData.expenseDate) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(parsedData.expenseDate)) expenseDate = parsedData.expenseDate;
          else {
            const dateParts = parsedData.expenseDate.split("/");
            if (dateParts.length === 3) {
              const [day, month, year] = dateParts;
              expenseDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
          }
        }

        const prefillBillItems: BillItem[] = items.map((item: any) => {
          const quantity = Number(item.quantity) || 1;
          const unitPrice = Number(item.unitPrice ?? item.unit_price_before_tax ?? 0) || 0;
          const taxRate = Number(item.taxRate ?? item.taxPercent ?? item.tax_percentage ?? 0) || 0;
          return {
            name: item.itemName || item.name || "",
            quantity: String(item.quantity || 1),
            unitType: normalizeUnitType(item.unitType),
            unitPrice: String(item.unitPrice ?? item.unit_price_before_tax ?? 0),
            taxRate: String(item.taxRate ?? item.taxPercent ?? item.tax_percentage ?? ""),
            itemPrice: String(Math.round(quantity * unitPrice * (1 + taxRate / 100) * 100) / 100),
          };
        });

        setBillCommon({
          merchant: parsedData.merchant || "",
          billDate: expenseDate,
          totalAmount: String(parsedData.totalAmount || ""),
          category: parsedData.category && categories.includes(parsedData.category) ? parsedData.category : "",
          paymentMethod: parsedData.paymentMethod || "",
        });
        setBillItems(prefillBillItems);
        setOcrMeta({
          ocrExtracted: !!parsedData.ocrExtracted,
          ocrConfidence: result.data.confidence ?? parsedData.confidence ?? null,
          receiptUrl: parsedData.receiptUrl || null,
        });
        setDialogMode("bill");
        toast({ title: "Success", description: `Parsed ${items.length} item(s) from the bill` });
      } else {
        toast({ title: "Error", description: "Failed to parse bill data", variant: "destructive" });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      toast({ title: "Error", description: "Failed to process the bill. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Edit a receipt: prefill the bill-mode dialog with existing expense data
  const handleEditReceipt = (receipt: ExpenseAPI) => {
    const prefillBillItems: BillItem[] = (receipt.items || []).map((item) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const taxRate = Number(item.taxRate) || 0;
      return {
        name: item.itemName || "",
        quantity: String(item.quantity ?? "1"),
        unitType: normalizeUnitType(item.unitType),
        unitPrice: String(item.unitPrice ?? ""),
        taxRate: String(item.taxRate ?? ""),
        itemPrice: String(Math.round(quantity * unitPrice * (1 + taxRate / 100) * 100) / 100),
      };
    });

    const pmRaw = (receipt.paymentMethod || "").toString();
    const pmMatch = billPaymentMethods.find((p) => p.toUpperCase() === pmRaw.toUpperCase());

    setBillCommon({
      merchant: receipt.merchant || "",
      billDate: receipt.expenseDate ? new Date(receipt.expenseDate).toISOString().split("T")[0] : today(),
      totalAmount: String(receipt.totalAmount || ""),
      category: receipt.category && categories.includes(receipt.category) ? receipt.category : "",
      paymentMethod: pmMatch || "",
    });
    setBillItems(prefillBillItems.length > 0 ? prefillBillItems : [createEmptyBillItem()]);
    setOcrMeta({ ocrExtracted: !!receipt.ocrExtracted, ocrConfidence: receipt.ocrConfidence, receiptUrl: receipt.receiptUrl });
    setEditingExpenseId(receipt.id);
    setDialogMode("bill");
    setIsManualDialogOpen(true);
  };

  const handleConfirmDeleteReceipt = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete.id);
      await loadExpenses();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Deleted", description: "Expense deleted successfully" });
      setSelectedReceipt(null);
      setExpenseToDelete(null);
    } catch (error: any) {
      console.error("Delete expense error:", error);
      toast({ title: "Error", description: error?.message || "Failed to delete expense", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const setBillItem = (index: number, patch: Partial<BillItem>, recalc = true) => {
    const updated = [...billItems];
    const next = { ...updated[index], ...patch };
    if (recalc) {
      const qty = parseFloat(next.quantity) || 1;
      const up = parseFloat(next.unitPrice) || 0;
      const tax = parseFloat(next.taxRate) || 0;
      next.itemPrice = String(Math.round(qty * up * (1 + tax / 100) * 100) / 100);
    }
    updated[index] = next;
    setBillItems(updated);
  };

  const taxLabel = orgCountry && countryTaxDefaults[orgCountry] ? countryTaxDefaults[orgCountry].taxType : "Tax";
  const setCustomAt = (setter: typeof setCustomTaxItems, index: number) => (on: boolean) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });

  const sortIcon = sortField !== "totalPrice" ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <DashboardScreen module="expense">
      <Box className="gap-6">
        {/* Header */}
        <Box className="gap-4">
          <Box>
            <Txt className="text-3xl font-display font-bold">Expenses</Txt>
            <Txt className="text-muted-foreground mt-1">Track and manage your business expenses.</Txt>
          </Box>
          {canWriteExpense && (
            <Box className="flex-row items-center gap-2">
              <Button size="sm" className="gap-2" onPress={() => setIsManualDialogOpen(true)}>
                <Icon as={Plus} className="w-4 h-4" />
                Add Expense
              </Button>
            </Box>
          )}
        </Box>

        {/* Expense list */}
        <Card>
          <CardHeader className="pb-3" />
          <CardContent>
            {isLoadingExpenses ? (
              <Box className="items-center justify-center py-12">
                <Box className="mb-4">
                  <Spinner className="w-8 h-8 text-primary" />
                </Box>
                <Txt className="text-muted-foreground">Loading expenses...</Txt>
              </Box>
            ) : apiExpenses.length > 0 ? (
              <>
                {/* Summary */}
                {!selectedReceipt && (
                  <Box className="rounded-lg border border-border bg-muted/20 p-4 mb-6 gap-3">
                    <Box className="flex-row items-start gap-6 flex-wrap">
                      <Box className="gap-1">
                        <Box className="flex-row items-center gap-1.5">
                          <Txt className="text-sm font-semibold">{money(summaryStats.totalSpend, 0)}</Txt>
                          <Txt className="text-sm text-muted-foreground">Total Expenses</Txt>
                        </Box>
                        <Box className="flex-row items-center gap-1.5">
                          <Txt className="text-sm font-semibold">{money(summaryStats.totalTax, 0)}</Txt>
                          <Txt className="text-sm text-muted-foreground">{orgCountry === "India" ? "GST" : "Tax"} Claimable</Txt>
                        </Box>
                      </Box>
                      <Box className="flex-row items-center gap-1.5">
                        <Txt className="text-sm font-semibold">{summaryStats.receiptCount}</Txt>
                        <Txt className="text-sm text-muted-foreground">Receipt{summaryStats.receiptCount !== 1 ? "s" : ""}</Txt>
                      </Box>
                      {summaryStats.topCategory && (
                        <Box className="flex-row items-center gap-1.5">
                          <Txt className="text-sm text-muted-foreground">Top Category:</Txt>
                          <Txt className="text-sm font-semibold">{summaryStats.topCategory.name}</Txt>
                        </Box>
                      )}
                    </Box>

                    {/* Filters */}
                    <Box className="flex-row items-center gap-2 flex-wrap">
                      <Select
                        value={timeRangePreset}
                        onValueChange={(v) => handleTimeRangeChange(v as TimeRangePreset)}
                        options={TIME_RANGE_OPTIONS}
                        className="h-8 w-auto gap-1.5"
                        renderValue={(opt) => (
                          <Box className="flex-row items-center gap-1.5">
                            <Icon as={CalendarIcon} className="w-3 h-3" />
                            <Txt className="text-xs">{opt?.label ?? "All Time"}</Txt>
                          </Box>
                        )}
                      />

                      {timeRangePreset === "custom" && (
                        <Popover
                          open={isCustomDatePopoverOpen}
                          onOpenChange={(open) => {
                            setIsCustomDatePopoverOpen(open);
                            if (open) setTempCustomDateRange(customDateRange);
                          }}
                          align="end"
                          className="p-0"
                          trigger={({ ref, toggle }) => (
                            <Button
                              ref={ref}
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              textClassName="text-xs"
                              color={customDateRange ? undefined : colors["muted-foreground"]}
                              onPress={toggle}
                            >
                              <Icon as={CalendarIcon} className="w-3 h-3" />
                              {customDateRange?.from
                                ? customDateRange.to
                                  ? `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d")}`
                                  : format(customDateRange.from, "MMM d, y")
                                : "Pick dates"}
                            </Button>
                          )}
                        >
                          <Calendar mode="range" defaultMonth={tempCustomDateRange?.from} selected={tempCustomDateRange} onSelect={setTempCustomDateRange} />
                          <Box className="p-2 border-t border-border flex-row justify-end">
                            <Button size="sm" className="h-7 px-3" textClassName="text-xs" onPress={handleApplyCustomDateRange} disabled={!tempCustomDateRange?.from}>
                              Apply
                            </Button>
                          </Box>
                        </Popover>
                      )}

                      <Popover
                        open={isFilterPopoverOpen}
                        onOpenChange={setIsFilterPopoverOpen}
                        align="end"
                        className="w-80 p-4"
                        trigger={({ ref, toggle }) => (
                          <Button ref={ref} variant="outline" size="sm" className="h-8 gap-1.5" textClassName="text-xs" onPress={toggle}>
                            <Icon as={Filter} className="w-3 h-3" />
                            Filters
                            {activeFilterCount > 0 && (
                              <Box className="ml-1 h-4 w-4 items-center justify-center rounded-full bg-primary">
                                <Txt className="text-[10px] leading-[14px] text-primary-foreground">{activeFilterCount}</Txt>
                              </Box>
                            )}
                          </Button>
                        )}
                      >
                        <Box className="gap-4">
                          <Box className="flex-row items-center justify-between">
                            <Txt className="font-display text-sm font-medium">Filters</Txt>
                            {hasActiveFilters && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                textClassName="text-xs"
                                color={colors["muted-foreground"]}
                                onPress={() => {
                                  clearFilters();
                                  setIsFilterPopoverOpen(false);
                                }}
                              >
                                Clear all
                              </Button>
                            )}
                          </Box>

                          <Box className="gap-2">
                            <Label className="text-xs text-muted-foreground">Categories</Label>
                            <Box className="flex-row flex-wrap gap-1.5">
                              {categories.map((cat) => {
                                const on = categoryFilter.includes(cat);
                                return (
                                  <Press
                                    key={cat}
                                    onPress={() => toggleCategoryFilter(cat)}
                                    className={`h-7 px-2.5 items-center justify-center rounded-md ${on ? "bg-primary/15" : ""}`}
                                    activeClassName="bg-secondary"
                                  >
                                    <Txt className={`text-xs font-medium ${on ? "text-primary" : "text-muted-foreground"}`}>{cat}</Txt>
                                  </Press>
                                );
                              })}
                            </Box>
                            {categoryFilter.length > 0 && (
                              <Button variant="ghost" size="sm" className="h-6 px-2 self-start" textClassName="text-xs" color={colors["muted-foreground"]} onPress={() => setCategoryFilter([])}>
                                Clear categories
                              </Button>
                            )}
                          </Box>

                          <Box className="gap-2">
                            <Label className="text-xs text-muted-foreground">Total Price Range</Label>
                            <Box className="flex-row items-center gap-2">
                              <Box className="flex-1 justify-center">
                                <Input type="number" placeholder="Min" value={totalPriceMin} onChangeText={setTotalPriceMin} className="h-8 pl-6 text-xs" />
                                <Box className="absolute left-2" pointerEvents="none">
                                  <Icon as={IndianRupee} className="w-3 h-3 text-muted-foreground" />
                                </Box>
                              </Box>
                              <Txt className="text-xs text-muted-foreground">to</Txt>
                              <Box className="flex-1 justify-center">
                                <Input type="number" placeholder="Max" value={totalPriceMax} onChangeText={setTotalPriceMax} className="h-8 pl-6 text-xs" />
                                <Box className="absolute left-2" pointerEvents="none">
                                  <Icon as={IndianRupee} className="w-3 h-3 text-muted-foreground" />
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          <Button size="sm" className="w-full h-8" textClassName="text-xs" onPress={() => setIsFilterPopoverOpen(false)}>
                            Apply Filters
                          </Button>
                        </Box>
                      </Popover>

                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onPress={clearFilters} className="h-8 px-2" textClassName="text-xs" color={colors["muted-foreground"]}>
                          Clear all
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}

                {selectedReceipt ? (
                  /* Receipt detail */
                  <Box className="gap-4">
                    <Box className="flex-row items-center justify-between gap-3 flex-wrap">
                      <Button variant="ghost" size="sm" onPress={() => setSelectedReceipt(null)} className="gap-1">
                        ← Back to Receipts
                      </Button>
                      {canWriteExpense && (
                        <Box className="flex-row items-center gap-2">
                          <Button variant="outline" size="icon" onPress={() => handleEditReceipt(selectedReceipt)} className="h-8 w-8" accessibilityLabel="Edit">
                            <Icon as={Pencil} className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" onPress={() => setExpenseToDelete(selectedReceipt)} className="h-8 w-8" accessibilityLabel="Delete">
                            <Icon as={Trash2} className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </Box>
                      )}
                    </Box>

                    <Box className="p-4 rounded-lg bg-muted/50 border border-border gap-1">
                      <Txt className="font-display text-lg font-semibold">{selectedReceipt.merchant}</Txt>
                      <Box className="flex-row flex-wrap gap-x-4 gap-y-4">
                        <Txt className="text-sm text-muted-foreground">Date: {format(new Date(selectedReceipt.expenseDate), "MMM d, yyyy")}</Txt>
                        <Txt className="text-sm text-muted-foreground">Total: {money(parseFloat(selectedReceipt.totalAmount))}</Txt>
                        <Txt className="text-sm text-muted-foreground">Category: {selectedReceipt.category || "—"}</Txt>
                        <Txt className="text-sm text-muted-foreground">Payment: {selectedReceipt.paymentMethod || "—"}</Txt>
                      </Box>
                    </Box>

                    <DataTable
                      rows={selectedReceipt.items || []}
                      rowKey={(item) => item.id}
                      columns={[
                        { key: "name", header: "Item Name", width: 96, className: "font-medium", render: (item) => item.itemName },
                        { key: "qty", header: "Qty", width: 60, align: "right", render: (item) => item.quantity },
                        { key: "unit", header: "Unit Type", width: 80, render: (item) => normalizeUnitType(item.unitType) },
                        { key: "price", header: "Unit Price", width: 104, align: "right", render: (item) => money(parseFloat(item.unitPrice)) },
                        { key: "tax", header: "Tax Rate", width: 76, align: "right", render: (item) => (parseFloat(item.taxRate) > 0 ? `${item.taxRate}%` : "—") },
                        {
                          key: "total",
                          header: "Total",
                          width: 112,
                          align: "right",
                          className: "font-medium",
                          render: (item) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const up = parseFloat(item.unitPrice) || 0;
                            const tax = parseFloat(item.taxRate) || 0;
                            return money(Math.round(qty * up * (1 + tax / 100) * 100) / 100);
                          },
                        },
                      ]}
                    />
                  </Box>
                ) : (
                  /* Receipt list */
                  <Box className="gap-2">
                    <Box className="flex-row items-center justify-between px-4 py-2">
                      <Txt className="text-xs text-muted-foreground font-medium">Receipt</Txt>
                      <Press className="flex-row items-center gap-1" onPress={() => handleSort("totalPrice")} hitSlop={8}>
                        <Txt className="text-xs text-muted-foreground font-medium">Amount</Txt>
                        <Icon as={sortIcon} className={`w-4 h-4 ml-1 text-muted-foreground ${sortField !== "totalPrice" ? "opacity-50" : ""}`} />
                      </Press>
                    </Box>
                    {filteredApiExpenses.length > 0 ? (
                      filteredApiExpenses.map((receipt) => (
                        <Press
                          key={receipt.id}
                          className="flex-row items-center justify-between p-4 rounded-lg border border-border"
                          activeClassName="bg-muted/50"
                          onPress={() => setSelectedReceipt(receipt)}
                        >
                          <Box className="flex-1 gap-0.5">
                            <Txt className="font-medium">{receipt.merchant}</Txt>
                            <Txt className="text-xs text-muted-foreground">
                              {format(new Date(receipt.expenseDate), "MMM d, yyyy")} · {(receipt.items || []).length} item
                              {(receipt.items || []).length !== 1 ? "s" : ""} · {receipt.category || "Uncategorized"}
                            </Txt>
                          </Box>
                          <Txt className="text-base font-semibold">{money(parseFloat(receipt.totalAmount))}</Txt>
                        </Press>
                      ))
                    ) : (
                      <Box className="items-center justify-center py-8">
                        <Txt className="text-muted-foreground">No receipts match the current filters</Txt>
                        <Button variant="link" onPress={clearFilters} className="mt-2">
                          Clear all filters
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </>
            ) : (
              <Box className="items-center justify-center py-12">
                <Box className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
                  <Icon as={IndianRupee} className="w-8 h-8 text-muted-foreground" />
                </Box>
                <Txt className="text-muted-foreground text-center">No expenses added yet</Txt>
                <Txt className="text-muted-foreground text-sm text-center">Add your first expense using the options above</Txt>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Add / edit expense dialog */}
      <Dialog
        open={isManualDialogOpen}
        onOpenChange={(open) => {
          setIsManualDialogOpen(open);
          if (!open) resetDialog();
        }}
        sideMargin={16}
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{editingExpenseId ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        {dialogMode === "default" && (
          <>
            {/* Upload receipt */}
            <Press
              ref={uploadRef}
              disabled={isUploading}
              onPress={() => setUploadMenuOpen(true)}
              className="border-2 border-dashed border-border rounded-lg p-6 items-center"
              activeClassName="border-primary"
            >
              {isUploading ? (
                <Box className="items-center gap-2">
                  <Spinner className="w-8 h-8 text-primary" />
                  <Txt className="font-medium">Processing receipt...</Txt>
                </Box>
              ) : (
                <>
                  <Icon as={Upload} className="w-8 h-8 text-muted-foreground mb-2" />
                  <Txt className="font-medium">Upload Receipt / Bill</Txt>
                  <Txt className="text-muted-foreground text-xs mt-1">Upload image to auto-parse bill details</Txt>
                </>
              )}
            </Press>
            <Popper open={uploadMenuOpen} onClose={() => setUploadMenuOpen(false)} anchorRef={uploadRef} align="center" className="p-1 shadow-lg">
              {[
                { label: "Take Photo", icon: Camera, source: "camera" as const },
                { label: "Photo Library", icon: ImageIcon, source: "library" as const },
              ].map((o) => (
                <Press key={o.label} className="flex-row items-center rounded-sm px-2 py-1.5" activeClassName="bg-accent/15" onPress={() => handleFileUpload(o.source)}>
                  <Icon as={o.icon} className="mr-2 h-4 w-4" />
                  <Txt className="text-sm">{o.label}</Txt>
                </Press>
              ))}
            </Popper>

            <Box className="flex-row items-center gap-3 my-1">
              <Box className="flex-1 h-px bg-border" />
              <Txt className="text-xs text-muted-foreground">or add a quick expense</Txt>
              <Box className="flex-1 h-px bg-border" />
            </Box>

            {/* Quick single expense */}
            <Box className="gap-4">
              <Box className="gap-3">
                <FloatingLabelInput label="Title *" value={expenseItems[0].title} onChangeText={(v) => updateItem(0, "title", v)} />
                <FloatingLabelInput label="Merchant" value={expenseItems[0].merchant} onChangeText={(v) => updateItem(0, "merchant", v)} />
                <DateField label="Date" value={expenseItems[0].date} onChange={(v) => updateItem(0, "date", v)} />
                <Box className="flex-row gap-3">
                  <Box className="flex-1">
                    <FloatingLabelInput label="Qty *" type="number" value={expenseItems[0].quantity} onChangeText={(v) => updateItem(0, "quantity", v)} />
                  </Box>
                  <Box className="flex-1">
                    <Select value={expenseItems[0].unitType} onValueChange={(v) => updateItem(0, "unitType", v)} options={unitTypes} placeholder="Unit" />
                  </Box>
                </Box>
                <Box className="flex-row gap-3">
                  <Box className="flex-1 flex-row items-center gap-1">
                    <Box className="flex-1">
                      <FloatingLabelInput label="Unit Price *" type="number" value={expenseItems[0].unitPrice} onChangeText={(v) => updateItem(0, "unitPrice", v)} />
                    </Box>
                    <Txt className="text-xs text-muted-foreground">{currency}</Txt>
                  </Box>
                  <Box className="flex-1">
                    <TaxField
                      value={expenseItems[0].taxPercentage}
                      onChange={(v) => updateItem(0, "taxPercentage", v)}
                      isCustom={customTaxItems.has(0)}
                      setCustom={setCustomAt(setCustomTaxItems, 0)}
                      country={orgCountry}
                      floatingLabel="Tax %"
                      suffix={taxLabel}
                    />
                  </Box>
                </Box>
                <Box className="flex-row gap-3">
                  <Box className="flex-1">
                    <Select
                      value={expenseItems[0].category}
                      onValueChange={(v) => updateItem(0, "category", v)}
                      options={categories}
                      placeholder="Category *"
                      contentClassName="min-w-[200px]"
                    />
                  </Box>
                  <Box className="flex-1">
                    <Select value={expenseItems[0].paymentMethod} onValueChange={(v) => updateItem(0, "paymentMethod", v)} options={quickPaymentMethods} placeholder="Payment" />
                  </Box>
                </Box>
              </Box>

              <Box className="flex-row gap-3 pt-2">
                {/* flex-auto mirrors the web, where the wider label takes the room it needs */}
                <Button variant="outline" className="flex-auto" onPress={() => { setIsManualDialogOpen(false); resetDialog(); }}>
                  Cancel
                </Button>
                <Button className="flex-auto" onPress={handleManualSubmit} disabled={isSaving}>
                  <Icon as={Plus} className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </Box>
            </Box>
          </>
        )}

        {dialogMode === "bill" && (
          <Box className="gap-4">
            <Box className="gap-3">
              <Label>Bill Details</Label>
              <Box className="p-4 border border-border rounded-lg bg-muted/30 gap-3">
                <Box className="flex-row gap-3">
                  <Box className="flex-1">
                    <FloatingLabelInput label="Merchant *" value={billCommon.merchant} onChangeText={(v) => setBillCommon({ ...billCommon, merchant: v })} />
                  </Box>
                  <Box className="flex-1">
                    <DateField label="Bill Date" value={billCommon.billDate} onChange={(v) => setBillCommon({ ...billCommon, billDate: v })} />
                  </Box>
                </Box>
                <Box className="flex-row items-center gap-1">
                  <Box className="flex-1">
                    <FloatingLabelInput label="Total Amount" type="number" value={billCommon.totalAmount} onChangeText={(v) => setBillCommon({ ...billCommon, totalAmount: v })} />
                  </Box>
                  <Txt className="text-xs text-muted-foreground">{currency}</Txt>
                </Box>
                <Box className="flex-row gap-3">
                  <Box className="flex-1">
                    <FloatingSelect label="Category" value={billCommon.category} onValueChange={(v) => setBillCommon({ ...billCommon, category: v })} options={categories} />
                  </Box>
                  <Box className="flex-1">
                    <FloatingSelect label="Payment Method" value={billCommon.paymentMethod} onValueChange={(v) => setBillCommon({ ...billCommon, paymentMethod: v })} options={billPaymentMethods} />
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box className="gap-3">
              <Label>Items</Label>
              {billItems.map((item, index) => (
                <Box key={index} className="p-4 border border-border rounded-lg bg-muted/30 gap-3">
                  <Box className="flex-row justify-between items-center">
                    <Txt className="text-sm font-medium text-muted-foreground">Item {index + 1}</Txt>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={billItems.length === 1}
                      accessibilityLabel={`Remove item ${index + 1}`}
                      onPress={() => billItems.length > 1 && setBillItems(billItems.filter((_, i) => i !== index))}
                    >
                      <Icon as={Trash2} className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </Box>
                  {/* The web squeezes these six fields into one row, which is unreadable on a phone; they are stacked here. */}
                  <FloatingLabelInput label="Name *" value={item.name} onChangeText={(v) => setBillItem(index, { name: v }, false)} />
                  <Box className="flex-row gap-3">
                    <Box className="flex-1">
                      <FloatingLabelInput label="Qty *" type="number" value={item.quantity} onChangeText={(v) => setBillItem(index, { quantity: v })} />
                    </Box>
                    <Box className="flex-1">
                      <Select value={item.unitType} onValueChange={(v) => setBillItem(index, { unitType: v }, false)} options={unitTypes} placeholder="Unit" />
                    </Box>
                  </Box>
                  <Box className="flex-row gap-3">
                    <Box className="flex-1">
                      <FloatingLabelInput label="Unit Price *" type="number" value={item.unitPrice} onChangeText={(v) => setBillItem(index, { unitPrice: v })} />
                    </Box>
                    <Box className="flex-1">
                      <TaxField
                        value={item.taxRate}
                        onChange={(v) => setBillItem(index, { taxRate: v })}
                        isCustom={customTaxBillItems.has(index)}
                        setCustom={setCustomAt(setCustomTaxBillItems, index)}
                        country={orgCountry}
                        floatingLabel={`${taxLabel} %`}
                      />
                    </Box>
                  </Box>
                  <FloatingLabelInput label="Item Price" type="number" value={item.itemPrice} onChangeText={(v) => setBillItem(index, { itemPrice: v }, false)} />
                </Box>
              ))}
              <Button variant="outline" size="sm" className="w-full" onPress={() => setBillItems([...billItems, createEmptyBillItem()])}>
                <Icon as={Plus} className="w-4 h-4 mr-2" />
                Add Another Item
              </Button>
            </Box>

            <Box className="flex-row gap-3 pt-2">
              {!editingExpenseId && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setDialogMode("default");
                    setBillCommon(emptyBillCommon());
                    setBillItems([createEmptyBillItem()]);
                  }}
                >
                  ← Back
                </Button>
              )}
              <Button className="flex-1" onPress={handleBillSubmit} disabled={isSaving}>
                {editingExpenseId ? null : <Icon as={Plus} className="w-4 h-4 mr-2" />}
                {editingExpenseId ? "Update Expense" : `Add ${billItems.length > 1 ? `${billItems.length} Expenses` : "Expense"}`}
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the expense
            {expenseToDelete?.merchant ? ` from ${expenseToDelete.merchant}` : ""} and all its items. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onPress={() => setExpenseToDelete(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onPress={handleConfirmDeleteReceipt} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </DashboardScreen>
  );
};

export default Expenses;
