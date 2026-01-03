import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, isToday, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { CalendarOverviewResponse, CalendarItem, getCalendarOverview } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "2weeks" | "month";

type CalendarEntry = {
  key: string;
  type: "event" | "busy";
  title: string;
  startAt: Date;
  endAt: Date;
  calendarSummary?: string | null;
  userIds: number[];
  isWork: boolean;
};

const viewOptions: { value: ViewMode; label: string; days: number }[] = [
  { value: "day", label: "Day", days: 1 },
  { value: "week", label: "Week", days: 7 },
  { value: "2weeks", label: "2 Weeks", days: 14 },
  { value: "month", label: "Month", days: 30 },
];

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(startOfDay(new Date()));
  const [data, setData] = useState<CalendarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [userFilters, setUserFilters] = useState<Record<number, boolean>>({});
  const [workFilters, setWorkFilters] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getCalendarOverview(view, format(anchorDate, "yyyy-MM-dd"));
        setData(response);
      } catch (err) {
        console.error("Failed to load calendar overview", err);
        setError("Unable to load calendar data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [view, anchorDate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (view === "month") {
      setAnchorDate((current) => startOfMonth(current));
      return;
    }
    if (view === "week" || view === "2weeks") {
      setAnchorDate((current) => startOfWeek(current, { weekStartsOn: 1 }));
    }
  }, [view]);

  useEffect(() => {
    if (!data) return;
    const initialUsers: Record<number, boolean> = {};
    const initialWork: Record<number, boolean> = {};
    data.users.forEach((user) => {
      if (initialUsers[user.id] === undefined) initialUsers[user.id] = true;
      if (initialWork[user.id] === undefined) initialWork[user.id] = true;
    });
    setUserFilters((prev) => (Object.keys(prev).length ? prev : initialUsers));
    setWorkFilters((prev) => (Object.keys(prev).length ? prev : initialWork));
  }, [data]);

  const userMap = useMemo(() => {
    const map = new Map<number, string>();
    data?.users.forEach((user) => {
      const name = user.email.split("@")[0];
      map.set(user.id, name.charAt(0).toUpperCase() + name.slice(1));
    });
    return map;
  }, [data]);

  const entries = useMemo(() => {
    if (!data) return [];
    const eventMap = new Map<string, CalendarEntry>();
    const items = data.items as CalendarItem[];

    items.forEach((item) => {
      const startAt = parseISO(item.start_at);
      const endAt = parseISO(item.end_at);
      const isWork = item.busy_only;
      const userIds = [item.user_id];

      if (item.type === "event") {
        const key = `${item.event_uid || item.event_id}-${item.start_at}-${item.end_at}`;
        const existing = eventMap.get(key);
        if (existing) {
          existing.userIds = Array.from(new Set([...existing.userIds, item.user_id]));
        } else {
          eventMap.set(key, {
            key,
            type: "event",
            title: item.title || "Untitled event",
            startAt,
            endAt,
            calendarSummary: item.calendar_summary,
            userIds,
            isWork: false,
          });
        }
        return;
      }

      const busyKey = `busy-${item.user_id}-${item.calendar_id}-${item.start_at}-${item.end_at}`;
      eventMap.set(busyKey, {
        key: busyKey,
        type: "busy",
        title: "Busy",
        startAt,
        endAt,
        calendarSummary: item.calendar_summary,
        userIds,
        isWork: true,
      });
    });

    return Array.from(eventMap.values()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [data]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const userAllowed = entry.userIds.some((id) => userFilters[id]);
      if (!userAllowed) return false;

      if (entry.isWork) {
        return entry.userIds.some((id) => workFilters[id]);
      }

      return true;
    });
  }, [entries, userFilters, workFilters]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarEntry[]>();
    filteredEntries.forEach((entry) => {
      const key = format(entry.startAt, "yyyy-MM-dd");
      const list = groups.get(key) || [];
      list.push(entry);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEntries]);

  const handleNavigate = (direction: "prev" | "next") => {
    const current = startOfDay(anchorDate);
    const days = viewOptions.find((opt) => opt.value === view)?.days || 7;
    const nextDate = direction === "prev" ? addDays(current, -days) : addDays(current, days);
    setAnchorDate(nextDate);
  };

  const handleToday = () => setAnchorDate(startOfDay(new Date()));

  const handleMonth = (direction: "prev" | "next") => {
    setAnchorDate((current) => addMonths(current, direction === "prev" ? -1 : 1));
  };

  const headerRange = useMemo(() => {
    const startLabel = format(anchorDate, "MMM d");
    const endDate = view === "month" ? addMonths(anchorDate, 1) : addDays(anchorDate, viewOptions.find((opt) => opt.value === view)?.days || 7);
    const endLabel = format(addDays(endDate, -1), "MMM d");
    return `${startLabel} – ${endLabel}`;
  }, [anchorDate, view]);

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">Upcoming events and busy blocks</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={view === option.value ? "default" : "outline"}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => (view === "month" ? handleMonth("prev") : handleNavigate("prev"))}>
              Prev
            </Button>
            <Button size="sm" variant="outline" onClick={handleToday}>
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={() => (view === "month" ? handleMonth("next") : handleNavigate("next"))}>
              Next
            </Button>
            <span className="text-sm text-muted-foreground">{headerRange}</span>
          </div>

          <div className="flex flex-wrap gap-4">
            {data?.users.map((user) => (
              <div key={user.id} className="flex items-center gap-2">
                <Checkbox
                  checked={userFilters[user.id] ?? true}
                  onCheckedChange={(value) =>
                    setUserFilters((prev) => ({ ...prev, [user.id]: Boolean(value) }))
                  }
                />
                <span className="text-sm">{user.email}</span>
              </div>
            ))}
            {data?.users.map((user) => (
              <div key={`work-${user.id}`} className="flex items-center gap-2">
                <Checkbox
                  checked={workFilters[user.id] ?? true}
                  onCheckedChange={(value) =>
                    setWorkFilters((prev) => ({ ...prev, [user.id]: Boolean(value) }))
                  }
                />
                <span className="text-sm">{userMap.get(user.id)} work</span>
              </div>
            ))}
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading calendar…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && grouped.length === 0 && (
          <div className="text-sm text-muted-foreground">No items in this window.</div>
        )}

        {!loading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([dateKey, items]) => (
              <div key={dateKey} className="rounded-lg border border-border/60 bg-background/60">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="font-semibold">{format(parseISO(dateKey), "EEEE, MMM d")}</div>
                  <div className="text-sm text-muted-foreground">{items.length} item(s)</div>
                </div>
                {isToday(parseISO(dateKey)) && (
                  <div className="px-4 py-3">
                    <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-red-500">
                        {format(now, "h:mm a")}
                      </span>
                      <div className="relative flex-1">
                        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-red-400/70" />
                        <div className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="divide-y">
                  {items.map((item) => (
                    <div key={item.key} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", item.type === "busy" && "text-muted-foreground")}>
                            {item.title}
                          </span>
                          {item.calendarSummary && (
                            <span className="text-xs text-muted-foreground">({item.calendarSummary})</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(item.startAt, "h:mm a")} – {format(item.endAt, "h:mm a")}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.userIds.map((id) => userMap.get(id)).filter(Boolean).join(" + ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
