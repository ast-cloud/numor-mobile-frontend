import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, DollarSign, FileText, Pencil, Plus, TrendingDown, TrendingUp, X } from "lucide-react-native";
import { DashboardScreen } from "@/components/DashboardScreen";
import {
  Box,
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateRange,
  Icon,
  Popover,
  Popper,
  Press,
  Select,
  Skeleton,
  Txt,
  ViewRef,
} from "@/components/ui";
import {
  CashFlowWidget,
  ExpensesByCategoryWidget,
  ExpensesOverTimeWidget,
  IncomeVsExpensesWidget,
  PaymentStatusWidget,
  RevenueOverTimeWidget,
  TimeRangeConfig,
  TopClientsWidget,
  WIDGET_KEY_MAP,
  WidgetType,
  availableWidgets,
} from "@/components/dashboard/widgets";
import {
  computeStats,
  filterExpenses,
  filterInvoices,
  processCashFlow,
  processExpensesByCategory,
  processExpensesOverTime,
  processIncomeVsExpenses,
  processPaymentStatus,
  processRevenueOverTime,
  processTopClients,
} from "@/components/dashboard/widgets/widgetDataProcessors";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, useDashboardData } from "@/hooks/use-dashboard-data";
import { toast } from "@/hooks/use-toast";
import { fetchCurrentUser, saveUserWidgets } from "@/lib/api/user";
import React from "react";

type TimeRangePreset = "all" | "today" | "this_week" | "this_month" | "this_quarter" | "custom";

const TIME_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "custom", label: "Custom Range" },
];

function AddWidgetMenu({ items, onAdd }: { items: typeof availableWidgets; onAdd: (t: WidgetType) => void }) {
  const ref = React.useRef<ViewRef>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button ref={ref} variant="outline" size="sm" className="gap-2 h-7" textClassName="text-xs" onPress={() => setOpen(true)}>
        <Icon as={Plus} className="h-3 w-3" />
        Add Widget
      </Button>
      <Popper open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" className="w-64 p-1 shadow-lg">
        {items.map((widget) => (
          <Press
            key={widget.id}
            activeClassName="bg-accent/15"
            className="items-start gap-1 rounded-sm px-2 py-2"
            onPress={() => {
              setOpen(false);
              onAdd(widget.type);
            }}
          >
            <Txt className="text-sm font-medium">{widget.title}</Txt>
            <Txt className="text-xs text-muted-foreground">{widget.description}</Txt>
          </Press>
        ))}
      </Popper>
    </>
  );
}

