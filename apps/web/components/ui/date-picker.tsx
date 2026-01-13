"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9 border-gray-300 hover:bg-gray-50",
            !value && "text-gray-600",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-gray-300 shadow-none" align="start" side="bottom" sideOffset={4}>
        <DayPicker
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className="p-2"
          style={{ fontSize: '0.875rem' }}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-2 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center mb-2",
            caption_label: "text-sm font-medium text-black",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-gray-50 rounded"
            ),
            nav_button_previous: "hidden",
            nav_button_next: "hidden",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-gray-600 rounded-md w-7 font-normal text-xs",
            row: "flex w-full mt-1",
            cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-gray-50 [&:has([aria-selected].day-outside)]:text-gray-600 [&:has([aria-selected])]:bg-gray-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              "h-7 w-7 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-50 rounded text-xs"
            ),
            day_selected: "bg-black text-white hover:bg-black hover:text-white focus:bg-black focus:text-white",
            day_today: "bg-gray-100 text-black font-semibold",
            day_outside: "day-outside text-gray-600 opacity-50 aria-selected:bg-gray-50 aria-selected:text-gray-600 aria-selected:opacity-30",
            day_disabled: "text-gray-600 opacity-50",
            day_range_middle: "aria-selected:bg-gray-50 aria-selected:text-black",
            day_hidden: "invisible",
          }}
          components={{
            Chevron: () => <CalendarIcon className="h-4 w-4" />,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
