'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { CalendarHeader } from '@/components/calendar/calendar-header';
import { CalendarView } from '@/components/calendar/calendar-view';
import { EventDialog, type EventFormData } from '@/components/calendar/event-dialog';
import type { CalendarViewMode } from '@/components/calendar/calendar-header';

export default function CalendarPage() {
  const { accountId, profileLoading } = useAuth();
  const supabase = createClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const padStart = new Date(monthStart);
      padStart.setDate(padStart.getDate() - 7);
      const padEnd = new Date(monthEnd);
      padEnd.setDate(padEnd.getDate() + 7);

      const { data, error: queryError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('account_id', accountId)
        .gte('end_at', padStart.toISOString())
        .lte('start_at', padEnd.toISOString())
        .order('start_at', { ascending: true })
        .limit(500);

      if (queryError) throw queryError;
      setEvents((data ?? []) as unknown as CalendarEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [accountId, supabase, currentDate]);

  useEffect(() => {
    if (!profileLoading && accountId) {
      fetchEvents();
    }
  }, [profileLoading, accountId, fetchEvents]);

  const handlePrev = useCallback(() => setCurrentDate((d) => subMonths(d, 1)), []);
  const handleNext = useCallback(() => setCurrentDate((d) => addMonths(d, 1)), []);
  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const handleSelectDate = useCallback((date: Date) => {
    setDefaultDate(date);
    setSelectedEvent(null);
    setDialogOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setDefaultDate(undefined);
    setDialogOpen(true);
  }, []);

  const handleAddEvent = useCallback(() => {
    setSelectedEvent(null);
    setDefaultDate(new Date());
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: EventFormData) => {
      if (!accountId) throw new Error('Not authenticated');

      if (selectedEvent) {
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            title: data.title,
            description: data.description || null,
            location: data.location || null,
            start_at: data.start_at,
            end_at: data.end_at,
            is_all_day: data.is_all_day,
            contact_id: data.contact_id || null,
            color: data.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedEvent.id)
          .eq('account_id', accountId);

        if (updateError) throw updateError;
        toast.success('Event updated');
      } else {
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            account_id: accountId,
            title: data.title,
            description: data.description || null,
            location: data.location || null,
            start_at: data.start_at,
            end_at: data.end_at,
            is_all_day: data.is_all_day,
            contact_id: data.contact_id || null,
            color: data.color,
            sync_status: 'synced',
          });

        if (insertError) throw insertError;
        toast.success('Event created');
      }

      fetchEvents();
    },
    [accountId, selectedEvent, supabase, fetchEvents]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedEvent || !accountId) return;
    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', selectedEvent.id)
      .eq('account_id', accountId);

    if (deleteError) throw deleteError;
    toast.success('Event deleted');
    fetchEvents();
  }, [selectedEvent, accountId, supabase, fetchEvents]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your appointments and sync with Google Calendar.
        </p>
      </div>

      <div className="mt-4">
        <CalendarHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewModeChange={setViewMode}
          onAddEvent={handleAddEvent}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchEvents} className="mt-2 text-sm text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <CalendarView
          currentDate={currentDate}
          viewMode={viewMode}
          events={events}
          onSelectDate={handleSelectDate}
          onSelectEvent={handleSelectEvent}
          onAddEvent={handleAddEvent}
        />
      )}

      <EventDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedEvent(null);
          setDefaultDate(undefined);
        }}
        onSave={handleSave}
        onDelete={selectedEvent ? handleDelete : undefined}
        event={selectedEvent}
        defaultDate={defaultDate}
      />
    </div>
  );
}
