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
  const [filters, setFilters] = useState<TransactionFilters>({
    year: initialFilters?.year ?? currentYear,
    month: initialFilters?.month ?? new Date().getMonth() + 1,
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
                year: filters.year - 1
              })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 text-center font-medium">
              {filters.year}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleFilterChange({
                year: filters.year + 1
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
              onClick={() => handleFilterChange({
                month: filters.month === 1 ? 12 : filters.month - 1
              })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 text-center font-medium">
              {new Date(2000, filters.month - 1).toLocaleString('default', { month: 'long' })}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleFilterChange({
                month: filters.month === 12 ? 1 : filters.month + 1
              })}
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