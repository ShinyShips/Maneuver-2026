import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "maneuver-2026";
import { ChevronDown } from "lucide-react";

export function MatchHistory() {
  return (
    <Collapsible defaultOpen className="w-80 rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
        Show match history — Team 3314
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Qualification 42</span>
          <span>Won · 14 coral</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Qualification 37</span>
          <span>Lost · 9 coral</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Qualification 29</span>
          <span>Won · 17 coral</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
