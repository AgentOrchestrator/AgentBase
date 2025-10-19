"use client";

import * as React from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(value || new Date());
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    onChange?.(date);
    if (date) {
      setCurrentMonth(date);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9 border-border hover:bg-accent",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border shadow-none" align="start" side="bottom" sideOffset={4}>
        <div className="p-2">
          {/* Navigation Header */}
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousMonth}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Calendar */}
          <DayPicker
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            initialFocus
            style={{ fontSize: '0.875rem' }}
             classNames={{
               months: "flex flex-col sm:flex-row space-y-2 sm:space-x-4 sm:space-y-0",
               month: "space-y-2",
               caption: "hidden", // Hide the default caption since we have our own
               caption_label: "hidden", // Hide the default caption label
               nav: "hidden", // Hide the entire nav section
               nav_button: "hidden", // Hide default nav buttons
               nav_button_previous: "hidden",
               nav_button_next: "hidden",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-7 font-normal text-xs",
              row: "flex w-full mt-1",
              cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent [&:has([aria-selected].day-outside)]:text-muted-foreground [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: cn(
                "h-7 w-7 p-0 font-normal aria-selected:opacity-100 hover:bg-accent rounded text-xs"
              ),
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-foreground font-semibold",
              day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent aria-selected:text-muted-foreground aria-selected:opacity-30",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-foreground",
              day_hidden: "invisible",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
