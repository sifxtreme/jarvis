import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfDay, parseISO, isToday } from 'date-fns';
import { getCalendarOverview, deleteCalendarEvent, updateCalendarEvent, type CalendarItem, type CalendarOverviewResponse } from '../../src/lib/api';
import { useColors } from '../../src/lib/theme';
import { EventEmitter } from '../../src/lib/events';

// Color palette per user — personal vs work
const USER_PALETTE: Record<string, { personal: string; work: string }> = {
  'asif.h.ahmed@gmail.com': { personal: '#a855f7', work: '#0ea5e9' },
  'hsayyeda@gmail.com': { personal: '#f59e0b', work: '#10b981' },
};
const DEFAULT_COLOR = '#3b82f6';

function getEventColor(item: CalendarItem, users: { id: number; email: string }[]): string {
  const user = users.find((u) => u.id === item.user_id);
  const email = user?.email || '';
  const palette = USER_PALETTE[email];
  if (!palette) return DEFAULT_COLOR;
  const isWork = item.calendar_summary?.toLowerCase().includes('work') || item.busy_only;
  return isWork ? palette.work : palette.personal;
}

function formatEventTime(startAt: string, endAt: string): string {
  const start = parseISO(startAt);
  const end = parseISO(endAt);
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours >= 23) return 'All Day';
  return `${format(start, 'h:mm a')} — ${format(end, 'h:mm a')}`;
}

