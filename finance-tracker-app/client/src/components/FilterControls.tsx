import { TransactionFilters } from '../lib/api';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface FilterControlsProps {
  onSearch: (filters: Partial<TransactionFilters>) => void;
  initialFilters?: TransactionFilters;
  className?: string;
}

// This is the original inline desktop version
export default function FilterControls({ onSearch, initialFilters, className }: FilterControlsProps) {
  const currentYear = new Date().getFullYear();

  const handlePreviousMonth = () => {
    const currentMonth = initialFilters?.month ?? new Date().getMonth() + 1;
    const currentYear = initialFilters?.year ?? new Date().getFullYear();

    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    onSearch({ month: prevMonth, year: prevYear });
  };

  return (
    <div className={cn("flex gap-4 items-center p-4 bg-card rounded-lg", className)}>
      <Select
        value={initialFilters?.year?.toString() ?? currentYear.toString()}
        onValueChange={(value) => onSearch({ year: parseInt(value) })}
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

      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousMonth}
        title="Previous Month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select
        value={initialFilters?.month?.toString()}
        onValueChange={(value) => onSearch({ month: parseInt(value) })}
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
        value={initialFilters?.query ?? ''}
        onChange={(e) => onSearch({ query: e.target.value })}
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={initialFilters?.show_hidden ?? false}
            onCheckedChange={(checked) => onSearch({ show_hidden: checked })}
          />
          <Label className="text-sm">Hidden</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={initialFilters?.show_needs_review ?? false}
            onCheckedChange={(checked) => onSearch({ show_needs_review: checked })}
          />
          <Label className="text-sm">Needs Review</Label>
        </div>
      </div>
    </div>
  );
}