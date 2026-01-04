import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addHours,
  addMonths,
  differenceInMinutes,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarOverviewResponse, CalendarItem, deleteCalendarEvent, getCalendarOverview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatPanel } from "@/components/ChatPanel";
import { StateCard } from "@/components/StateCard";
import { PanelRightClose, PanelRightOpen, Repeat } from "lucide-react";

type ViewMode = "day" | "week" | "month";

type CalendarEntry = {
  id: number;
  key: string;
  type: "event" | "busy";
  title: string;
  isRecurring: boolean;
  startAt: Date;
  endAt: Date;
  description?: string | null;
  location?: string | null;
  calendarSummary?: string | null;
  calendarId: string;
  userIds: number[];
  isWork: boolean;
};

const viewOptions: { value: ViewMode; label: string; days: number; tooltip: string }[] = [
  { value: "day", label: "D", days: 1, tooltip: "Day" },
  { value: "week", label: "W", days: 7, tooltip: "Week" },
  { value: "month", label: "M", days: 30, tooltip: "Month" },
];

const GEO_CACHE_KEY = "jarvis_geo";
const GEO_DENIED_KEY = "jarvis_geo_denied";
const HOUR_HEIGHT = 56;
const DAY_MINUTES = 24 * 60;
const SUN_LINE_HEIGHT = 2;
const TIME_COL_WIDTH = 80;

const USER_PALETTE: Record<
  string,
  { blockPersonal: string; blockWork: string; dotPersonal: string; dotWork: string }
> = {
  "asif.h.ahmed@gmail.com": {
    blockPersonal: "border-l-purple-400 bg-purple-50/70 text-slate-900 dark:bg-purple-500/20 dark:text-slate-100",
    blockWork: "border-l-sky-400 bg-sky-50/70 text-slate-900 dark:bg-sky-500/20 dark:text-slate-100",
    dotPersonal: "bg-purple-400",
    dotWork: "bg-sky-400",
  },
  "hsayyeda@gmail.com": {
    blockPersonal: "border-l-amber-400 bg-amber-50/70 text-slate-900 dark:bg-amber-500/20 dark:text-slate-100",
    blockWork: "border-l-emerald-400 bg-emerald-50/70 text-slate-900 dark:bg-emerald-500/20 dark:text-slate-100",
    dotPersonal: "bg-amber-400",
    dotWork: "bg-emerald-400",
  },
  "asif@sevensevensix.com": {
    blockPersonal: "border-l-sky-400 bg-sky-50/70 text-slate-900 dark:bg-sky-500/20 dark:text-slate-100",
    blockWork: "border-l-sky-400 bg-sky-50/70 text-slate-900 dark:bg-sky-500/20 dark:text-slate-100",
    dotPersonal: "bg-sky-400",
    dotWork: "bg-sky-400",
  },
  "hafsa.sayyeda@goodrx.com": {
    blockPersonal: "border-l-emerald-400 bg-emerald-50/70 text-slate-900 dark:bg-emerald-500/20 dark:text-slate-100",
    blockWork: "border-l-emerald-400 bg-emerald-50/70 text-slate-900 dark:bg-emerald-500/20 dark:text-slate-100",
    dotPersonal: "bg-emerald-400",
    dotWork: "bg-emerald-400",
  },
};
const DEFAULT_PALETTE = {
  blockPersonal: "border-l-slate-300 bg-slate-50/70 text-slate-900 dark:bg-slate-800/70 dark:text-slate-100",
  blockWork: "border-l-slate-300 bg-slate-50/70 text-slate-900 dark:bg-slate-800/70 dark:text-slate-100",
  dotPersonal: "bg-slate-300",
  dotWork: "bg-slate-300",
};
const USER_PALETTE_COLORS: Record<string, { personal: { border: string; bg: string }; work: { border: string; bg: string } }> = {
  "asif.h.ahmed@gmail.com": {
    personal: { border: "#c084fc", bg: "rgba(192, 132, 252, 0.2)" },
    work: { border: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)" },
  },
  "hsayyeda@gmail.com": {
    personal: { border: "#fbbf24", bg: "rgba(251, 191, 36, 0.2)" },
    work: { border: "#34d399", bg: "rgba(52, 211, 153, 0.2)" },
  },
  "asif@sevensevensix.com": {
    personal: { border: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)" },
    work: { border: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)" },
  },
  "hafsa.sayyeda@goodrx.com": {
    personal: { border: "#34d399", bg: "rgba(52, 211, 153, 0.2)" },
    work: { border: "#34d399", bg: "rgba(52, 211, 153, 0.2)" },
  },
};
const DEFAULT_PALETTE_COLORS = {
  personal: { border: "#cbd5e1", bg: "rgba(203, 213, 225, 0.2)" },
  work: { border: "#cbd5e1", bg: "rgba(203, 213, 225, 0.2)" },
};

