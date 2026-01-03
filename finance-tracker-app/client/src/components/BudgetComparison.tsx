import { Card, CardHeader, CardTitle, CardContent } from "../components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import { Budget, Transaction } from "../lib/api";
import { formatCurrency } from "../lib/utils";

interface BudgetComparisonProps {
  budgets: Budget[];
  transactions: Transaction[];
  isLoading: boolean;
}

const MOCK_DATA = {
  months: [
    { year: 2024, month: 5, label: 'May 2024' },
    { year: 2024, month: 6, label: 'June 2024' },
    { year: 2024, month: 7, label: 'July 2024' },
    { year: 2024, month: 8, label: 'August 2024' },
    { year: 2024, month: 9, label: 'September 2024' },
    { year: 2024, month: 10, label: 'October 2024' },
    { year: 2024, month: 11, label: 'November 2024' },
    { year: 2024, month: 12, label: 'December 2024' },
  ] as const,
  categories: [
    { name: 'Income', budget: 16500.00, type: 'income' },
    { name: 'Mortgage', budget: 3564.65, type: 'expense' },
    { name: 'Utilities', budget: 435.00, type: 'expense' },
    { name: 'Transportation', budget: 1110.00, type: 'expense' },
    { name: 'Subscriptions', budget: 41.97, type: 'expense' },
    { name: 'Education', budget: 3850.83, type: 'expense' },
    { name: 'Food & Dining', budget: 1800.00, type: 'expense' },
    { name: 'Personal', budget: 1500.00, type: 'expense' },
    { name: 'Charity', budget: 600.00, type: 'expense' },
  ],
  actuals: {
    'May 2024': {
      'Income': 18270.47,
      'Mortgage': 3612.12,
      'Utilities': 259.83,
      'Transportation': 725.15,
      'Subscriptions': 30.48,
      'Education': 3799.50,
      'Food & Dining': 1816.50,
      'Personal': 1425.40,
      'Charity': 821.28,
    },
  } as Record<string, Record<string, number>>
};

export default function BudgetComparison({ budgets, transactions, isLoading }: BudgetComparisonProps) {
  void budgets;
  void transactions;
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>Budget Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-gray-100 rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Comparison</CardTitle>
      </CardHeader>
      <CardContent className="p-0"> {/* Remove padding to allow table to extend to edges */}
        <div className="overflow-x-auto">
          <Table className="w-full border-collapse">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-muted/0 [&>th]:p-0">
                <TableHead className="w-[200px] min-w-[200px] border border-border bg-muted font-semibold p-2">
                  <div className="px-3 py-2">Category</div>
                </TableHead>
                <TableHead className="text-right border border-border bg-muted font-semibold w-[150px] min-w-[150px] p-2">
                  <div className="px-3 py-2">Budget</div>
                </TableHead>
                {MOCK_DATA.months.map((month) => (
                  <TableHead
                    key={`${month.year}-${month.month}`}
                    className="text-right border border-border bg-muted font-semibold w-[150px] min-w-[150px] p-2"
                  >
                    <div className="px-3 py-2">{month.label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_DATA.categories.map((category, rowIndex) => {
                const isIncome = category.type === 'income';
                const isLastRow = rowIndex === MOCK_DATA.categories.length - 1;

                return (
                  <TableRow
                    key={category.name}
                    className={`
                      hover:bg-muted/50 transition-colors
                      ${isLastRow ? 'border-b border-border' : ''}
                    `}
                  >
                    <TableCell className="font-medium border border-border p-0">
                      <div className="px-3 py-2">{category.name}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono border border-border p-0">
                      <div className="px-3 py-2">{formatCurrency(category.budget)}</div>
                    </TableCell>
                    {MOCK_DATA.months.map((month) => {
                      const actual = MOCK_DATA.actuals[month.label]?.[category.name] || 0;
                      const variance = isIncome
                        ? actual - category.budget
                        : category.budget - actual;
                      const isPositive = isIncome ? variance >= 0 : variance >= 0;

                      return (
                        <TableCell
                          key={`${category.name}-${month.label}`}
                          className="text-right font-mono border border-border p-0"
                        >
                          <div
                            className={`px-3 py-2 ${
                              isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {formatCurrency(actual)}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
