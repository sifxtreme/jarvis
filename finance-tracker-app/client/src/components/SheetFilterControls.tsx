import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TransactionFilters } from '../lib/api';
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SheetFilterControlsProps {
  onSearch: (filters: Partial<TransactionFilters>) => void;
  initialFilters?: TransactionFilters;
  className?: string;
}

export default function SheetFilterControls({ onSearch, initialFilters, className }: SheetFilterControlsProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filters, setFilters] = useState<TransactionFilters>({
    year: initialFilters?.year,
    month: initialFilters?.month,
    show_hidden: initialFilters?.show_hidden ?? false,
    show_needs_review: initialFilters?.show_needs_review ?? false,
    query: initialFilters?.query ?? ''
  });

  const handleFilterChange = (newFilters: Partial<TransactionFilters>) => {
    setFilters(current => ({
      ...current,
      ...newFilters
    }));
  };

  const handleSubmit = () => {
    onSearch(filters);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Input
          type="search"
          placeholder="Search..."
          className="w-full"
          value={filters.query ?? ''}
          onChange={(e) => handleFilterChange({ query: e.target.value })}
        />
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleFilterChange({
                year: (filters.year ?? currentYear) - 1
              })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              className="flex-1 font-medium"
              onClick={() => handleFilterChange({
                year: filters.year === undefined ? currentYear : undefined
              })}
            >
              {filters.year ?? 'All Years'}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleFilterChange({
                year: (filters.year ?? currentYear) + 1
              })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const m = filters.month ?? currentMonth;
                handleFilterChange({
                  month: m === 1 ? 12 : m - 1
                });
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              className="flex-1 font-medium"
              onClick={() => handleFilterChange({
                month: filters.month === undefined ? currentMonth : undefined
              })}
            >
              {filters.month !== undefined
                ? new Date(2000, filters.month - 1).toLocaleString('default', { month: 'long' })
                : 'All Months'}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const m = filters.month ?? currentMonth;
                handleFilterChange({
                  month: m === 12 ? 1 : m + 1
                });
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Show Hidden Transactions</Label>
            <Switch
              checked={filters.show_hidden}
              onCheckedChange={(checked) => handleFilterChange({ show_hidden: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Show Needs Review</Label>
            <Switch
              checked={filters.show_needs_review}
              onCheckedChange={(checked) => handleFilterChange({ show_needs_review: checked })}
            />
          </div>
        </div>
      </div>

      <Button
        className="w-full mt-6"
        onClick={handleSubmit}
      >
        Apply Filters
      </Button>
    </div>
  );
}