import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addHours,
  addMonths,
  differenceInMinutes,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarOverviewResponse, CalendarItem, getCalendarOverview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

const GEO_CACHE_KEY = "jarvis_geo";
const GEO_DENIED_KEY = "jarvis_geo_denied";
const HOUR_HEIGHT = 56;
const DAY_MINUTES = 24 * 60;
const SUN_LINE_HEIGHT = 1;
const TIME_COL_WIDTH = 80;

const USER_PALETTE: Record<string, { personal: string; work: string }> = {
  "asif.h.ahmed@gmail.com": {
    personal: "border-l-purple-400 bg-purple-50/70 text-slate-900",
    work: "border-l-sky-400 bg-sky-50/70 text-slate-900",
  },
  "hsayyeda@gmail.com": {
    personal: "border-l-amber-400 bg-amber-50/70 text-slate-900",
    work: "border-l-emerald-400 bg-emerald-50/70 text-slate-900",
  },
};
const DEFAULT_PALETTE = {
  personal: "border-l-slate-300 bg-slate-50/70 text-slate-900",
  work: "border-l-slate-300 bg-slate-50/70 text-slate-900",
};

type GeoPoint = { lat: number; lng: number };

type SunTimes = {
  dawn: Date;
  sunrise: Date;
  sunset: Date;
};

const rad = Math.PI / 180;
const dayMs = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const obliquity = 23.4397 * rad;

