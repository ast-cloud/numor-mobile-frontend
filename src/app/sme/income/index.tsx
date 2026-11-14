// Invoices list. The data logic below is the web frontend's Income page, unchanged apart
// from navigation and PDF opening; only the layout is rebuilt with native views.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { ArrowUpDown, CalendarIcon, ChevronLeft, ChevronRight, Circle, Copy, Download, MoreHorizontal, PenSquare, Search, SlidersHorizontal, Trash2, Users, X } from "lucide-react-native";
import { format, parse, parseISO, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfQuarter } from "date-fns";
import CreateInvoiceDialog from "@/components/CreateInvoiceDialog";
import { DashboardScreen } from "@/components/DashboardScreen";
import InvoicePreviewWrapper from "@/components/InvoicePreview";
import { InvoiceEmailStatus, InvoiceProgressBadge } from "@/components/InvoiceStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Box,
  Button,
  Calendar,
  DateRange,
  Dialog,
  DropdownMenu,
  Icon,
  Input,
  Label,
  MenuItem,
  Popover,
  Press,
  Select,
  Spinner,
  Txt,
} from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { moneyLocale } from "@/lib/amountInWords";
import { fetchClients, type ClientData } from "@/lib/api/clients";
import { fetchInvoices, fetchInvoice, updateInvoiceStatus, fetchInvoicePdfStatus, deleteInvoice, cloneInvoiceAsDraft, type InvoiceData, type InvoiceTab, type InvoiceListResult } from "@/lib/api/invoices";
import { fetchCurrentOrganization, fetchOrganizationLogo } from "@/lib/api/user";
import type { InvoiceFormData } from "@/lib/invoiceTemplateRenderer";
import { buildPageItems } from "@/lib/pagination";

type TimeRangePreset = "all" | "today" | "this_week" | "this_month" | "this_quarter" | "custom";

type SortOption = "due_date_asc" | "due_date_desc" | "issue_date_asc" | "issue_date_desc" | "amount_asc" | "amount_desc" | "client_asc" | "client_desc";

type InvoiceStatus = "draft" | "paid" | "unpaid" | "overdue";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  dueDate: string;
  issueDate: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string;
  // Drives the progress badge; `status` is payment state.
  pdfStatus: string;
  emailStatus: string;
  // NOT_REQUESTED only means "done" when this is false.
  emailRequested: boolean;
  emailSentAt: string | null;
  emailError: string | null;
}

const mapApiStatus = (status: string): InvoiceStatus => {
  const s = status.toLowerCase();
  if (s === "paid") return "paid";
  if (s === "draft") return "draft";
  if (s === "overdue") return "overdue";
  return "unpaid";
};

const mapApiInvoice = (inv: InvoiceData, clientsMap: Map<string, string>): Invoice => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber,
  // The snapshot first. clientsMap is keyed on clientId, which is null once the
  // client is deleted - and the old fallback then printed the SELLER name in the
  // client column rather than admitting it did not know.
  clientName: inv.clientName || clientsMap.get(inv.clientId as string) || "—",
  dueDate: format(parseISO(inv.dueDate), "dd/MM/yyyy"),
  issueDate: inv.issueDate ? format(parseISO(inv.issueDate), "dd/MM/yyyy") : "",
  amount: parseFloat(inv.totalAmount),
  currency: inv.currency || "USD",
  status: mapApiStatus(inv.status),
  pdfUrl: inv.pdfKey || "",
  pdfStatus: inv.pdfStatus || "NOT_STARTED",
  emailStatus: inv.emailStatus || "NOT_REQUESTED",
  emailSentAt: inv.emailSentAt ?? null,
  emailRequested: inv.emailRequested ?? false,
  emailError: inv.emailError ?? null,
});

const statusStyles: Record<
  InvoiceStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  paid: { variant: "default", label: "Paid" },
  unpaid: { variant: "outline", label: "Unpaid" },
  overdue: { variant: "destructive", label: "Overdue" },
};

// Rows per page. The server caps limit at 200; this is what the pager steps by.
const PAGE_SIZE = 10;


const COUNTRY_CURRENCY: Record<string, string> = {
  India: "INR", UAE: "AED", US: "USD", UK: "GBP",
  Austria: "EUR", Belgium: "EUR", France: "EUR", Germany: "EUR",
  Italy: "EUR", Netherlands: "EUR", Spain: "EUR", Sweden: "EUR",
};

