import { Button } from "@/core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/core/components/ui/sheet";
import { ChevronDownIcon } from "lucide-react";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { cn } from "@/core/lib/utils";

interface GenericSelectorProps {
  label: string;
  value: string;
  availableOptions: string[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  displayFormat?: (value: string) => string;
  buttonDisplayFormat?: (value: string) => string;
  className?: string;
}

export const GenericSelector = ({
  label,
  value,
  availableOptions,
  onValueChange,
  placeholder = "Select option",
  displayFormat = (val) => val,
  buttonDisplayFormat,
  className = ""
}: GenericSelectorProps) => {
  const isMobile = useIsMobile();

  const getDisplayText = (val: string) => {
    if (!val) return placeholder;
    if (val === "none") return buttonDisplayFormat ? buttonDisplayFormat(val) : "None";
    if (val === "all") return "All events";
    return buttonDisplayFormat ? buttonDisplayFormat(val) : displayFormat(val);
  };

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between h-10 ${className}`}
          >
            <span className="truncate">
              {getDisplayText(value)}
            </span>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col rounded-t-3xl border-border bg-background overflow-hidden">
          <div className="px-6 pt-5 pb-1">
            <SheetHeader className="text-left">
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground">{label}</SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-10 mt-3">
            <div className="space-y-2">
              {availableOptions.includes("none") && (
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start h-14 px-5 text-base font-medium rounded-xl border-border transition-all text-left",
                      value === "none"
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => onValueChange("none")}
                  >
                    {displayFormat("none") === "none" ? "No team" : displayFormat("none")}
                  </Button>
                </SheetClose>
              )}
              {availableOptions.includes("all") && (
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start h-14 px-5 text-base font-medium rounded-xl border-border transition-all text-left",
                      value === "all"
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => onValueChange("all")}
                  >
                    All events
                  </Button>
                </SheetClose>
              )}
              {availableOptions.filter(option => option !== "all" && option !== "none").map((option) => (
                <SheetClose key={option} asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start h-14 px-5 text-base font-medium rounded-xl border-border transition-all text-left",
                      value === option
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => onValueChange(option)}
                  >
                    {/* Prefix with "Team " if it looks like a team number and not already formatted */}
                    {String(option).match(/^\d+$/) && !displayFormat(String(option)).includes("Team")
                      ? `Team ${displayFormat(String(option))}`
                      : displayFormat(String(option))}
                  </Button>
                </SheetClose>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop version
  return (
    <Select
      value={value || "none"}
      onValueChange={onValueChange}
    >
      <SelectTrigger className={`h-10 w-full ${className}`}>
        <span className="truncate">
          {getDisplayText(value)}
        </span>
      </SelectTrigger>
      <SelectContent>
        {availableOptions.includes("none") && <SelectItem value="none">{displayFormat("none")}</SelectItem>}
        {availableOptions.includes("all") && <SelectItem value="all">All events</SelectItem>}
        {availableOptions.filter(option => option !== "all" && option !== "none").map((option) => (
          <SelectItem key={option} value={option}>
            {displayFormat(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
