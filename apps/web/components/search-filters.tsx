"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  agentType?: string;
  projectPath?: string;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  agentTypes?: string[];
}

export function SearchFiltersComponent({
  filters,
  onFiltersChange,
  agentTypes = [],
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.agentType ||
    filters.projectPath;

  const handleApply = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleClear = () => {
    const emptyFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const handleReset = () => {
    setLocalFilters(filters);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="default"
          className="gap-2 h-10 shadow-none"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs">
              {Object.keys(filters).length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Advanced Filters</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-auto p-1 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={localFilters.dateFrom || ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dateFrom: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={localFilters.dateTo || ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dateTo: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Agent Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="agentType" className="text-sm font-medium">
              Agent Type
            </Label>
            <Select
              value={localFilters.agentType || "all"}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  agentType: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger id="agentType" className="h-9">
                <SelectValue placeholder="All agent types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agent types</SelectItem>
                {agentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Path Filter */}
          <div className="space-y-2">
            <Label htmlFor="projectPath" className="text-sm font-medium">
              Project Path
            </Label>
            <Input
              id="projectPath"
              type="text"
              placeholder="e.g., /path/to/project"
              value={localFilters.projectPath || ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, projectPath: e.target.value })
              }
              className="h-9 text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex-1"
            >
              Reset
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