function EventCard({ event, colors, eventColor, onDelete, onEditTitle }: {
  event: CalendarItem;
  colors: ReturnType<typeof useColors>;
  eventColor: string;
  onDelete: (id: number) => void;
  onEditTitle: (id: number, title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title || '');
  const timeStr = formatEventTime(event.start_at, event.end_at);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== event.title) {
      onEditTitle(event.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.eventStripe, { backgroundColor: eventColor }]} />
      <View style={styles.eventContent}>
        {isEditing ? (
          <TextInput
            style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
            value={editTitle}
            onChangeText={setEditTitle}
            onBlur={handleSaveTitle}
            onSubmitEditing={handleSaveTitle}
            autoFocus
          />
        ) : (
          <TouchableOpacity onLongPress={() => setIsEditing(true)}>
            <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
              {event.title || (event.busy_only ? 'Busy' : 'Untitled Event')}
              {event.is_recurring && <Text style={{ color: colors.mutedForeground }}> ↻</Text>}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>{timeStr}</Text>
        {event.location && (
          <View style={styles.eventMeta}>
            <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        )}
        {event.description && (
          <Text style={[styles.descriptionText, { color: colors.mutedForeground }]} numberOfLines={2}>
            {event.description}
          </Text>
        )}
        {event.calendar_summary && (
          <Text style={[styles.calendarName, { color: eventColor }]} numberOfLines={1}>
            {event.calendar_summary}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert('Delete Event', `Delete "${event.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(event.id) },
          ]);
        }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
      </TouchableOpacity>
    </View>
  );
}

// Filter chip component
function FilterChip({ label, active, color, onPress, colors }: {
  label: string; active: boolean; color: string;
  onPress: () => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? color : colors.border, backgroundColor: active ? color + '20' : 'transparent' }]}
    >
      <View style={[styles.chipDot, { backgroundColor: color, opacity: active ? 1 : 0.3 }]} />
      <Text style={[styles.chipText, { color: active ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CalendarScreen() {
  const colors = useColors();
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [userFilters, setUserFilters] = useState<Record<number, boolean>>({});
  const [workFilters, setWorkFilters] = useState<Record<string, boolean>>({});

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const isCurrentDay = isToday(currentDate);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['calendar', 'day', dateStr],
    queryFn: () => getCalendarOverview('day', dateStr),
    retry: 2,
  });

  const calendarData: CalendarOverviewResponse = data || { window: { start_at: '', end_at: '' }, users: [], items: [] };
  const { users, work_calendars, items } = calendarData;

  // Initialize filters when users load
  useEffect(() => {
    if (users?.length && Object.keys(userFilters).length === 0) {
      const initial: Record<number, boolean> = {};
      users.forEach((u) => { initial[u.id] = true; });
      setUserFilters(initial);
    }
  }, [users]);

  useEffect(() => {
    if (work_calendars?.length && Object.keys(workFilters).length === 0) {
      const initial: Record<string, boolean> = {};
      work_calendars.forEach((wc) => { initial[wc.calendar_id] = true; });
      setWorkFilters(initial);
    }
  }, [work_calendars]);

  useEffect(() => {
    return EventEmitter.on('calendar-changed', () => refetch());
  }, [refetch]);

  // Deduplicate events with same event_uid across users
  const deduplicatedEvents = useMemo(() => {
    const byUid = new Map<string, CalendarItem & { userIds: number[] }>();
    (items || []).forEach((item) => {
      const key = item.event_uid || `${item.id}`;
      if (byUid.has(key)) {
        byUid.get(key)!.userIds.push(item.user_id);
      } else {
        byUid.set(key, { ...item, userIds: [item.user_id] });
      }
    });
    return Array.from(byUid.values());
  }, [items]);

  // Apply user/work filters
  const filteredEvents = useMemo(() => {
    return deduplicatedEvents.filter((event) => {
      // Check if any of the event's users are enabled
      const anyUserEnabled = event.userIds.some((uid) => userFilters[uid] !== false);
      if (!anyUserEnabled) return false;
      // Check work calendar filter
      if (event.calendar_id && workFilters[event.calendar_id] === false) return false;
      return true;
    });
  }, [deduplicatedEvents, userFilters, workFilters]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aDuration = (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / (1000 * 60 * 60);
      const bDuration = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / (1000 * 60 * 60);
      if (aDuration >= 23 && bDuration < 23) return -1;
      if (bDuration >= 23 && aDuration < 23) return 1;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
  }, [filteredEvents]);

  const handleDelete = async (id: number) => {
    try {
      await deleteCalendarEvent(id);
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  const handleEditTitle = async (id: number, title: string) => {
    try {
      await updateCalendarEvent(id, { title });
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to update event');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Build filter chips
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; color: string; active: boolean; onPress: () => void }[] = [];
    (users || []).forEach((user) => {
      const palette = USER_PALETTE[user.email];
      chips.push({
        key: `user-${user.id}`,
        label: user.email.split('@')[0],
        color: palette?.personal || DEFAULT_COLOR,
        active: userFilters[user.id] !== false,
        onPress: () => setUserFilters((prev) => ({ ...prev, [user.id]: !prev[user.id] })),
      });
    });
    (work_calendars || []).forEach((wc) => {
      chips.push({
        key: `work-${wc.calendar_id}`,
        label: wc.summary || 'Work',
        color: '#0ea5e9',
        active: workFilters[wc.calendar_id] !== false,
        onPress: () => setWorkFilters((prev) => ({ ...prev, [wc.calendar_id]: !prev[wc.calendar_id] })),
      });
    });
    return chips;
  }, [users, work_calendars, userFilters, workFilters]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Date Navigation */}
      <View style={[styles.dateNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setCurrentDate(subDays(currentDate, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(startOfDay(new Date()))} style={styles.dateCenter}>
          <Text style={[styles.dateText, { color: colors.foreground }, isCurrentDay && { color: colors.primary }]}>
            {format(currentDate, 'EEEE, MMM d')}
          </Text>
          {isCurrentDay && <Text style={[styles.todayBadge, { color: colors.primary }]}>Today</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {filterChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filterChips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} active={chip.active} color={chip.color} onPress={chip.onPress} colors={colors} />
          ))}
        </ScrollView>
      )}

      {/* Events List */}
      {isLoading && !items?.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => `${item.id}-${item.event_uid || ''}`}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              colors={colors}
              eventColor={getEventColor(item, users || [])}
              onDelete={handleDelete}
              onEditTitle={handleEditTitle}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No events today</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  navBtn: { padding: 8 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: '700' },
  todayBadge: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 10, paddingBottom: 100 },
  eventCard: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  eventStripe: { width: 3 },
  eventContent: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  eventTitle: { fontSize: 14, fontWeight: '600' },
  editInput: { fontSize: 15, fontWeight: '600', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  eventTime: { fontSize: 12 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventMetaText: { fontSize: 11, flex: 1 },
  descriptionText: { fontSize: 11, marginTop: 1 },
  calendarName: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  deleteButton: { padding: 12, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },
});
