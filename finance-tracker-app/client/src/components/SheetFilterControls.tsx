import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TransactionFilters } from '../lib/api';
import { cn } from "@/lib/utils";

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
        <Label>Search</Label>
        <Input
          type="search"
          placeholder="Search transactions..."
          className="w-full"
          value={filters.query ?? ''}
          onChange={(e) => handleFilterChange({ query: e.target.value })}
        />
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Year</Label>
          <Select
            value={filters.year.toString()}
            onValueChange={(value) => handleFilterChange({
              year: parseInt(value)
            })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Month</Label>
          <Select
            value={filters.month.toString()}
            onValueChange={(value) => handleFilterChange({
              month: parseInt(value)
            })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="block mb-3">Additional Filters</Label>
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