const DashboardHome = () => {
  const { can } = useAuth();
  const canEditDashboard = can("dashboard", "write");
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>("this_month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [isCustomDatePopoverOpen, setIsCustomDatePopoverOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<WidgetType[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const user = await fetchCurrentUser();
        const keys: string[] = Array.isArray(user?.widgets) ? user.widgets : [];
        const reverseMap = Object.fromEntries(Object.entries(WIDGET_KEY_MAP).map(([k, v]) => [v, k])) as Record<string, WidgetType>;
        setActiveWidgets(keys.map((k) => reverseMap[k]).filter(Boolean) as WidgetType[]);
      } catch {
        // ignore
      }
    })();
  }, []);

  const { expenses, invoices, clients, country, isLoading } = useDashboardData();

  const timeRangeConfig: TimeRangeConfig = { preset: timeRangePreset, customRange: customDateRange };

  /* eslint-disable react-hooks/exhaustive-deps */
  const filteredExpenses = useMemo(() => filterExpenses(expenses, timeRangeConfig), [expenses, timeRangePreset, customDateRange]);
  const filteredInvoices = useMemo(() => filterInvoices(invoices, timeRangeConfig), [invoices, timeRangePreset, customDateRange]);
  const stats = useMemo(
    () => computeStats(filteredExpenses, filteredInvoices, expenses, invoices, timeRangeConfig),
    [filteredExpenses, filteredInvoices, expenses, invoices, timeRangePreset, customDateRange],
  );
  const widgetData = useMemo(
    () => ({
      revenueOverTime: processRevenueOverTime(filteredInvoices, timeRangeConfig),
      expensesOverTime: processExpensesOverTime(filteredExpenses, timeRangeConfig),
      expensesByCategory: processExpensesByCategory(filteredExpenses),
      incomeVsExpenses: processIncomeVsExpenses(filteredInvoices, filteredExpenses, timeRangeConfig),
      cashFlow: processCashFlow(filteredInvoices, filteredExpenses, timeRangeConfig),
      topClients: processTopClients(filteredInvoices, clients),
      paymentStatus: processPaymentStatus(filteredInvoices),
    }),
    [filteredExpenses, filteredInvoices, clients, timeRangePreset, customDateRange],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleTimeRangeChange = (value: TimeRangePreset) => {
    setTimeRangePreset(value);
    if (value === "custom") {
      setTimeout(() => handleOpenChange(true), 100);
    } else {
      setCustomDateRange(undefined);
    }
  };

  const handleApplyDateRange = () => {
    setCustomDateRange(tempDateRange);
    setIsCustomDatePopoverOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsCustomDatePopoverOpen(open);
    if (open) setTempDateRange(customDateRange);
  };

  const clearDateFilter = () => {
    setTimeRangePreset("this_month");
    setCustomDateRange(undefined);
  };

  const handleAddWidget = (widgetType: WidgetType) => {
    if (!activeWidgets.includes(widgetType)) setActiveWidgets([...activeWidgets, widgetType]);
  };

  const handleRemoveWidget = (widgetType: WidgetType) => setActiveWidgets(activeWidgets.filter((w) => w !== widgetType));

  const formatVal = (amount: number) => formatCurrency(amount, country);

  const changeLabel = (preset: TimeRangePreset) => {
    switch (preset) {
      case "today":
        return "vs yesterday";
      case "this_week":
        return "vs last week";
      case "this_month":
        return "vs last month";
      case "this_quarter":
        return "vs last quarter";
      default:
        return "";
    }
  };

  const pct = (v: number | null) => (v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : null);
  const statCards = [
    { title: "Total Revenue", value: formatVal(stats.totalRevenue), change: pct(stats.revenueChange), trend: (stats.revenueChange ?? 0) >= 0 ? "up" : "down", icon: DollarSign },
    { title: "Expenses", value: formatVal(stats.totalExpenses), change: pct(stats.expensesChange), trend: (stats.expensesChange ?? 0) >= 0 ? "up" : "down", icon: TrendingDown },
    { title: "Net Income", value: formatVal(stats.netIncome), change: pct(stats.netIncomeChange), trend: (stats.netIncomeChange ?? 0) >= 0 ? "up" : "down", icon: TrendingUp },
    {
      title: "Pending Invoices",
      value: String(stats.pendingInvoices),
      change: stats.pendingChange !== null ? `${stats.pendingChange >= 0 ? "+" : ""}${stats.pendingChange}` : null,
      trend: (stats.pendingChange ?? 0) <= 0 ? "up" : "down",
      icon: FileText,
    },
  ];

  const renderWidget = (type: WidgetType) => {
    const baseProps = { onRemove: () => handleRemoveWidget(type), isEditMode, country };
    switch (type) {
      case "expenses-by-category":
        return <ExpensesByCategoryWidget key={type} {...baseProps} data={widgetData.expensesByCategory} />;
      case "revenue-over-time":
        return <RevenueOverTimeWidget key={type} {...baseProps} data={widgetData.revenueOverTime} />;
      case "income-vs-expenses":
        return <IncomeVsExpensesWidget key={type} {...baseProps} data={widgetData.incomeVsExpenses} />;
      case "cash-flow":
        return <CashFlowWidget key={type} {...baseProps} data={widgetData.cashFlow} />;
      case "top-clients":
        return <TopClientsWidget key={type} {...baseProps} data={widgetData.topClients} />;
      case "payment-status":
        return <PaymentStatusWidget key={type} {...baseProps} data={widgetData.paymentStatus} />;
      case "expenses-over-time":
        return <ExpensesOverTimeWidget key={type} {...baseProps} data={widgetData.expensesOverTime} />;
      default:
        return null;
    }
  };

  const availableToAdd = availableWidgets.filter((widget) => !activeWidgets.includes(widget.type));

  return (
    <DashboardScreen module="dashboard">
      <Box className="gap-8">
        <Box className="flex-row items-start justify-between">
          <Box className="flex-1">
            <Txt className="text-3xl font-display font-bold">Dashboard</Txt>
            <Txt className="text-muted-foreground mt-1">Welcome back! Here's your financial overview.</Txt>
          </Box>
          <Box className="flex-row items-center gap-2">
            <Box className="gap-2 items-end">
              <Select
                value={timeRangePreset}
                onValueChange={(v) => handleTimeRangeChange(v as TimeRangePreset)}
                options={TIME_RANGE_OPTIONS}
                className="w-auto min-w-[140px] h-8"
                renderValue={(opt) => (
                  <Box className="flex-1 flex-row items-center">
                    <Icon as={CalendarIcon} className="mr-1.5 h-3.5 w-3.5" />
                    <Txt className="text-sm">{opt?.label ?? "This Month"}</Txt>
                  </Box>
                )}
              />
              {timeRangePreset === "custom" && (
                <Popover
                  open={isCustomDatePopoverOpen}
                  onOpenChange={handleOpenChange}
                  align="end"
                  className="p-0"
                  trigger={({ ref, toggle }) => (
                    <Button ref={ref} variant="outline" size="sm" className="h-8 justify-start" textClassName="font-normal" onPress={toggle}>
                      <Icon as={CalendarIcon} className="h-3.5 w-3.5" />
                      {customDateRange?.from
                        ? customDateRange.to
                          ? `${format(customDateRange.from, "dd/MM/yy")} - ${format(customDateRange.to, "dd/MM/yy")}`
                          : format(customDateRange.from, "dd/MM/yy")
                        : "Pick range"}
                    </Button>
                  )}
                >
                  <Calendar mode="range" selected={tempDateRange} onSelect={setTempDateRange} defaultMonth={tempDateRange?.from} />
                  <Box className="flex-row justify-end p-3 border-t border-border">
                    <Button size="sm" onPress={handleApplyDateRange} disabled={!tempDateRange?.from}>
                      Apply
                    </Button>
                  </Box>
                </Popover>
              )}
            </Box>
            {timeRangePreset !== "this_month" && (
              <Button variant="ghost" size="icon" onPress={clearDateFilter} className="h-8 w-8" accessibilityLabel="Clear date filter">
                <Icon as={X} className="h-3.5 w-3.5" />
              </Button>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Box className="gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 mt-1.5 rounded" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-28 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))
            : statCards.map((stat) => (
                <Card key={stat.title}>
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                    <Icon as={stat.icon} className="w-4 h-4 mt-1.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <Txt className="text-2xl font-bold">{stat.value}</Txt>
                    {stat.change && (
                      <Txt className={`text-xs mt-1 ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                        {stat.change} {changeLabel(timeRangePreset)}
                      </Txt>
                    )}
                  </CardContent>
                </Card>
              ))}
        </Box>

        {/* Edit mode controls */}
        {canEditDashboard && (
          <Box className="flex-row items-center justify-end gap-2">
            {isEditMode && availableToAdd.length > 0 && <AddWidgetMenu items={availableToAdd} onAdd={handleAddWidget} />}
            <Button
              variant={isEditMode ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 h-7"
              textClassName="text-xs"
              onPress={async () => {
                if (isEditMode) {
                  const keys = activeWidgets.map((t) => WIDGET_KEY_MAP[t]).filter(Boolean);
                  try {
                    await saveUserWidgets(keys);
                  } catch {
                    toast({ title: "Failed to save widgets", variant: "destructive" });
                  }
                }
                setIsEditMode(!isEditMode);
              }}
            >
              <Icon as={isEditMode ? Check : Pencil} className="h-3 w-3" />
              {isEditMode ? "Done" : "Edit"}
            </Button>
          </Box>
        )}

        {/* Widgets */}
        <Box className={`gap-6 ${isEditMode ? "border-2 border-dashed border-primary/20 p-4 rounded-lg bg-primary/5" : ""}`}>
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="h-80">
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </CardHeader>
                <CardContent className="h-56">
                  <Skeleton className="h-full w-full rounded" />
                </CardContent>
              </Card>
            ))
          ) : activeWidgets.length === 0 ? (
            <Box className="items-center justify-center h-40">
              <Txt className="text-muted-foreground">No widgets added yet.</Txt>
              {canEditDashboard && <Txt className="text-sm text-muted-foreground">Click "Add Widget" to get started.</Txt>}
            </Box>
          ) : (
            activeWidgets.map((widgetType) => renderWidget(widgetType))
          )}
        </Box>
      </Box>
    </DashboardScreen>
  );
};

export default DashboardHome;
