'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onAddEvent: () => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  onAddEvent,
}: CalendarHeaderProps) {
  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={onPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNext}>
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold ml-2">{monthYear}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
          {(['month', 'week', 'day'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onViewModeChange(m)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onAddEvent}>
          <Plus className="size-3.5 mr-1" />
          Add Event
        </Button>
      </div>
    </div>
  );
}
