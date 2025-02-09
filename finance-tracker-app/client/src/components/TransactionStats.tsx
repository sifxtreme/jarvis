import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "../lib/utils";
import { Transaction, Budget } from "../lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface TransactionStatsProps {
  transactions: Transaction[];
  budgets: Budget[];
  isLoading: boolean;
}

const COLORS = [
  'hsl(212, 72%, 45%)',
  'hsl(212, 72%, 35%)',
  'hsl(212, 72%, 25%)',
  'hsl(212, 72%, 15%)',
  'hsl(212, 50%, 45%)',
  'hsl(212, 50%, 35%)',
  'hsl(212, 50%, 25%)',
  'hsl(212, 50%, 15%)',
];

export default function TransactionStats({ transactions, budgets, isLoading }: TransactionStatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Card className="animate-pulse">
          <CardHeader className="py-2 px-3">
            <div className="h-3 w-1/2 bg-gray-200 rounded" />
            <div className="h-5 w-3/4 bg-gray-300 rounded mt-1" />
          </CardHeader>
        </Card>

        <Card className="animate-pulse">
          <CardContent className="py-2">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-1/3 bg-gray-200 rounded" />
                  <div className="h-2 w-full bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSpent = transactions
    .filter(t => !String(t.category || 'uncategorized').toLowerCase().includes('income'))
    .reduce((sum, t) => sum + t.amount, 0);

  // Group transactions by category and calculate total per category
  const categoryTotals = transactions.reduce((acc, t) => {
    // Skip if category contains 'Income'
    const category = t.category || 'Uncategorized';
    if (category.toLowerCase().includes('income')) return acc;

    acc[category] = (acc[category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  // Sort categories by amount and calculate percentages
  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / totalSpent) * 100
    }));

  // Prepare data for pie chart
  const pieData = sortedCategories.slice(0, 8).map((item, index) => ({
    name: item.category,
    value: item.amount,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {/* Total Spent Card */}
        <Card className="bg-primary/5">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs text-gray-500">
              Total Spent
            </CardTitle>
            <div className="text-lg font-bold text-primary">
              {formatCurrency(totalSpent)}
            </div>
          </CardHeader>
        </Card>

        {/* Spending Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown with Progress Bars */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Category Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedCategories.map(({ category, amount, percentage }, index) => (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{category}</span>
                  <span className="font-mono">{formatCurrency(amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={percentage}
                    className={cn(
                      "h-2",
                      index < COLORS.length ? `bg-primary/20` : "bg-gray-100"
                    )}
                    // Apply color directly to the indicator through the class name
                    style={{
                      "--progress-color": index < COLORS.length ? COLORS[index] : "rgb(209 213 219)"
                    } as React.CSSProperties}
                  />
                  <span className="text-xs text-gray-500 w-12">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}