const formatCurrencyVal = (amount: number, currency = "USD") => {
  try {
    // The currency decides the grouping, not the browser: an en-US visitor
    // should still see an INR invoice as 7,35,000.
    return new Intl.NumberFormat(moneyLocale(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
};

const SORT_OPTIONS = [
  { value: "due_date_desc", label: "Due Date (Latest)" },
  { value: "due_date_asc", label: "Due Date (Oldest)" },
  { value: "issue_date_desc", label: "Issue Date (Latest)" },
  { value: "issue_date_asc", label: "Issue Date (Oldest)" },
  { value: "amount_desc", label: "Amount (High to Low)" },
  { value: "amount_asc", label: "Amount (Low to High)" },
  { value: "client_asc", label: "Client (A to Z)" },
  { value: "client_desc", label: "Client (Z to A)" },
];

const TIME_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "custom", label: "Custom Range" },
];

const InvoiceRow = ({
  invoice,
  isLast,
  onClick,
  onStatusChange,
  onProgressStatusChange,
  onDownload,
  onClone,
  onEditReshare,
  onDelete,
}: {
  invoice: Invoice;
  isLast: boolean;
  onClick: () => void;
  onStatusChange: (invoiceId: string, status: InvoiceStatus) => void;
  onProgressStatusChange: (invoiceId: string, status: string) => void;
  onDownload: (invoice: Invoice) => void;
  onClone: (invoice: Invoice) => void;
  onEditReshare: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) => {
  const { variant, label } = statusStyles[invoice.status];
  const notDraft = invoice.status !== "draft";
  const items: MenuItem[] = [
    ...(notDraft
      ? ([
          {
            label: "Change Status",
            icon: Circle,
            submenu: (["paid", "unpaid", "overdue"] as InvoiceStatus[]).map((s) => ({ label: statusStyles[s].label, onPress: () => onStatusChange(invoice.id, s) })),
          },
          { separator: true },
          { label: "Download PDF", icon: Download, onPress: () => onDownload(invoice) },
          { label: "Edit & Re-share", icon: PenSquare, onPress: () => onEditReshare(invoice) },
          { label: "Clone as Draft", icon: Copy, onPress: () => onClone(invoice) },
        ] as MenuItem[])
      : []),
    { separator: true },
    { label: "Delete", icon: Trash2, destructive: true, onPress: () => onDelete(invoice) },
  ];
  return (
    <Press className={`flex-row items-center justify-between gap-3 py-4 px-4 ${isLast ? "" : "border-b border-border"}`} activeClassName="bg-muted/50" onPress={onClick}>
      <Box className="flex-1">
        <Txt numberOfLines={1}>
          <Txt className="font-medium">{invoice.invoiceNumber}</Txt>
          <Txt className="text-muted-foreground">, </Txt>
          {invoice.clientName}
        </Txt>
        <Txt className="text-sm text-muted-foreground mt-0.5">{invoice.dueDate}</Txt>
      </Box>
      <Box className="flex-row items-center gap-2">
        <InvoiceProgressBadge
          invoiceId={invoice.id}
          pdfStatus={invoice.pdfStatus}
          emailStatus={invoice.emailStatus}
          emailRequested={invoice.emailRequested}
          onStatusChange={(status) => onProgressStatusChange(invoice.id, status)}
        />
        <Badge variant={variant} className="min-w-[56px] justify-center self-auto">
          {label}
        </Badge>
        <Txt className="font-semibold min-w-[60px] text-right">{formatCurrencyVal(invoice.amount, invoice.currency)}</Txt>
        <DropdownMenu
          align="end"
          className="w-48"
          items={items}
          trigger={({ ref, open }) => (
            <Press ref={ref} className="p-1 rounded-md" activeClassName="bg-muted" onPress={open} hitSlop={8} accessibilityLabel="Invoice actions">
              <Icon as={MoreHorizontal} className="h-5 w-5 text-muted-foreground" />
            </Press>
          )}
        />
      </Box>
    </Press>
  );
};

const Income = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [isCustomDatePopoverOpen, setIsCustomDatePopoverOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  // Client ids, not names: two clients can share a name, and the chips are
  // built from the saved client list, which is keyed by id.
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("due_date_desc");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
  const [previewFormData, setPreviewFormData] = useState<InvoiceFormData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // The badge polls, so it sees the invoice become issued before any refresh.
  const handleProgressStatusChange = (invoiceId: string, status: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: mapApiStatus(status) } : inv
      )
    );
  };
  const [rawInvoices, setRawInvoices] = useState<InvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  // The key is minted when the dialog opens, not per click, so confirming twice
  // after a failed first attempt resolves to one copy rather than two.
  const [cloneTarget, setCloneTarget] = useState<{ invoice: Invoice; idempotencyKey: string } | null>(null);
  const [cloning, setCloning] = useState(false);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  // Re-issuing an invoice that already went out. Held separately from
  // editDraftId because this one must not edit the invoice it was opened from.
  const [reshareSourceId, setReshareSourceId] = useState<string | null>(null);
  const [reshareOpen, setReshareOpen] = useState(false);

  // What the user is typing, and the value actually sent to the server. Kept
  // apart so every keystroke does not become a request.
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [offset, setOffset] = useState(0);
  // The full-page spinner is for the first load only. Every later fetch keeps
  // the screen mounted: swapping it for a spinner tore out the search box
  // mid-keystroke, and the remounted input came back without focus.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  // Counts and totals come from the server: they describe the whole filtered
  // set, which the page of rows no longer does.
  const [counts, setCounts] = useState<Record<InvoiceTab, number>>({ all: 0, draft: 0, unpaid: 0, paid: 0, overdue: 0 });
  const [totals, setTotals] = useState<InvoiceListResult["totals"]>({ invoiceCount: 0, byCurrency: [], topClient: null });
  const [editDraftOpen, setEditDraftOpen] = useState(false);
  const [clientsData, setClientsData] = useState<ClientData[]>([]);
  const [orgCountry, setOrgCountry] = useState<string>("US");
  const { toast } = useToast();
  const { can } = useAuth();
  const canWriteIncome = can("income", "write");

  useEffect(() => {
    fetchCurrentOrganization()
      .then((org) => setOrgCountry(org.country || "US"))
      .catch(() => {});
  }, []);

  const queryClient = useQueryClient();

  const getDateRange = (): { start: Date; end: Date } | null => {
    const today = new Date();
    switch (timeRangePreset) {
      case "today":
        return { start: startOfDay(today), end: endOfDay(today) };
      case "this_week":
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfDay(today) };
      case "this_month":
        return { start: startOfMonth(today), end: endOfDay(today) };
      case "this_quarter":
        return { start: startOfQuarter(today), end: endOfDay(today) };
      case "custom":
        if (customDateRange?.from) {
          return {
            start: startOfDay(customDateRange.from),
            end: endOfDay(customDateRange.to || customDateRange.from),
          };
        }
        return null;
      default:
        return null;
    }
  };

  // Filtering, sorting, searching and paging all happen on the server now, so
  // this carries the whole query rather than fetching everything and sifting it
  // here. Held in a ref so loadInvoices() can stay a stable, argument-free
  // callback for the many places that just want a refresh.
  const dateRange = getDateRange();
  const listQuery = {
    tab: activeTab as InvoiceTab,
    search: searchTerm,
    sort: sortOption,
    clientIds: selectedClientIds,
    limit: PAGE_SIZE,
    offset,
    startDate: dateRange?.start.toISOString(),
    endDate: dateRange?.end.toISOString(),
    // The screen shows and filters by due date; the API defaults to issue date.
    dateField: "dueDate" as const,
  };
  const listQueryRef = useRef(listQuery);
  listQueryRef.current = listQuery;

  const loadInvoices = useCallback(() => {
    setIsLoading(true);
    Promise.all([fetchInvoices(listQueryRef.current), fetchClients()])
      .then(([result, clientData]) => {
        const clientsMap = new Map(clientData.map((c) => [c.id, c.name]));
        setClientsData(clientData);
        setRawInvoices(result.invoices);
        setInvoices(result.invoices.map((inv) => mapApiInvoice(inv, clientsMap)));
        setPagination(result.pagination);
        setCounts(result.counts);
        setTotals(result.totals);
        // Invalidate React Query cache so dashboard stays in sync
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      })
      .catch((err) => {
        console.error("Failed to fetch invoices:", err);
        toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
      })
      .finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
  }, [queryClient, toast]);

  // Typing pauses before it becomes a request.
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any change to what is being asked for starts again at the first page -
  // otherwise a narrower filter can leave you stranded on a page past its end.
  useEffect(() => {
    setOffset(0);
  }, [activeTab, searchTerm, sortOption, timeRangePreset, customDateRange, selectedClientIds]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, activeTab, searchTerm, sortOption, timeRangePreset, customDateRange, selectedClientIds, offset]);

  const handleInvoiceClick = async (invoice: Invoice) => {
    if (invoice.status === "draft") {
      // A worker is rendering this invoice right now. Editing would make it
      // discard that PDF and start again, which looks like a random restart, so
      // the server refuses it too.
      if (["QUEUED", "PROCESSING"].includes(invoice.pdfStatus)) {
        toast({
          title: "Still generating",
          description: "This invoice can be edited once its PDF finishes.",
        });
        return;
      }

      setEditDraftId(invoice.id);
      setEditDraftOpen(true);
      return;
    }
    setSelectedInvoice(invoice);
    setPreviewFormData(null);
    setIsPdfDialogOpen(true);
    try {
      const [detail, logoUrl] = await Promise.all([
        fetchInvoice(invoice.id),
        fetchOrganizationLogo().catch(() => null),
      ]);
      // Look up client from already-fetched clients data
      const client = clientsData.find((c) => c.id === detail.clientId);

      const formData: InvoiceFormData = {
        invoiceNumber: detail.invoiceNumber || "",
        invoiceDate: detail.issueDate ? new Date(detail.issueDate) : undefined,
        dueDate: detail.dueDate ? new Date(detail.dueDate) : undefined,
        currency: detail.currency || "USD",
        taxType: detail.taxType || "GST",
        seller: {
          logo: logoUrl || "",
          name: detail.sellerName || detail.seller?.name || "",
          streetAddress: detail.sellerStreetAddress || detail.seller?.streetAddress || "",
          city: detail.sellerCity || detail.seller?.city || "",
          state: detail.sellerState || detail.seller?.state || "",
          zip: detail.sellerZipCode || detail.seller?.zipCode || "",
          country: detail.sellerCountry || detail.seller?.country || "",
          taxId: detail.sellerTaxId || detail.seller?.taxId || "",
          email: detail.sellerEmail || detail.seller?.email || "",
          phone: detail.sellerPhone || detail.seller?.phone || "",
        },
        // Snapshot first, then the live client record, then the relation.
        clientName: detail.clientName || client?.name || detail.client?.name || "",
        clientEmail: detail.clientEmail || client?.email || detail.client?.email || "",
        clientPhone: detail.clientPhone || client?.phone || detail.client?.phone || "",
        clientStreetAddress:
          detail.clientStreetAddress || client?.streetAddress || detail.client?.streetAddress || "",
        clientCity: detail.clientCity || client?.city || detail.client?.city || "",
        clientState: detail.clientState || client?.state || detail.client?.state || "",
        clientZip: detail.clientZipCode || client?.zipCode || detail.client?.zipCode || "",
        clientCountry: detail.clientCountry || client?.country || detail.client?.country || "",
        lineItems: (detail.items || []).map((item) => ({
          id: item.id,
          description: item.description || item.itemName || "",
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unitType || "",
          rate: parseFloat(item.unitPrice) || 0,
          taxPercent: parseFloat(item.taxRate) || 0,
        })),
        bankName: detail.bankDetails?.bankName || "",
        accountName: detail.bankDetails?.accountName || "",
        iban: detail.bankDetails?.accountNumber || "",
        swiftBic: detail.bankDetails?.swift || "",
        ifscCode: detail.bankDetails?.ifsc || "",
        bankAddress: detail.bankAddress || "",
        notes: detail.notes || "",
        sacCode: detail.sacCode || "",
        paymentTerms: detail.paymentTerms || "",
        customFields: (detail.customFields || []) as never,
      };
      setPreviewFormData(formData);
    } catch {
      console.error("Failed to fetch invoice details for preview");
    }
  };

  const handleDownloadPdf = async (invoice?: Invoice) => {
    const target = invoice || selectedInvoice;
    if (!target || target.status === "draft") return;

    try {
      const res = await fetchInvoicePdfStatus(target.id);
      if (res.success && res.url) {
        // Opens the PDF in the device browser, where it can be viewed, saved or shared.
        await Linking.openURL(res.url);
      } else {
        toast({ title: "PDF not available", description: res.message || "PDF is not ready yet", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch PDF", variant: "destructive" });
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const oldStatus = invoice.status;
    // Optimistic update
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv)));

    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice({ ...selectedInvoice, status: newStatus });
    }

    try {
      await updateInvoiceStatus(invoiceId, newStatus.toUpperCase());
      toast({
        title: "Status updated",
        description: `Invoice ${invoice.invoiceNumber} marked as ${statusStyles[newStatus].label}`,
      });
    } catch {
      // Revert on failure
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: oldStatus } : inv)));
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status: oldStatus });
      }
      toast({ title: "Error", description: "Failed to update invoice status", variant: "destructive" });
    }
  };

  const handleCloneInvoice = async () => {
    if (!cloneTarget) return;
    setCloning(true);
    try {
      await cloneInvoiceAsDraft(cloneTarget.invoice.id, cloneTarget.idempotencyKey);
      toast({
        title: "Copied as draft",
        description: `A draft copy of ${cloneTarget.invoice.invoiceNumber} has been created.`,
      });
      setCloneTarget(null);
      loadInvoices();
    } catch (err) {
      toast({
        title: "Could not copy invoice",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCloning(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteInvoice(deleteTarget.id);
      if (res.success) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTarget.id));
        if (selectedInvoice?.id === deleteTarget.id) {
          setIsPdfDialogOpen(false);
          setSelectedInvoice(null);
        }
        toast({ title: "Invoice deleted", description: `${deleteTarget.invoiceNumber} has been deleted.` });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      } else {
        toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDialogStatusChange = (newStatus: InvoiceStatus) => {
    if (selectedInvoice) {
      handleStatusChange(selectedInvoice.id, newStatus);
    }
  };

  const handleApplyDateRange = () => {
    setCustomDateRange(tempDateRange);
    setIsCustomDatePopoverOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsCustomDatePopoverOpen(open);
    if (open) {
      setTempDateRange(customDateRange);
    }
  };

  const parseDate = (dateStr: string) => {
    return parse(dateStr, "dd/MM/yyyy", new Date());
  };


  const currency = COUNTRY_CURRENCY[orgCountry] || "USD";

  const pageStart = pagination.total === 0 ? 0 : pagination.offset + 1;
  const pageEnd = Math.min(pagination.offset + pagination.limit, pagination.total);
  const hasPrevPage = pagination.offset > 0;
  const hasNextPage = pageEnd < pagination.total;
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const goToPage = (page: number) => setOffset((page - 1) * pagination.limit);

  // The org has invoices, or the user is searching and found none. Either way
  // the toolbar has to stay: hiding it on an empty result would take the search
  // box away with it, leaving no way to clear the term.
  // invoices.length is the fallback: an older backend returns rows but no
  // counts, and without this the page would claim there are no invoices while
  // holding a list of them.
  const hasInvoicesInScope = counts.all + counts.draft > 0 || invoices.length > 0;

  // Once the org is known to have invoices, the toolbar stays for the rest of
  // the session. Both of the other conditions are read from the last response,
  // so clearing a search that matched nothing would see them as "no invoices at
  // all" for one render and unmount the search box mid-edit.
  const everHadInvoices = useRef(false);
  if (counts.all + counts.draft > 0) everHadInvoices.current = true;

  const showList = everHadInvoices.current || hasInvoicesInScope || searchTerm !== "";

  // Straight from the server, which computed these over the whole filtered set.
  // Deriving them from `invoices` would now describe only the visible page.
  const summaryStats = useMemo(() => {
    const incomeByCurrencyEntries: [string, number][] = totals.byCurrency.map(
      (c) => [c.currency, c.total],
    );

    return {
      incomeByCurrencyEntries,
      totalIncome: totals.byCurrency.reduce((sum, c) => sum + c.total, 0),
      totalPaid: totals.byCurrency.reduce((sum, c) => sum + c.paid, 0),
      totalUnpaid: totals.byCurrency.reduce((sum, c) => sum + c.unpaid, 0),
      invoiceCount: totals.invoiceCount,
      topClient: totals.topClient,
    };
  }, [totals]);

  const toggleClientFilter = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  };

  const clearAllFilters = () => {
    setTimeRangePreset("all");
    setCustomDateRange(undefined);
    setTempDateRange(undefined);
    setSelectedClientIds([]);
  };

  // Drives the count on the trigger, so the button says whether anything is
  // filtered without having to open it.
  const activeFilterCount =
    (timeRangePreset !== "all" ? 1 : 0) + (selectedClientIds.length > 0 ? 1 : 0);

  const handleTimeRangeChange = (value: TimeRangePreset) => {
    setTimeRangePreset(value);
    if (value === "custom") {
      // Delay opening popover to avoid conflict with Select dropdown closing
      setTimeout(() => {
        setIsCustomDatePopoverOpen(true);
      }, 100);
    } else {
      setCustomDateRange(undefined);
    }
  };

  // Draft sits last: it is the only tab that is not real income.
  const tabs = [
    { value: "all", label: "All active" },
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
    { value: "draft", label: "Draft" },
  ];


  return (
    <DashboardScreen module="income">
      <Box className="gap-6">
        <Box className="flex-row items-center justify-between">
          <Box className="flex-1">
            <Txt className="text-3xl font-display font-bold">Invoices</Txt>
            <Txt className="text-muted-foreground mt-1">Track and manage your income.</Txt>
          </Box>
          <Box className="flex-row items-center gap-2">
            <Button variant="outline" size="icon" accessibilityLabel="Manage Clients" onPress={() => router.push("/sme/income/clients" as never)}>
              <Icon as={Users} className="h-4 w-4" />
            </Button>
            {canWriteIncome && <CreateInvoiceDialog onInvoiceCreated={loadInvoices} />}
            {canWriteIncome && editDraftId && (
              <CreateInvoiceDialog
                editInvoiceId={editDraftId}
                editOpen={editDraftOpen}
                onEditOpenChange={(open) => {
                  setEditDraftOpen(open);
                  if (!open) setEditDraftId(null);
                }}
                onInvoiceCreated={loadInvoices}
              />
            )}
            {canWriteIncome && reshareSourceId && (
              <CreateInvoiceDialog
                prefillFromInvoiceId={reshareSourceId}
                prefillOpen={reshareOpen}
                onPrefillOpenChange={(open) => {
                  setReshareOpen(open);
                  if (!open) setReshareSourceId(null);
                }}
                onInvoiceCreated={loadInvoices}
              />
            )}
          </Box>
        </Box>

        <Box>
          {/* Tabs */}
          <Box className="border-b border-border">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {tabs.map((tab) => {
                const active = activeTab === tab.value;
                return (
                  <Press key={tab.value} activeOpacity={1} onPress={() => setActiveTab(tab.value)} className={`flex-row items-center gap-1.5 pt-1.5 pb-3 border-b-2 ${active ? "border-primary" : "border-transparent"}`}>
                    <Txt className={`text-sm font-medium ${active ? "" : "text-muted-foreground"}`}>{tab.label}</Txt>
                    <Box className="bg-muted rounded-full px-1 min-w-[16px] items-center">
                      <Txt className="text-[10px] leading-4 text-muted-foreground">{counts[tab.value as InvoiceTab] ?? 0}</Txt>
                    </Box>
                  </Press>
                );
              })}
            </ScrollView>
          </Box>

          {isLoading && !hasLoaded ? (
            <Box className="items-center justify-center h-32">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </Box>
          ) : showList ? (
            <>
              {/* Summary */}
              <Box className="rounded-lg border border-border bg-muted/20 p-4 mt-4 mb-4 gap-3">
                <Box className="gap-1">
                  <Box className="flex-row items-start gap-1.5">
                    <Txt className="text-sm text-muted-foreground">Total Income:</Txt>
                    <Box className="flex-1 flex-row flex-wrap items-center gap-x-2">
                      {summaryStats.incomeByCurrencyEntries.length > 0 ? (
                        summaryStats.incomeByCurrencyEntries.map(([cur, amt]) => (
                          <Txt key={cur} className="text-sm font-semibold">
                            {formatCurrencyVal(amt, cur)}
                          </Txt>
                        ))
                      ) : (
                        <Txt className="text-sm font-semibold">{formatCurrencyVal(0, currency)}</Txt>
                      )}
                    </Box>
                  </Box>
                  <Box className="flex-row items-center gap-1.5">
                    <Txt className="text-sm text-muted-foreground">Paid:</Txt>
                    <Txt className="text-sm font-semibold">{formatCurrencyVal(summaryStats.totalPaid, currency)}</Txt>
                  </Box>
                </Box>
                <Box className="gap-1">
                  <Box className="flex-row items-center gap-1.5">
                    <Txt className="text-sm text-muted-foreground">Outstanding:</Txt>
                    <Txt className="text-sm font-semibold">{formatCurrencyVal(summaryStats.totalUnpaid, currency)}</Txt>
                  </Box>
                  {summaryStats.topClient && (
                    <Box className="flex-row items-center gap-1.5">
                      <Txt className="text-sm text-muted-foreground">Top Client:</Txt>
                      <Txt numberOfLines={1} className="flex-1 text-sm font-semibold">
                        {summaryStats.topClient.name}
                      </Txt>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Search, sort, filters */}
              <Box className="gap-2 mb-2">
                <Box className="justify-center">
                  <Input value={searchInput} onChangeText={setSearchInput} placeholder="Search invoice number or client" className="h-8 pl-8 pr-8 text-sm" autoCapitalize="none" autoCorrect={false} />
                  <Box className="absolute left-2.5" pointerEvents="none">
                    <Icon as={Search} className="h-3.5 w-3.5 text-muted-foreground" />
                  </Box>
                  {!!searchInput && (
                    <Press accessibilityLabel="Clear search" onPress={() => setSearchInput("")} className="absolute right-2" hitSlop={8}>
                      <Icon as={X} className="h-3.5 w-3.5 text-muted-foreground" />
                    </Press>
                  )}
                </Box>
                <Box className="flex-row items-center gap-2">
                  <Select
                    value={sortOption}
                    onValueChange={(v) => setSortOption(v as SortOption)}
                    options={SORT_OPTIONS}
                    className="w-auto min-w-[100px] h-8"
                    renderValue={(opt) => (
                      <Box className="flex-row items-center">
                        <Icon as={ArrowUpDown} className="mr-1.5 h-3.5 w-3.5" />
                        <Txt className="text-sm">{opt?.label ?? "Sort by"}</Txt>
                      </Box>
                    )}
                  />
                  <Popover
                    open={isFiltersOpen}
                    onOpenChange={setIsFiltersOpen}
                    align="end"
                    className="w-80 p-0"
                    trigger={({ ref, toggle }) => (
                      <Button ref={ref} variant="outline" size="sm" className="h-8" onPress={toggle}>
                        <Icon as={SlidersHorizontal} className="mr-1.5 h-3.5 w-3.5" />
                        Filters
                        {activeFilterCount > 0 && (
                          <Box className="ml-1.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 px-1">
                            <Txt className="text-[10px] leading-4 font-medium text-primary">{activeFilterCount}</Txt>
                          </Box>
                        )}
                      </Button>
                    )}
                  >
                    <Box className="flex-row items-center justify-between px-4 py-3 border-b border-border">
                      <Txt className="text-sm font-medium">Filters</Txt>
                      {activeFilterCount > 0 && (
                        <Press onPress={clearAllFilters} hitSlop={8}>
                          <Txt className="text-xs text-muted-foreground">Clear all</Txt>
                        </Press>
                      )}
                    </Box>
                    <Box className="px-4 py-3 gap-2 border-b border-border">
                      <Label className="text-xs text-muted-foreground">Due date</Label>
                      <Select
                        value={timeRangePreset}
                        onValueChange={(v) => handleTimeRangeChange(v as TimeRangePreset)}
                        options={TIME_RANGE_OPTIONS}
                        className="h-7 px-2.5 border-border/70"
                        renderValue={(opt) => (
                          <Box className="flex-1 flex-row items-center gap-1.5">
                            <Icon as={CalendarIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                            <Txt className="text-xs">{opt?.label ?? "All Time"}</Txt>
                          </Box>
                        )}
                      />
                      {timeRangePreset === "custom" && (
                        <Popover
                          open={isCustomDatePopoverOpen}
                          onOpenChange={handleOpenChange}
                          align="start"
                          className="p-0"
                          trigger={({ ref, toggle }) => (
                            <Button ref={ref} variant="outline" size="sm" className="h-7 w-full justify-start px-2.5 border-border/70" textClassName="text-xs font-normal" onPress={toggle}>
                              <Icon as={CalendarIcon} className="mr-1.5 h-3.5 w-3.5" />
                              {customDateRange?.from
                                ? customDateRange.to
                                  ? `${format(customDateRange.from, "dd/MM/yy")} - ${format(customDateRange.to, "dd/MM/yy")}`
                                  : format(customDateRange.from, "dd/MM/yy")
                                : "Pick range"}
                            </Button>
                          )}
                        >
                          <Calendar mode="range" selected={tempDateRange} onSelect={setTempDateRange} numberOfMonths={1} />
                          <Box className="flex-row justify-end p-3 pt-0 border-t border-border">
                            <Button size="sm" onPress={handleApplyDateRange} disabled={!tempDateRange?.from}>
                              Apply
                            </Button>
                          </Box>
                        </Popover>
                      )}
                    </Box>
                    <Box className="px-4 py-3 gap-2">
                      <Box className="flex-row items-center justify-between">
                        <Label tight className="text-xs text-muted-foreground">Client</Label>
                        {selectedClientIds.length > 0 && (
                          <Press onPress={() => setSelectedClientIds([])} hitSlop={8}>
                            <Txt className="text-xs text-muted-foreground">Clear</Txt>
                          </Press>
                        )}
                      </Box>
                      {clientsData.length === 0 ? (
                        <Txt className="text-xs text-muted-foreground py-1">No clients yet.</Txt>
                      ) : (
                        <ScrollView style={{ maxHeight: 192 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {clientsData.map((client) => {
                            const selected = selectedClientIds.includes(client.id);
                            return (
                              <Press
                                key={client.id}
                                accessibilityState={{ selected }}
                                onPress={() => toggleClientFilter(client.id)}
                                className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${selected ? "border-primary/20 bg-primary/10" : "border-border"}`}
                              >
                                <Txt className={`text-xs ${selected ? "text-primary" : "text-muted-foreground"}`}>{client.name}</Txt>
                                {selected && <Icon as={X} className="h-3 w-3 text-primary" />}
                              </Press>
                            );
                          })}
                        </ScrollView>
                      )}
                    </Box>
                  </Popover>
                </Box>
              </Box>

              {/* List */}
              <Box className="mt-4">
                <Box className={`bg-card rounded-lg border border-border overflow-hidden ${isLoading ? "opacity-50" : ""}`}>
                  {invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        isLast={false}
                        onClick={() => handleInvoiceClick(invoice)}
                        onStatusChange={handleStatusChange}
                        onProgressStatusChange={handleProgressStatusChange}
                        onDownload={handleDownloadPdf}
                        onClone={(inv) => setCloneTarget({ invoice: inv, idempotencyKey: randomUUID() })}
                        onEditReshare={(inv) => {
                          setReshareSourceId(inv.id);
                          setReshareOpen(true);
                        }}
                        onDelete={(inv) => setDeleteTarget(inv)}
                      />
                    ))
                  ) : (
                    <Box className="items-center justify-center h-32">
                      <Txt className="text-muted-foreground">No invoices found</Txt>
                    </Box>
                  )}
                </Box>

                {pagination.total > 0 && (
                  <Box className="flex-row flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                    {totalPages > 1 && (
                      <Box className="flex-row items-center gap-1.5">
                        <Press accessibilityLabel="Previous page" disabled={!hasPrevPage || isLoading} onPress={() => goToPage(currentPage - 1)} className={`h-8 w-8 items-center justify-center rounded-lg ${!hasPrevPage || isLoading ? "opacity-40" : ""}`}>
                          <Icon as={ChevronLeft} className="h-4 w-4 text-muted-foreground/70" />
                        </Press>
                        {buildPageItems(currentPage, totalPages).map((page, i) =>
                          page === null ? (
                            <Box key={`gap-${i}`} className="h-8 w-8 items-center justify-center">
                              <Txt className="text-xs text-muted-foreground">…</Txt>
                            </Box>
                          ) : (
                            <Press
                              key={page}
                              accessibilityLabel={`Page ${page}`}
                              disabled={isLoading}
                              onPress={() => goToPage(page)}
                              className={`h-8 w-8 items-center justify-center rounded-lg border ${page === currentPage ? "border-primary/20 bg-primary/10" : "border-transparent"} ${isLoading ? "opacity-60" : ""}`}
                            >
                              <Txt className={`text-sm font-medium ${page === currentPage ? "text-primary" : "text-muted-foreground"}`}>{page}</Txt>
                            </Press>
                          ),
                        )}
                        <Press accessibilityLabel="Next page" disabled={!hasNextPage || isLoading} onPress={() => goToPage(currentPage + 1)} className={`h-8 w-8 items-center justify-center rounded-lg ${!hasNextPage || isLoading ? "opacity-40" : ""}`}>
                          <Icon as={ChevronRight} className="h-4 w-4 text-muted-foreground/70" />
                        </Press>
                      </Box>
                    )}
                    <Txt className="text-xs text-muted-foreground">
                      Showing {pageStart}–{pageEnd} of {pagination.total}
                    </Txt>
                  </Box>
                )}
              </Box>
            </>
          ) : (
            <Box className="items-center justify-center h-32">
              <Txt className="text-muted-foreground">No invoices found</Txt>
            </Box>
          )}
        </Box>
      </Box>

      {/* Invoice preview */}
      <Dialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen} className="max-w-4xl" heightRatio={0.85}>
        <Box className="flex-1 p-6 gap-4">
          {/* The web header puts title, status and download in one row, which overflows on a phone; it is stacked here. */}
          <Box className="gap-3 pr-8">
            <Box>
              <Txt className="font-display text-lg leading-6 font-semibold tracking-tight">
                {selectedInvoice?.invoiceNumber} - {selectedInvoice?.clientName}
              </Txt>
              {selectedInvoice && selectedInvoice.status !== "draft" && (
                <InvoiceEmailStatus
                  invoiceId={selectedInvoice.id}
                  emailStatus={selectedInvoice.emailStatus}
                  emailRequested={selectedInvoice.emailRequested}
                  emailSentAt={selectedInvoice.emailSentAt}
                  emailError={selectedInvoice.emailError}
                  pdfReady={selectedInvoice.pdfStatus === "READY"}
                />
              )}
            </Box>
            {selectedInvoice?.status !== "draft" && (
              <Box className="flex-row items-center gap-2">
                <Select
                  value={selectedInvoice?.status}
                  onValueChange={(v) => handleDialogStatusChange(v as InvoiceStatus)}
                  options={[
                    { value: "paid", label: "Paid" },
                    { value: "unpaid", label: "Unpaid" },
                    { value: "overdue", label: "Overdue" },
                  ]}
                  className="w-[120px] h-8"
                />
                <Button variant="outline" size="sm" onPress={() => handleDownloadPdf()}>
                  <Icon as={Download} className="h-4 w-4 mr-1.5" />
                  Download
                </Button>
              </Box>
            )}
          </Box>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            {selectedInvoice && previewFormData ? (
              <Box className="px-4 py-6 bg-muted/30">
                <InvoicePreviewWrapper formData={previewFormData} />
              </Box>
            ) : selectedInvoice ? (
              <Box className="flex-1 items-center justify-center">
                <Spinner className="h-6 w-6 text-muted-foreground" />
              </Box>
            ) : null}
          </ScrollView>
        </Box>
      </Dialog>

      <AlertDialog open={!!cloneTarget} onOpenChange={(open) => !open && setCloneTarget(null)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Clone as Draft</AlertDialogTitle>
          <AlertDialogDescription>Do you want to make a copy of invoice {cloneTarget?.invoice.invoiceNumber} as a Draft?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cloning} onPress={() => setCloneTarget(null)}>
            No
          </AlertDialogCancel>
          <AlertDialogAction disabled={cloning} onPress={handleCloneInvoice}>
            {cloning ? "Copying..." : "Yes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete invoice {deleteTarget?.invoiceNumber}? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onPress={handleDeleteInvoice}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </DashboardScreen>
  );
};

export default Income;
