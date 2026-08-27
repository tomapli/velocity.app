"use client";

import { ArrowDownUp, Download, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IG_MEDIA_TYPES } from "@/lib/ig/constants";
import {
  getIgPostSortOptions,
  MEDIA_TYPE_LABELS,
  type IgMediaType,
  type IgPostSortKey,
  type IgScrapeDataSource,
} from "@/lib/ig/metrics";

interface IgPostsToolbarProps {
  mediaTypes: IgMediaType[];
  dataSource?: IgScrapeDataSource;
  onMediaTypesChange: (mediaTypes: IgMediaType[]) => void;
  sortKey: IgPostSortKey;
  sortDirection: "asc" | "desc";
  onSortKeyChange: (key: IgPostSortKey) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  onRescan: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
  isRescanning: boolean;
}

/**
 * Filter, sort, export, and rescan controls for the Instagram results table.
 */
export function IgPostsToolbar({
  mediaTypes,
  dataSource,
  onMediaTypesChange,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange,
  onRescan,
  onExport,
  canExport,
  isExporting,
  isRescanning,
}: IgPostsToolbarProps) {
  const sortOptions = getIgPostSortOptions(dataSource);
  const sortLabel =
    sortOptions.find((option) => option.key === sortKey)?.label ?? "Sort";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={0}
        value={mediaTypes}
        onValueChange={(value) => onMediaTypesChange(value as IgMediaType[])}
        aria-label="Filter by media type"
      >
        {IG_MEDIA_TYPES.map((mediaType) => (
          <ToggleGroupItem key={mediaType} value={mediaType} aria-label={`${MEDIA_TYPE_LABELS[mediaType]}s`}>
            {`${MEDIA_TYPE_LABELS[mediaType]}s`}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ArrowDownUp />
              {sortLabel}
              <span className="text-muted-foreground">
                {sortDirection === "desc" ? "↓" : "↑"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortKey}
              onValueChange={(value) => onSortKeyChange(value as IgPostSortKey)}
            >
              {sortOptions.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Direction</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortDirection}
              onValueChange={(value) => onSortDirectionChange(value as "asc" | "desc")}
            >
              <DropdownMenuRadioItem value="desc">Newest / highest</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="asc">Oldest / lowest</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={!canExport || isExporting}
        >
          {isExporting ? <LoaderCircle className="animate-spin" /> : <Download />}
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
        <Button type="button" size="sm" onClick={onRescan} disabled={isRescanning}>
          <RefreshCw />
          {isRescanning ? "Scheduling…" : "Rescan"}
        </Button>
      </div>
    </div>
  );
}