type GeoPoint = { lat: number; lng: number };

const getWorkCalendarLabel = (calendarId: string, summary?: string | null) => {
  if (calendarId === "asif@sevensevensix.com") return "Asif (Work)";
  if (calendarId === "hafsa.sayyeda@goodrx.com") return "Hafsa (Work)";
  return summary || calendarId;
};

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
  const jDusk = getSetJ(-15 * rad, lw, phi, dec, n, m, l);
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
  const [workFilters, setWorkFilters] = useState<Record<string, boolean>>({});
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobilePane, setMobilePane] = useState<"agenda" | "chat">("agenda");
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const pendingDayRef = useRef<Date | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
  }, [view, anchorDate, refreshKey]);

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
    if (view === "day") {
      if (pendingDayRef.current) {
        const selected = pendingDayRef.current;
        pendingDayRef.current = null;
        setAnchorDate(startOfDay(selected));
      } else {
        setAnchorDate(startOfDay(new Date()));
      }
      return;
    }
    if (view === "week") {
      setAnchorDate((current) => startOfWeek(current, { weekStartsOn: 0 }));
    }
  }, [view]);

  useEffect(() => {
    if (!isMobile) return;
    if (view !== "day") {
      setView("day");
    }
  }, [isMobile, view]);

  useEffect(() => {
    const measure = () => {
      if (!scrollRef.current) return;
      const width = scrollRef.current.offsetWidth - scrollRef.current.clientWidth;
      setScrollbarWidth(width);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, anchorDate, isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName))) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "d") {
        setView("day");
      } else if (key === "w") {
        setView("week");
      } else if (key === "m") {
        setView("month");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  const openDayView = (day: Date) => {
    pendingDayRef.current = day;
    setAnchorDate(startOfDay(day));
    setView("day");
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (deletingEventId) return;
    setDeletingEventId(eventId);
    try {
      await deleteCalendarEvent(eventId);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error("Failed to delete calendar event", error);
    } finally {
      setDeletingEventId(null);
    }
  };

  useEffect(() => {
    if (!data) return;
    const initialUsers: Record<number, boolean> = {};
    const initialWork: Record<string, boolean> = {};
    data.users.forEach((user) => {
      if (initialUsers[user.id] === undefined) initialUsers[user.id] = true;
    });
    (data.work_calendars || []).forEach((cal) => {
      if (initialWork[cal.calendar_id] === undefined) initialWork[cal.calendar_id] = true;
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

  const workCalendarLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.work_calendars || []).forEach((cal) => {
      map.set(cal.calendar_id, getWorkCalendarLabel(cal.calendar_id, cal.summary));
    });
    return map;
  }, [data]);

  const getPaletteColors = (email: string | undefined, isWork: boolean) => {
    const palette = (email && USER_PALETTE_COLORS[email]) || DEFAULT_PALETTE_COLORS;
    return isWork ? palette.work : palette.personal;
  };

  const getEntryPalette = (entry: CalendarEntry) => {
    const emails = entry.isWork
      ? [entry.calendarId]
      : entry.userIds.map((id) => userEmailMap.get(id)).filter((email): email is string => Boolean(email));
    const uniqueEmails = Array.from(new Set(emails));
    if (uniqueEmails.length <= 1) {
      const primaryEmail = uniqueEmails[0];
      const palette = (primaryEmail && USER_PALETTE[primaryEmail]) || DEFAULT_PALETTE;
      return { className: entry.isWork ? palette.blockWork : palette.blockPersonal } as const;
    }
    const [firstEmail, secondEmail] = uniqueEmails;
    const first = getPaletteColors(firstEmail, entry.isWork);
    const second = getPaletteColors(secondEmail, entry.isWork);
    return {
      className: "text-slate-900 dark:text-slate-100",
      style: {
        borderLeftColor: first.border,
        backgroundColor: first.bg,
        backgroundImage: `repeating-linear-gradient(135deg, ${first.bg} 0px, ${first.bg} 10px, ${second.bg} 10px, ${second.bg} 20px)`,
      },
    } as const;
  };

  const entries = useMemo(() => {
    if (!data) return [];
    const eventMap = new Map<string, CalendarEntry>();
    const items = data.items as CalendarItem[];

    items.forEach((item) => {
      const startAt = parseISO(item.start_at);
      const endAt = parseISO(item.end_at);
      const userIds = [item.user_id];

      if (item.type === "event") {
        const key = `${item.event_uid || item.event_id}-${item.start_at}-${item.end_at}`;
        const existing = eventMap.get(key);
        if (existing) {
          existing.userIds = Array.from(new Set([...existing.userIds, item.user_id]));
        } else {
          eventMap.set(key, {
            id: item.id,
            key,
            type: "event",
            title: item.title || "Untitled event",
            isRecurring: Boolean(item.is_recurring),
            startAt,
            endAt,
            description: item.description,
            location: item.location,
            calendarSummary: item.calendar_summary,
            calendarId: item.calendar_id,
            userIds,
            isWork: false,
          });
        }
        return;
      }

      const busyKey = `busy-${item.user_id}-${item.calendar_id}-${item.start_at}-${item.end_at}`;
      eventMap.set(busyKey, {
        id: item.id,
        key: busyKey,
        type: "busy",
        title: "Busy",
        isRecurring: false,
        startAt,
        endAt,
        description: null,
        location: null,
        calendarSummary: item.calendar_summary,
        calendarId: item.calendar_id,
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
      if (entry.isWork) {
        return workFilters[entry.calendarId] ?? true;
      }

      return entry.userIds.some((id) => userFilters[id]);
    });
  }, [entries, userFilters, workFilters]);

  const timedEntries = useMemo(() => filteredEntries.filter((entry) => !isAllDayEntry(entry)), [filteredEntries]);
  const allDayEntries = useMemo(() => filteredEntries.filter((entry) => isAllDayEntry(entry)), [filteredEntries]);

  const viewDays = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 });
      const length = differenceInCalendarDays(end, start) + 1;
      return Array.from({ length }, (_, index) => addDays(start, index));
    }
    if (view === "day") {
      return [startOfDay(anchorDate)];
    }
    const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchorDate, view]);

  const weekSections = useMemo(() => {
    return [viewDays];
  }, [viewDays]);

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
    const defaultStart = 6;
    const defaultEnd = 20;
    if (view === "month" || timedEntries.length === 0) {
      return { startHour: defaultStart, endHour: defaultEnd };
    }
    const viewStart = viewDays[0];
    const viewEnd = addDays(viewDays[viewDays.length - 1], 1);
    let minMinute = DAY_MINUTES;
    let maxMinute = 0;

    timedEntries.forEach((entry) => {
      if (entry.endAt <= viewStart || entry.startAt >= viewEnd) return;
      const startDay = startOfDay(entry.startAt);
      const startMinute = Math.max(0, Math.min(DAY_MINUTES, differenceInMinutes(entry.startAt, startDay)));
      const endDay = startOfDay(entry.endAt);
      const endMinute = Math.max(0, Math.min(DAY_MINUTES, differenceInMinutes(entry.endAt, endDay)));
      minMinute = Math.min(minMinute, startMinute);
      maxMinute = Math.max(maxMinute, endMinute);
    });

    if (minMinute === DAY_MINUTES && maxMinute === 0) {
      return { startHour: defaultStart, endHour: defaultEnd };
    }

    const startHour = Math.min(
      defaultStart,
      Math.max(0, Math.floor(minMinute / 60) - 1)
    );
    const endHour = Math.max(
      defaultEnd,
      Math.min(24, Math.ceil(maxMinute / 60) + 1)
    );
    return { startHour, endHour };
  }, [timedEntries, view, viewDays]);

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
    if (view === "day") return startLabel;
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

    const clusters: typeof base[] = [];
    let cluster: typeof base = [];
    let clusterEnd = -1;

    base.forEach((item) => {
      if (cluster.length === 0 || item.startMin < clusterEnd) {
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
        return;
      }
      clusters.push(cluster);
      cluster = [item];
      clusterEnd = item.endMin;
    });
    if (cluster.length) clusters.push(cluster);

    return clusters.flatMap((items) => {
      const columnsEnd: number[] = [];
      const placed = items.map((item) => {
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
    });
  };

  return (
    <div className="h-full">
      <div className="h-full flex min-h-0" ref={containerRef}>
        <div className="min-w-0 flex-1">
          <div className="h-full overflow-auto p-4 md:p-6">
            <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold">Calendar</h1>
              {isMobile && <span className="text-sm text-muted-foreground">{headerRange}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
              <div className="inline-flex scale-[0.92] origin-left md:scale-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (view === "month" ? handleMonth("prev") : handleNavigate("prev"))}
                  aria-label="Previous"
                  className="rounded-none rounded-l-md border-r-0"
                >
                  {"<"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToday}
                  className="rounded-none border-r-0"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (view === "month" ? handleMonth("next") : handleNavigate("next"))}
                  aria-label="Next"
                  className="rounded-none rounded-r-md"
                >
                  {">"}
                </Button>
              </div>
              <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 md:mx-0 md:px-0 md:overflow-visible">
                {data?.users
                  .slice()
                  .sort((a, b) => {
                    const aLabel = userMap.get(a.id) || a.email;
                    const bLabel = userMap.get(b.id) || b.email;
                    const order = ["Hafsa", "Asif"];
                    const aIndex = order.indexOf(aLabel);
                    const bIndex = order.indexOf(bLabel);
                    if (aIndex !== -1 || bIndex !== -1) {
                      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
                    }
                    return aLabel.localeCompare(bLabel);
                  })
                  .map((user) => {
                    const label = userMap.get(user.id) || user.email;
                    const email = user.email;
                    const palette = USER_PALETTE[email] || DEFAULT_PALETTE;
                    const personalActive = userFilters[user.id] ?? true;
                    const mobileLabel = label.replace(/\s*\(.*\)\s*/g, "").split(" ")[0];
                    return (
                      <button
                        key={`filters-${user.id}`}
                        type="button"
                        onClick={() => setUserFilters((prev) => ({ ...prev, [user.id]: !personalActive }))}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap md:px-3 md:text-xs",
                          personalActive
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", palette.dotPersonal)} />
                        <span className="md:hidden">{mobileLabel}</span>
                        <span className="hidden md:inline">{label} 💼</span>
                      </button>
                    );
                  })}
                {(data?.work_calendars || [])
                  .slice()
                  .sort((a, b) => {
                    const order = ["hafsa.sayyeda@goodrx.com", "asif@sevensevensix.com"];
                    const aIndex = order.indexOf(a.calendar_id);
                    const bIndex = order.indexOf(b.calendar_id);
                    if (aIndex !== -1 || bIndex !== -1) {
                      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
                    }
                    return (a.summary || a.calendar_id).localeCompare(b.summary || b.calendar_id);
                  })
                  .map((cal) => {
                    const label = getWorkCalendarLabel(cal.calendar_id, cal.summary);
                    const palette = USER_PALETTE[cal.calendar_id] || DEFAULT_PALETTE;
                    const workActive = workFilters[cal.calendar_id] ?? true;
                    const mobileLabel = label
                      .replace(/\s*\(Work\)\s*/g, "")
                      .split(" ")[0];
                    return (
                      <button
                        key={`work-${cal.calendar_id}`}
                        type="button"
                        onClick={() => setWorkFilters((prev) => ({ ...prev, [cal.calendar_id]: !workActive }))}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap md:px-3 md:text-xs",
                          workActive
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", palette.dotWork)} />
                        <span className="md:hidden">
                          {mobileLabel} 💼
                        </span>
                        <span className="hidden md:inline">{label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
          {!isMobile && (
            <TooltipProvider delayDuration={150}>
              <div className="inline-flex scale-[0.92] origin-left md:scale-100">
                {viewOptions.map((option, index) => {
                  const isActive = view === option.value;
                  const isFirst = index === 0;
                  const isLast = index === viewOptions.length - 1;
                  return (
                    <Tooltip key={option.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setView(option.value)}
                          className={cn(
                            "border px-2.5 py-1 text-xs font-semibold transition",
                            isFirst && "rounded-l-md",
                            isLast && "rounded-r-md",
                            !isLast && "border-r-0",
                            isActive
                              ? "border-slate-300 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                          )}
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{option.tooltip}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
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

        {loading && (
          <StateCard title="Loading calendar" description="Hang tight while we pull your events." variant="loading" />
        )}
        {error && (
          <StateCard title="Calendar error" description={error} variant="error" />
        )}
        {/* Hide empty-state card to keep the calendar chrome clean */}

        {!loading && !error && !isMobile && view === "month" && (
          <div className="rounded-xl border border-border/60 bg-background/70 p-2 shadow-sm">
            <div className="grid grid-cols-7 gap-px rounded-lg bg-border/40 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
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
                    role="button"
                    tabIndex={0}
                    onClick={() => openDayView(day)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDayView(day);
                      }
                    }}
                    className={cn(
                      "min-h-[120px] bg-background/80 px-3 py-2 text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

        {!loading && !error && !isMobile && view !== "month" && (
          <div className="space-y-4">
            {weekSections.map((days, sectionIndex) => {
              const stickyHeader = true;
              return (
                <div key={`week-${sectionIndex}`} className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden dark:border-slate-700/70 dark:bg-slate-950">
                  <div
                    className={cn(
                      "grid border-b border-slate-200/70 bg-white text-xs text-slate-500 dark:border-slate-700/70 dark:bg-slate-950 dark:text-slate-300",
                      stickyHeader && "sticky top-0 z-20"
                    )}
                    style={{
                      gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
                      paddingRight: scrollbarWidth ? `${scrollbarWidth}px` : undefined,
                    }}
                  >
                    <div className="px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-500 whitespace-nowrap dark:text-slate-300">GMT-08</div>
                    </div>
                    {days.map((day) => (
                      <div
                        key={`header-${format(day, "yyyy-MM-dd")}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDayView(day)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDayView(day);
                          }
                        }}
                        className={cn(
                          "border-l border-slate-200/70 px-3 py-2 dark:border-slate-700/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isToday(day) && "bg-slate-50 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                          <span className="uppercase tracking-[0.2em]">{format(day, "EEE")}</span>
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold",
                              isToday(day)
                                ? "border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900"
                                : "border-slate-200 dark:border-slate-700 dark:text-slate-200"
                            )}
                          >
                            {format(day, "d")}
                          </div>
                          <span className="text-[11px] font-semibold">{format(day, "MMM")}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="border-b border-slate-200/70 dark:border-slate-700/70"
                    style={{ paddingRight: scrollbarWidth ? `${scrollbarWidth}px` : undefined }}
                  >
                    <div
                      className="grid text-xs text-slate-500 dark:text-slate-300"
                      style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))` }}
                    >
                      <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        All day
                      </div>
                      {days.map((day) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const items = allDayByDay.get(dayKey) || [];
                        return (
                          <div key={`allday-${dayKey}`} className="border-l border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                            <div className="flex flex-col gap-1">
                              {items.slice(0, 3).map((item) => {
                                const palette = getEntryPalette(item);
                                const muted = item.type === "busy" ? "opacity-75" : "";
                                return (
                                  <div
                                    key={`allday-${item.key}`}
                                    className={cn(
                                      "rounded-md border border-slate-200/70 px-2 py-1 text-[11px] font-semibold border-l-[3px] truncate dark:border-slate-700/70",
                                      palette.className,
                                      muted
                                    )}
                                    style={palette.style}
                                  >
                                    {item.title}
                                  </div>
                                );
                              })}
                              {items.length > 3 && (
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">+{items.length - 3} more</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="max-h-[70vh] overflow-auto" ref={sectionIndex == 0 ? scrollRef : undefined}>
                    <div
                      className="relative grid"
                      style={{
                        gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <div
                        className="relative border-r border-slate-200/70 bg-white sticky left-0 z-10 dark:border-slate-700/70 dark:bg-slate-950"
                        style={{ height: HOUR_HEIGHT * hours.length }}
                      >
                        {hours.map((hour) => {
                          const labelTime = addHours(startOfDay(anchorDate), hour);
                          return (
                            <div
                              key={`hour-${hour}-${sectionIndex}`}
                              className="absolute left-0 flex w-full items-start gap-2"
                              style={{ top: (hour - visibleRange.startHour) * HOUR_HEIGHT }}
                            >
                              <div className="absolute left-0 right-0 top-0 border-t border-slate-200/60 dark:border-slate-700/60" />
                              <div className="w-full px-3 text-[11px] font-medium text-slate-500 whitespace-nowrap dark:text-slate-300">
                                {format(labelTime, "h a")}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {days.map((day) => {
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
                            const label =
                              key === "dawn" ? "Dawn" : key === "sunrise" ? "Sunrise" : "Sunset";
                            const timeLabel = format(sunTimes[key], "h:mm a");
                            return (
                              <div key={`${dayKey}-${key}`} className="group">
                                <div
                                  title={`${label} · ${timeLabel}`}
                                  className={cn("absolute left-4 right-4 bg-gradient-to-r", className)}
                                  style={{ top, height: SUN_LINE_HEIGHT }}
                                />
                                <div
                                  className="absolute left-4 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-slate-950 dark:text-slate-300"
                                  style={{ top }}
                                >
                                  {label} · {timeLabel}
                                </div>
                              </div>
                            );
                          });

                        return (
                          <div
                            key={dayKey}
                            className={cn(
                              "relative border-l border-slate-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-950",
                              isToday(day) && "bg-slate-50/70 dark:bg-slate-900/40"
                            )}
                            style={{ height: HOUR_HEIGHT * hours.length }}
                          >
                            {hours.map((hour) => (
                              <div
                                key={`${dayKey}-line-${hour}`}
                                className="absolute left-0 right-0 border-t border-slate-200/60 dark:border-slate-700/60"
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
                                  <div className="absolute left-8 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-red-600 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-slate-950 dark:text-red-400">
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
                              const topBase = ((displayStart - visibleStartMin) / 60) * HOUR_HEIGHT;
                              const heightBase = Math.max(((displayEnd - displayStart) / 60) * HOUR_HEIGHT, 20);
                              const busyPadding = entry.type === "busy" ? 2 : 0;
                              const top = topBase + busyPadding / 2;
                              const height = Math.max(heightBase - busyPadding, 18);
                              const columnWidth = 100 / totalColumns;
                              const left = `calc(${columnWidth * columnIndex}% + ${columnIndex * 6}px + 6px)`;
                              const width = `calc(${columnWidth}% - 12px)`;
                              const durationMinutes = endMin - startMin;
                              const palette = getEntryPalette(entry);
                              const muted = entry.type === "busy" ? "opacity-75" : "";
                              const label = entry.userIds.map((id) => userMap.get(id)).filter(Boolean).join(" + ");
                              return (
                                <HoverCard key={entry.key}>
                                  <HoverCardTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute overflow-hidden rounded-md border border-slate-200/70 px-2 py-1 text-[11px] shadow-sm border-l-[3px] dark:border-slate-700/70",
                                        palette.className,
                                        muted
                                      )}
                                      style={{ top, height, left, width, ...palette.style }}
                                    >
                                      <div className="truncate text-[11px] font-semibold">{entry.title}</div>
                                      {durationMinutes >= 30 && (
                                        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                          {format(entry.startAt, "h:mm a")}–{format(entry.endAt, "h:mm a")}
                                        </div>
                                      )}
                                      {durationMinutes >= 60 && label && (
                                        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
                                      )}
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent align="start" className="w-72 dark:bg-slate-950 dark:border-slate-700">
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {entry.title}
                                        {entry.isRecurring && (
                                          <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {format(entry.startAt, "EEE, MMM d • h:mm a")} – {format(entry.endAt, "h:mm a")}
                                      </div>
                                      {entry.location && (
                                        <div className="text-xs text-slate-600 dark:text-slate-300">Location: {entry.location}</div>
                                      )}
                                      {entry.calendarSummary && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Calendar: {entry.calendarSummary}</div>
                                      )}
                                      {!entry.isWork && label && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">People: {label}</div>
                                      )}
                                      {entry.description && (
                                        <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-4">{entry.description}</div>
                                      )}
                                      {entry.type === "event" && (
                                        <div className="pt-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteEvent(entry.id)}
                                            disabled={deletingEventId === entry.id}
                                          >
                                            {deletingEventId === entry.id ? "Deleting…" : "Delete"}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !error && isMobile && view === "day" && (
          <div className="space-y-3">
            <ToggleGroup
              type="single"
              value={mobilePane}
              onValueChange={(value) => value && setMobilePane(value as "agenda" | "chat")}
              className="flex w-full items-center justify-start gap-1"
            >
              <ToggleGroupItem value="agenda" size="sm" className="flex-1">
                Agenda
              </ToggleGroupItem>
              <ToggleGroupItem value="chat" size="sm" className="flex-1">
                Chat
              </ToggleGroupItem>
            </ToggleGroup>

            {mobilePane === "agenda" ? (
              <div className="rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-950">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Agenda
                </div>
                <div className="mt-3 space-y-2">
                  {(entriesByDay.get(format(anchorDate, "yyyy-MM-dd")) || [])
                    .filter((item) => isSameDay(item.startAt, anchorDate))
                    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
                    .map((item) => {
                      const label = item.isWork
                        ? workCalendarLabelMap.get(item.calendarId) || item.calendarSummary || item.calendarId
                        : item.userIds.map((id) => userMap.get(id)).filter(Boolean).join(" + ");
                      return (
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
                          {label && <div className="text-xs text-muted-foreground">{label}</div>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-950">
                <div className="h-[65vh] overflow-hidden">
                  <ChatPanel onEventCreated={() => setRefreshKey((current) => current + 1)} />
                </div>
              </div>
            )}
          </div>
        )}
            </div>
          </div>
        </div>
        {!isMobile && (
          <>
            <div
              className="relative hidden md:block w-2 bg-border hover:bg-primary/10 transition-colors cursor-col-resize"
              onPointerDown={(event) => {
                if (!isChatPanelOpen) return;
                resizingRef.current = { startX: event.clientX, startWidth: rightPanelWidth };
                const handleMove = (moveEvent: PointerEvent) => {
                  if (!resizingRef.current) return;
                  const delta = moveEvent.clientX - resizingRef.current.startX;
                  const next = resizingRef.current.startWidth - delta;
                  const containerWidth = containerRef.current?.clientWidth || 0;
                  const maxWidth = Math.max(200, containerWidth - 240);
                  setRightPanelWidth(Math.min(Math.max(0, next), maxWidth));
                };
                const handleUp = () => {
                  resizingRef.current = null;
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
              }}
            >
              <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-border/80" />
              <button
                type="button"
                onClick={() => setIsChatPanelOpen((current) => !current)}
                className="absolute left-1/2 top-1/2 flex h-10 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
                aria-label={isChatPanelOpen ? "Hide chat panel" : "Show chat panel"}
              >
                {isChatPanelOpen ? (
                  <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <div
              className={cn("hidden md:block h-full overflow-hidden", !isChatPanelOpen && "w-0")}
              style={{ width: isChatPanelOpen ? `${rightPanelWidth}px` : "0px" }}
            >
              <div className="h-full overflow-hidden p-4">
                <Card className="flex h-full flex-col">
                  <CardContent className="flex-1 overflow-hidden p-0">
                    {isChatPanelOpen && (
                      <ChatPanel onEventCreated={() => setRefreshKey((current) => current + 1)} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
