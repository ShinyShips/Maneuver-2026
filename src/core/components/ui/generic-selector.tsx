import { Button } from "@/core/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/core/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/core/components/ui/sheet";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useIsMobile } from "@/core/hooks/use-mobile";
import { cn } from "@/core/lib/utils";

interface GenericSelectorBaseProps {
  label: string;
  availableOptions: string[];
  placeholder?: string;
  displayFormat?: (value: string) => string;
  buttonDisplayFormat?: (value: string) => string;
  className?: string;
}

interface GenericSingleSelectorProps extends GenericSelectorBaseProps {
  multiSelect?: false;
  value: string;
  onValueChange: (value: string) => void;
}

interface GenericMultiSelectorProps extends GenericSelectorBaseProps {
  multiSelect: true;
  values: string[];
  onValuesChange: (values: string[]) => void;
}

type GenericSelectorProps = GenericSingleSelectorProps | GenericMultiSelectorProps;

function toggleMultiSelection(currentValues: string[], nextValue: string): string[] {
  if (nextValue === "all") {
    return ["all"];
  }

  const withoutAll = currentValues.filter((value) => value !== "all");

  let updatedValues: string[];
  if (withoutAll.includes(nextValue)) {
    updatedValues = withoutAll.filter((value) => value !== nextValue);
  } else {
    updatedValues = [...withoutAll, nextValue];
  }

  // Keep at least one selection to avoid inconsistent empty-state UI.
  return updatedValues.length === 0 ? ["all"] : updatedValues;
}

export const GenericSelector = (props: GenericSelectorProps) => {
  const {
    label,
    availableOptions,
    placeholder = "Select option",
    displayFormat = (val) => val,
    buttonDisplayFormat,
    className = "",
  } = props;

  const isMobile = useIsMobile();
  const isMultiSelect = props.multiSelect === true;
  const selectedValues = isMultiSelect ? props.values : [props.value || ""];

  const getDisplayText = (val: string) => {
    if (!val) return placeholder;
    if (val === "none") return buttonDisplayFormat ? buttonDisplayFormat(val) : "None";
    if (val === "all") return buttonDisplayFormat ? buttonDisplayFormat(val) : "All";
    return buttonDisplayFormat ? buttonDisplayFormat(val) : displayFormat(val);
  };

  const getMultiDisplayText = (values: string[]) => {
    if (values.length === 0) return placeholder;
    if (values.includes("all")) return getDisplayText("all");
    if (values.length === 1) return getDisplayText(values[0] || "");
    return `${values.length} selected`;
  };

  if (isMultiSelect) {
    const onToggleValue = (nextValue: string) => {
      props.onValuesChange(toggleMultiSelection(props.values, nextValue));
    };

    if (isMobile) {
      return (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className={`w-full justify-between h-9 ${className}`}>
              <span className="truncate">{getMultiDisplayText(selectedValues)}</span>
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col rounded-t-3xl border-border bg-background overflow-hidden">
            <div className="px-6 pt-5 pb-1">
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">{label}</SheetTitle>
                <SheetDescription className="sr-only">
                  Choose one or more options for {label}.
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 mt-3">
              <div className="space-y-2">
                {availableOptions.map((option) => {
                  const selected = selectedValues.includes(option);
                  const buttonLabel = displayFormat(option);

                  return (
                    <Button
                      key={option}
                      variant="outline"
                      className={cn(
                        "w-full justify-between h-14 px-5 text-base font-medium rounded-xl border-border transition-all text-left",
                        selected
                          ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                      )}
                      onClick={() => onToggleValue(option)}
                    >
                      <span className="truncate">{buttonLabel}</span>
                      {selected && <CheckIcon className="h-4 w-4" />}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="border-t px-5 py-4">
              <SheetClose asChild>
                <Button className="w-full">Done</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`w-full justify-between h-9 ${className}`}>
            <span className="truncate">{getMultiDisplayText(selectedValues)}</span>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <div className="max-h-72 overflow-y-auto space-y-1">
            {availableOptions.map((option) => {
              const selected = selectedValues.includes(option);
              const optionLabel = displayFormat(option);

              return (
                <Button
                  key={option}
                  variant="ghost"
                  className={cn("w-full justify-between px-3", selected && "bg-muted")}
                  onClick={() => onToggleValue(option)}
                >
                  <span className="truncate">{optionLabel}</span>
                  {selected && <CheckIcon className="h-4 w-4" />}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const singleValue = props.value;

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className={`w-full justify-between h-9 ${className}`}>
            <span className="truncate">{getDisplayText(singleValue)}</span>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col rounded-t-3xl border-border bg-background overflow-hidden">
          <div className="px-6 pt-5 pb-1">
            <SheetHeader className="text-left">
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground">{label}</SheetTitle>
              <SheetDescription className="sr-only">Choose an option for {label}.</SheetDescription>
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
                      singleValue === "none"
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => props.onValueChange("none")}
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
                      singleValue === "all"
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => props.onValueChange("all")}
                  >
                    {displayFormat("all")}
                  </Button>
                </SheetClose>
              )}
              {availableOptions.filter((option) => option !== "all" && option !== "none").map((option) => (
                <SheetClose key={option} asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start h-14 px-5 text-base font-medium rounded-xl border-border transition-all text-left",
                      singleValue === option
                        ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 dark:bg-muted/10 dark:text-muted-foreground"
                    )}
                    onClick={() => props.onValueChange(option)}
                  >
                    {String(option).match(/^\d+$/) && !displayFormat(String(option)).includes("Team")
                      ? `Team ${displayFormat(String(option))}`
                      : displayFormat(option)}
                  </Button>
                </SheetClose>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Select value={singleValue || "none"} onValueChange={props.onValueChange}>
      <SelectTrigger className={`h-9 w-full ${className}`}>
        <span className="truncate">{getDisplayText(singleValue)}</span>
      </SelectTrigger>
      <SelectContent>
        {availableOptions.includes("none") && <SelectItem value="none">{displayFormat("none")}</SelectItem>}
        {availableOptions.includes("all") && <SelectItem value="all">{displayFormat("all")}</SelectItem>}
        {availableOptions.filter((option) => option !== "all" && option !== "none").map((option) => (
          <SelectItem key={option} value={option}>
            {displayFormat(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
