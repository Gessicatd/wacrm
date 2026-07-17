'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { EventCard } from './event-card';
import type { CalendarViewMode } from './calendar-header';

interface CalendarViewProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  currentDate,
  events,
  onSelectDate,
  onSelectEvent,
}: CalendarViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(new Date(event.start_at), 'yyyy-MM-dd');
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  return (
    <div className="mt-4 rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) ?? [];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                'min-h-[100px] border-r border-b border-border p-1.5 text-left transition-colors hover:bg-muted/30',
                !isCurrentMonth && 'bg-muted/20',
                idx % 7 === 6 && 'border-r-0'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-medium flex size-6 items-center justify-center rounded-full',
                    isCurrentDay
                      ? 'bg-primary text-primary-foreground'
                      : isCurrentMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && !isCurrentDay && (
                  <span className="text-[10px] text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    compact
                  />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground pl-1.5">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
