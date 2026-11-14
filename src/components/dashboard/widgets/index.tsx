import React from "react";
import { X } from "lucide-react-native";
import { Box, Button, Card, CardContent, CardHeader, CardTitle, Icon, Txt } from "@/components/ui";
import { CartesianChart, HorizontalBarChart, PieChartView, Series } from "@/components/ui/charts";
import { formatCurrency } from "@/hooks/use-dashboard-data";
import type { CategoryData, PeriodData, StatusData, TopClientData } from "./widgetDataProcessors";

export type { TimeRangeConfig, TimeRangePreset } from "./widgetData";

export const WIDGET_KEY_MAP: Record<string, string> = {
  "revenue-over-time": "revenue_vs_time",
  "expenses-over-time": "expense_vs_time",
  "cash-flow": "cashflow_vs_time",
  "income-vs-expenses": "income_expense_vs_time",
  "top-clients": "client_vs_revenue",
  "payment-status": "invoice_status_wise_breakdown",
  "expenses-by-category": "expense_category_wise_breakdown",
};

export type WidgetType =
  | "expenses-by-category"
  | "revenue-over-time"
  | "income-vs-expenses"
  | "cash-flow"
  | "top-clients"
  | "payment-status"
  | "expenses-over-time";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
}

export const availableWidgets: WidgetConfig[] = [
  { id: "expenses-by-category", type: "expenses-by-category", title: "Expenses by Category", description: "Pie chart showing expense distribution" },
  { id: "revenue-over-time", type: "revenue-over-time", title: "Revenue Over Time", description: "Line chart of revenue trends" },
  { id: "income-vs-expenses", type: "income-vs-expenses", title: "Income vs Expenses", description: "Bar chart comparing income and expenses" },
  { id: "cash-flow", type: "cash-flow", title: "Cash Flow", description: "Area chart showing cash flow over time" },
  { id: "top-clients", type: "top-clients", title: "Top Clients", description: "Horizontal bar chart of top clients by revenue" },
  { id: "payment-status", type: "payment-status", title: "Invoice Status", description: "Pie chart of invoice payment statuses" },
  { id: "expenses-over-time", type: "expenses-over-time", title: "Expenses Over Time", description: "Area chart showing expense trends" },
];

interface BaseProps {
  onRemove: () => void;
  isEditMode: boolean;
  country: string;
}

function WidgetCard({
  title,
  subtitle,
  empty,
  emptyText,
  onRemove,
  isEditMode,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyText: string;
  onRemove: () => void;
  isEditMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Txt className="text-xs text-muted-foreground">{subtitle}</Txt>
      </CardHeader>
      <CardContent className="h-56">
        {empty ? (
          <Box className="flex-1 items-center justify-center">
            <Txt className="text-sm text-muted-foreground">{emptyText}</Txt>
          </Box>
        ) : (
          children
        )}
      </CardContent>
      {isEditMode && (
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onPress={onRemove} accessibilityLabel={`Remove ${title}`}>
          <Icon as={X} className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

const single = (key: string, label: string, color: string, type: Series["type"], fill?: string): Series[] => [{ key, label, color, type, fill }];

export const RevenueOverTimeWidget = ({ data, country, ...p }: BaseProps & { data: PeriodData[] }) => (
  <WidgetCard title="Revenue Over Time" subtitle="Track your revenue trends" empty={data.length === 0} emptyText="No invoice data for this period" {...p}>
    <CartesianChart data={data} xKey="period" formatY={(v) => formatCurrency(v, country)} series={single("revenue", "Revenue", "#6366f1", "line")} />
  </WidgetCard>
);

export const ExpensesOverTimeWidget = ({ data, country, ...p }: BaseProps & { data: PeriodData[] }) => (
  <WidgetCard title="Expenses Over Time" subtitle="Track your spending trends" empty={data.length === 0} emptyText="No expense data for this period" {...p}>
    <CartesianChart data={data} xKey="period" formatY={(v) => formatCurrency(v, country)} series={single("expenses", "Expenses", "#f87171", "area", "rgba(248, 113, 113, 0.3)")} />
  </WidgetCard>
);

export const CashFlowWidget = ({ data, country, ...p }: BaseProps & { data: PeriodData[] }) => (
  <WidgetCard title="Cash Flow" subtitle="Monitor your net cash movement over time" empty={data.length === 0} emptyText="No data for this period" {...p}>
    <CartesianChart data={data} xKey="period" formatY={(v) => formatCurrency(v, country)} series={single("cashFlow", "Cash Flow", "#06b6d4", "area", "rgba(6, 182, 212, 0.3)")} />
  </WidgetCard>
);

export const IncomeVsExpensesWidget = ({ data, country, ...p }: BaseProps & { data: PeriodData[] }) => (
  <WidgetCard title="Income vs Expenses" subtitle="Compare earnings and spending" empty={data.length === 0} emptyText="No data for this period" {...p}>
    <CartesianChart
      data={data}
      xKey="period"
      showLegend
      formatY={(v) => formatCurrency(v, country)}
      series={[
        { key: "income", label: "income", color: "#4ade80", type: "bar" },
        { key: "expenses", label: "expenses", color: "#f87171", type: "bar" },
      ]}
    />
  </WidgetCard>
);

export const TopClientsWidget = ({ data, country, ...p }: BaseProps & { data: TopClientData[] }) => (
  <WidgetCard title="Top Clients by Revenue" subtitle="Your highest-earning client relationships" empty={data.length === 0} emptyText="No invoice data for this period" {...p}>
    <HorizontalBarChart data={data} labelKey="name" valueKey="revenue" color="#8b5cf6" formatX={(v) => formatCurrency(v, country)} />
  </WidgetCard>
);

export const ExpensesByCategoryWidget = ({ data, country, ...p }: BaseProps & { data: CategoryData[] }) => (
  <WidgetCard title="Expenses by Category" subtitle="See where your money is going" empty={data.length === 0} emptyText="No expense data for this period" {...p}>
    <PieChartView data={data} innerRadius={40} outerRadius={70} formatValue={(v) => formatCurrency(v, country)} valueLabel="Amount" />
  </WidgetCard>
);

export const PaymentStatusWidget = ({ data, ...p }: BaseProps & { data: StatusData[] }) => (
  <WidgetCard title="Invoice Status" subtitle="Breakdown of your invoice payment states" empty={data.length === 0} emptyText="No invoice data for this period" {...p}>
    <PieChartView data={data} outerRadius={70} showPercentLabels formatValue={(v) => `${v} invoices`} valueLabel="Count" />
  </WidgetCard>
);