const toJulian = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970;
const fromJulian = (julian: number) => new Date((julian + 0.5 - J1970) * dayMs);
const toDays = (date: Date) => toJulian(date) - J2000;
const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (m: number) => {
  const c = rad * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const p = rad * 102.9372;
  return m + c + p + Math.PI;
};
const declination = (l: number) => Math.asin(Math.sin(l) * Math.sin(obliquity));
const julianCycle = (d: number, lw: number) => Math.round(d - 0.0009 - lw / (2 * Math.PI));
const approxTransit = (ht: number, lw: number, n: number) => (ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
const hourAngle = (h: number, phi: number, dec: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
const getSetJ = (h: number, lw: number, phi: number, dec: number, n: number, m: number, l: number) => {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, m, l);
};

const getSunTimes = (date: Date, lat: number, lng: number): SunTimes => {
  // Minimal SunCalc-style algorithm for civil dawn/sunrise/sunset.
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l);
  const jNoon = solarTransitJ(ds, m, l);

  const jSunset = getSetJ(-0.833 * rad, lw, phi, dec, n, m, l);
  const jSunrise = jNoon - (jSunset - jNoon);
  const jDusk = getSetJ(-6 * rad, lw, phi, dec, n, m, l);
  const jDawn = jNoon - (jDusk - jNoon);

  return {
    dawn: fromJulian(jDawn),
    sunrise: fromJulian(jSunrise),
    sunset: fromJulian(jSunset),
  };
};

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(startOfDay(new Date()));
  const [data, setData] = useState<CalendarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [userFilters, setUserFilters] = useState<Record<number, boolean>>({});
  const [workFilters, setWorkFilters] = useState<Record<number, boolean>>({});
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const isMobile = useIsMobile();

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
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GeoPoint;
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          setGeo(parsed);
          return;
        }
      } catch {
        localStorage.removeItem(GEO_CACHE_KEY);
      }
    }
    if (localStorage.getItem(GEO_DENIED_KEY) === "true") {
      setGeoDenied(true);
      return;
    }
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(next));
        setGeo(next);
        setGeoDenied(false);
      },
      () => {
        localStorage.setItem(GEO_DENIED_KEY, "true");
        setGeoDenied(true);
      }
    );
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
    if (!isMobile) return;
    if (view === "week" || view === "2weeks") {
      setView("day");
    }
  }, [isMobile, view]);

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
      if (user.email === "asif.h.ahmed@gmail.com") {
        map.set(user.id, "Asif");
        return;
      }
      if (user.email === "hsayyeda@gmail.com") {
        map.set(user.id, "Hafsa");
        return;
      }
      map.set(user.id, name.charAt(0).toUpperCase() + name.slice(1));
    });
    return map;
  }, [data]);

  const userEmailMap = useMemo(() => {
    const map = new Map<number, string>();
    data?.users.forEach((user) => {
      map.set(user.id, user.email);
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

  const isAllDayEntry = (entry: CalendarEntry) => {
    const start = entry.startAt;
    const end = entry.endAt;
    const startsAtMidnight = start.getHours() === 0 && start.getMinutes() === 0;
    const endsAtMidnight = end.getHours() === 0 && end.getMinutes() === 0;
    const durationMinutes = differenceInMinutes(end, start);
    return startsAtMidnight && endsAtMidnight && durationMinutes >= 24 * 60;
  };

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

  const timedEntries = useMemo(() => filteredEntries.filter((entry) => !isAllDayEntry(entry)), [filteredEntries]);
  const allDayEntries = useMemo(() => filteredEntries.filter((entry) => isAllDayEntry(entry)), [filteredEntries]);

  const viewDays = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
      return Array.from({ length: 42 }, (_, index) => addDays(start, index));
    }
    if (view === "day") {
      return [startOfDay(anchorDate)];
    }
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const days = view === "2weeks" ? 14 : 7;
    return Array.from({ length: days }, (_, index) => addDays(start, index));
  }, [anchorDate, view]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    if (viewDays.length === 0) return map;
    const viewStart = viewDays[0].getTime();
    const viewEnd = addDays(viewDays[viewDays.length - 1], 1).getTime();
    viewDays.forEach((day) => map.set(format(day, "yyyy-MM-dd"), []));

    timedEntries.forEach((entry) => {
      const endMarker = new Date(entry.endAt.getTime() - 1);
      let cursor = startOfDay(entry.startAt);
      const lastDay = startOfDay(endMarker);

      while (cursor.getTime() <= lastDay.getTime()) {
        const cursorTime = cursor.getTime();
        if (cursorTime >= viewStart && cursorTime < viewEnd) {
          const key = format(cursor, "yyyy-MM-dd");
          const list = map.get(key);
          if (list) list.push(entry);
        }
        cursor = addDays(cursor, 1);
      }
    });

    return map;
  }, [timedEntries, viewDays]);

  const allDayByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    if (viewDays.length === 0) return map;
    viewDays.forEach((day) => map.set(format(day, "yyyy-MM-dd"), []));

    allDayEntries.forEach((entry) => {
      const endMarker = new Date(entry.endAt.getTime() - 1);
      let cursor = startOfDay(entry.startAt);
      const lastDay = startOfDay(endMarker);

      while (cursor.getTime() <= lastDay.getTime()) {
        const key = format(cursor, "yyyy-MM-dd");
        const list = map.get(key);
        if (list) list.push(entry);
        cursor = addDays(cursor, 1);
      }
    });

    return map;
  }, [allDayEntries, viewDays]);

  const visibleRange = useMemo(() => {
    if (view === "month" || filteredEntries.length === 0) {
      return { startHour: 0, endHour: 24 };
    }
    const viewStart = viewDays[0];
    const viewEnd = addDays(viewDays[viewDays.length - 1], 1);
    let minMinute = DAY_MINUTES;
    let maxMinute = 0;

    filteredEntries.forEach((entry) => {
      if (entry.endAt <= viewStart || entry.startAt >= viewEnd) return;
      const startDay = startOfDay(entry.startAt);
      const startMinute = Math.max(0, Math.min(DAY_MINUTES, differenceInMinutes(entry.startAt, startDay)));
      const endDay = startOfDay(entry.endAt);
      const endMinute = Math.max(0, Math.min(DAY_MINUTES, differenceInMinutes(entry.endAt, endDay)));
      minMinute = Math.min(minMinute, startMinute);
      maxMinute = Math.max(maxMinute, endMinute);
    });

    if (minMinute === DAY_MINUTES && maxMinute === 0) {
      return { startHour: 0, endHour: 24 };
    }

    const startHour = Math.max(0, Math.floor(minMinute / 60) - 1);
    const endHour = Math.min(24, Math.ceil(maxMinute / 60) + 1);
    return { startHour, endHour };
  }, [filteredEntries, view, viewDays]);

  const hours = useMemo(
    () => Array.from({ length: visibleRange.endHour - visibleRange.startHour }, (_, index) => visibleRange.startHour + index),
    [visibleRange]
  );

  const requestGeo = () => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    localStorage.removeItem(GEO_DENIED_KEY);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(next));
        setGeo(next);
        setGeoDenied(false);
      },
      () => {
        localStorage.setItem(GEO_DENIED_KEY, "true");
        setGeoDenied(true);
      }
    );
  };

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
    const startLabel = format(viewDays[0] || anchorDate, "MMM d");
    const endLabel = format(viewDays[viewDays.length - 1] || anchorDate, "MMM d");
    return `${startLabel} – ${endLabel}`;
  }, [anchorDate, view, viewDays]);

  const layoutDayEntries = (day: Date, dayEntries: CalendarEntry[]) => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    const base = dayEntries
      .map((entry) => {
        const startAt = entry.startAt < dayStart ? dayStart : entry.startAt;
        const endAt = entry.endAt > dayEnd ? dayEnd : entry.endAt;
        const startMin = Math.max(0, differenceInMinutes(startAt, dayStart));
        const endMin = Math.min(DAY_MINUTES, differenceInMinutes(endAt, dayStart));
        return { entry, startMin, endMin };
      })
      .filter((item) => item.endMin > item.startMin)
      .sort((a, b) => a.startMin - b.startMin);

    const columnsEnd: number[] = [];
    const placed = base.map((item) => {
      let columnIndex = columnsEnd.findIndex((end) => end <= item.startMin);
      if (columnIndex === -1) {
        columnIndex = columnsEnd.length;
        columnsEnd.push(item.endMin);
      } else {
        columnsEnd[columnIndex] = item.endMin;
      }
      return { ...item, columnIndex };
    });

    const totalColumns = columnsEnd.length || 1;
    return placed.map((item) => ({ ...item, totalColumns }));
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">Upcoming events and busy blocks</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewOptions
              .filter((option) => (isMobile ? option.value === "day" || option.value === "month" : true))
              .map((option) => (
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

          <div className="flex flex-wrap gap-2">
            {data?.users.map((user) => {
              const label = userMap.get(user.id) || user.email;
              const isActive = userFilters[user.id] ?? true;
              return (
                <Button
                  key={user.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setUserFilters((prev) => ({ ...prev, [user.id]: !isActive }))}
                >
                  {label}
                </Button>
              );
            })}
            {data?.users.map((user) => {
              const label = `${userMap.get(user.id) || user.email} (Work)`;
              const isActive = workFilters[user.id] ?? true;
              return (
                <Button
                  key={`work-${user.id}`}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setWorkFilters((prev) => ({ ...prev, [user.id]: !isActive }))}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {!geo && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/60 px-4 py-2 text-xs text-amber-900">
            <span>
              {geoDenied
                ? "Location access is blocked. Enable it to show dawn, sunrise, and sunset lines."
                : "Enable location to show dawn, sunrise, and sunset lines on the calendar."}
            </span>
            <Button size="sm" variant="outline" onClick={requestGeo}>
              Enable
            </Button>
          </div>
        )}

        {loading && <div className="text-sm text-muted-foreground">Loading calendar…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && filteredEntries.length === 0 && (
          <div className="text-sm text-muted-foreground">No items in this window.</div>
        )}

        {!loading && !error && view === "month" && (
          <div className="rounded-xl border border-border/60 bg-background/70 p-2 shadow-sm">
            <div className="grid grid-cols-7 gap-px rounded-lg bg-border/40 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="bg-background/80 px-3 py-2 text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px rounded-lg bg-border/40">
              {viewDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const items = entriesByDay.get(dayKey) || [];
                const visibleItems = items.filter((item) => isSameDay(item.startAt, day)).slice(0, 3);
                const overflow = items.filter((item) => isSameDay(item.startAt, day)).length - visibleItems.length;
                const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "min-h-[120px] bg-background/80 px-3 py-2 text-xs",
                      !isCurrentMonth && "text-muted-foreground/70",
                      isToday(day) && "ring-1 ring-blue-400/50"
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={cn("font-semibold", isToday(day) && "text-blue-600")}>{format(day, "d")}</span>
                      {isToday(day) && <span className="text-[10px] uppercase text-blue-500">Today</span>}
                    </div>
                    <div className="mt-2 space-y-1">
                      {visibleItems.map((item) => (
                        <div
                          key={`${dayKey}-${item.key}`}
                          className={cn(
                            "truncate rounded-md border px-2 py-1 text-[11px]",
                            item.type === "busy"
                              ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
                              : "border-blue-400/30 bg-blue-500/10 text-foreground"
                          )}
                        >
                          {item.title}
                        </div>
                      ))}
                      {overflow > 0 && <div className="text-[11px] text-muted-foreground">+{overflow} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && view !== "month" && (
          <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
            <div
              className="grid sticky top-0 z-20 border-b border-slate-200/70 bg-white text-xs text-slate-500"
              style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${viewDays.length}, minmax(0, 1fr))` }}
            >
              <div className="px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.28em]">GMT-08</div>
              </div>
              {viewDays.map((day) => (
                <div
                  key={`header-${format(day, "yyyy-MM-dd")}`}
                  className={cn(
                    "border-l border-slate-200/70 px-4 py-3",
                    isToday(day) && "bg-slate-50 text-slate-900"
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em]">{format(day, "EEE")}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold",
                        isToday(day) ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="text-sm font-semibold">{format(day, "MMM")}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${viewDays.length}, minmax(0, 1fr))`,
                  minWidth: Math.max(920, viewDays.length * 220 + TIME_COL_WIDTH),
                }}
              >
                <div
                  className="relative border-r border-slate-200/70 bg-white sticky left-0 z-10"
                  style={{ height: HOUR_HEIGHT * hours.length }}
                >
                  {hours.map((hour) => {
                    const labelTime = addHours(startOfDay(anchorDate), hour);
                    return (
                      <div
                        key={`hour-${hour}`}
                        className="absolute left-0 flex w-full items-start gap-2"
                        style={{ top: (hour - visibleRange.startHour) * HOUR_HEIGHT }}
                      >
                        <div className="absolute left-0 right-0 top-0 border-t border-slate-200/60" />
                        <div className="w-full px-3 text-[11px] font-medium text-slate-400">
                          {format(labelTime, "h a")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {viewDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const items = entriesByDay.get(dayKey) || [];
                  const positioned = layoutDayEntries(day, items);
                  const sunTimes = geo ? getSunTimes(day, geo.lat, geo.lng) : null;
                  const dayStart = startOfDay(day);
                  const nowMinutes = differenceInMinutes(now, dayStart);
                  const minuteOffset = nowMinutes - visibleRange.startHour * 60;
                  const nowTop = (minuteOffset / 60) * HOUR_HEIGHT;
                  const sunLines =
                    sunTimes &&
                    (["dawn", "sunrise", "sunset"] as const).map((key) => {
                      const minutes = differenceInMinutes(sunTimes[key], dayStart);
                      if (minutes < visibleRange.startHour * 60 || minutes > visibleRange.endHour * 60) return null;
                      const top = ((minutes - visibleRange.startHour * 60) / 60) * HOUR_HEIGHT;
                      const className =
                        key === "dawn"
                          ? "from-amber-100/10 via-amber-200/70 to-amber-100/10 shadow-[0_0_8px_rgba(250,204,120,0.35)]"
                          : key === "sunrise"
                            ? "from-amber-200/10 via-amber-400/80 to-amber-200/10 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                            : "from-rose-200/10 via-orange-300/80 to-rose-200/10 shadow-[0_0_10px_rgba(251,113,133,0.35)]";
                      return (
                        <div
                          key={`${dayKey}-${key}`}
                          className={cn("absolute left-4 right-4 bg-gradient-to-r", className)}
                          style={{ top, height: SUN_LINE_HEIGHT }}
                        />
                      );
                    });

                  return (
                    <div
                      key={dayKey}
                      className={cn(
                        "relative border-l border-slate-200/70 bg-white",
                        isToday(day) && "bg-slate-50/70"
                      )}
                      style={{ height: HOUR_HEIGHT * hours.length }}
                    >
                      {hours.map((hour) => (
                        <div
                          key={`${dayKey}-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-slate-200/60"
                          style={{ top: (hour - visibleRange.startHour) * HOUR_HEIGHT }}
                        />
                      ))}

                      {sunLines}

                    {isToday(day) &&
                      nowMinutes >= visibleRange.startHour * 60 &&
                      nowMinutes <= visibleRange.endHour * 60 && (
                        <div className="group absolute left-0 right-0" style={{ top: nowTop }}>
                          <div className="absolute left-4 h-3 w-3 -translate-y-1/2 rounded-full bg-red-500" />
                          <div className="absolute left-4 right-4 h-px -translate-y-1/2 bg-red-500/80" />
                          <div className="absolute left-8 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-red-600 opacity-0 shadow-sm transition group-hover:opacity-100">
                            {format(now, "h:mm a")}
                          </div>
                        </div>
                      )}

                    {positioned.map(({ entry, startMin, endMin, columnIndex, totalColumns }) => {
                      const visibleStartMin = visibleRange.startHour * 60;
                      const visibleEndMin = visibleRange.endHour * 60;
                      const displayStart = Math.max(startMin, visibleStartMin);
                      const displayEnd = Math.min(endMin, visibleEndMin);
                      if (displayEnd <= displayStart) return null;
                      const top = ((displayStart - visibleStartMin) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((displayEnd - displayStart) / 60) * HOUR_HEIGHT, 20);
                      const columnWidth = 100 / totalColumns;
                      const left = `calc(${columnWidth * columnIndex}% + ${columnIndex * 6}px + 6px)`;
                      const width = `calc(${columnWidth}% - 12px)`;
                      const durationMinutes = endMin - startMin;
                      const primaryUserId = entry.userIds[0];
                      const primaryEmail = primaryUserId ? userEmailMap.get(primaryUserId) : undefined;
                      const palette = (primaryEmail && USER_PALETTE[primaryEmail]) || DEFAULT_PALETTE;
                      const paletteClass = entry.isWork ? palette.work : palette.personal;
                      const muted = entry.type === "busy" ? "opacity-75" : "";
                      const label = entry.userIds.map((id) => userMap.get(id)).filter(Boolean).join(" + ");
                      return (
                          <div
                            key={entry.key}
                            className={cn(
                              "absolute overflow-hidden rounded-md border border-slate-200/70 px-2 py-1 text-[11px] shadow-sm border-l-[3px]",
                              paletteClass,
                              muted
                            )}
                            style={{ top, height, left, width }}
                          >
                            <div className="truncate text-[11px] font-semibold">{entry.title}</div>
                            {durationMinutes >= 30 && (
                              <div className="truncate text-[10px] text-slate-500">
                                {format(entry.startAt, "h:mm a")}–{format(entry.endAt, "h:mm a")}
                              </div>
                            )}
                            {durationMinutes >= 60 && label && (
                              <div className="truncate text-[10px] text-slate-500">{label}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && isMobile && view === "day" && (
          <div className="rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Agenda
            </div>
            <div className="mt-3 space-y-2">
              {(entriesByDay.get(format(anchorDate, "yyyy-MM-dd")) || [])
                .filter((item) => isSameDay(item.startAt, anchorDate))
                .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
                .map((item) => (
                  <div
                    key={`agenda-${item.key}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
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
        )}
      </div>
    </div>
  );
}
