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

interface FilterControlsProps {
  onSearch: (filters: Partial<TransactionFilters>) => void;
  initialFilters?: TransactionFilters;
  className?: string;
}

export default function FilterControls({ onSearch, initialFilters, className }: FilterControlsProps) {
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<TransactionFilters>({
    year: initialFilters?.year ?? currentYear,
    month: initialFilters?.month ?? new Date().getMonth() + 1,
    show_hidden: initialFilters?.show_hidden ?? false,
    show_needs_review: initialFilters?.show_needs_review ?? false,
    query: initialFilters?.query ?? ''
  });

  const handleFilterChange = (newFilters: Partial<TransactionFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onSearch(updatedFilters);
  };

  return (
    <div className={cn("flex gap-4 items-center p-4 bg-card shadow rounded-lg", className)}>
      <Select
        value={filters.year.toString()}
        onValueChange={(value) => handleFilterChange({
          year: parseInt(value)
        })}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.month.toString()}
        onValueChange={(value) => handleFilterChange({
          month: parseInt(value)
        })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
            <SelectItem key={month} value={month.toString()}>
              {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="search"
        placeholder="Search transactions..."
        className="w-64"
        value={filters.query ?? ''}
        onChange={(e) => handleFilterChange({ query: e.target.value })}
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={filters.show_hidden}
            onCheckedChange={(checked) => handleFilterChange({ show_hidden: checked })}
          />
          <Label className="text-sm">Hidden</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={filters.show_needs_review}
            onCheckedChange={(checked) => handleFilterChange({ show_needs_review: checked })}
          />
          <Label className="text-sm">Needs Review</Label>
        </div>
      </div>
    </div>
  );
}