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
import { ChevronLeft, ChevronRight } from "lucide-react";

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

    onSearch({
      month: prevMonth,
      year: initialFilters?.year === undefined ? undefined : prevYear
    });
  };

  const handleNextMonth = () => {
    const currentMonth = initialFilters?.month ?? new Date().getMonth() + 1;
    const currentYear = initialFilters?.year ?? new Date().getFullYear();

    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;

    if (nextMonth === 13) {
      nextMonth = 1;
      nextYear = currentYear + 1;
    }

    onSearch({
      month: nextMonth,
      year: initialFilters?.year === undefined ? undefined : nextYear
    });
  };

  const handleYearChange = (value: string) => {
    onSearch({ year: value === "all" ? undefined : parseInt(value) });
  };

  const handleMonthChange = (value: string) => {
    onSearch({ month: value === "all" ? undefined : parseInt(value) });
  };

  return (
    <div className={cn("flex gap-4 items-center p-4 bg-card rounded-lg", className)}>
      <Select
        value={initialFilters?.year?.toString() ?? "all"}
        onValueChange={handleYearChange}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((year) => (
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
        value={initialFilters?.month?.toString() ?? "all"}
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
            <SelectItem key={month} value={month.toString()}>
              {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNextMonth}
        title="Next Month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Input
        type="search"
        placeholder="Search..."
        className="w-48"
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