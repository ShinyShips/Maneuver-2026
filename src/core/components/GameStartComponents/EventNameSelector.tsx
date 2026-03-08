import { useState, useEffect } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/core/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog"
import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Check, ChevronsUpDown, Plus, Trash2, Calendar } from "lucide-react"
import { cn } from "@/core/lib/utils"
import { toast } from "sonner"

/**
 * UPDATING EVENTS FOR FUTURE YEARS:
 * 
 * 1. Generate the events JSON file using the Maneuver Event Fetcher utility:
 *    Repository: https://github.com/ShinyShips/Maneuver-utilities/tree/main/event_fetcher
 *    
 *    Quick Start:
 *    - Get a TBA API key from https://www.thebluealliance.com/account
 *    - Set environment variable: export TBA_API_KEY="your_key_here"
 *    - Run: python get_events.py 2027 --save --output events_2027.json
 *    
 *    This will generate a JSON file with format:
 *    [{ "name": "Event Name", "key": "2027code", "week": 0-7 | null }]
 * 
 * 2. Save the JSON file:
 *    - Location: src/core/data/events_YYYY.json
 *    - Current: src/core/data/events_2026.json
 *    - Move the generated file to this directory
 * 
 * 3. Update this file (EventNameSelector.tsx):
 *    - Line ~54: Change import to point to your new file
 *      import eventsYYYY from "@/core/data/events_YYYY.json"
 *    - Line ~56: Update interface name (optional)
 *      interface EventYYYY { name: string; key: string; week: number | null; }
 *    - Line ~63: Update variable name
 *      const officialEvents = eventsYYYY as EventYYYY[];
 * 
 * See src/core/data/README.md for more detailed instructions.
 */
import events2026 from "@/core/data/events_2026.json"

interface Event2026 {
  name: string;
  key: string;
  week: number | null;
}

interface EventNameSelectorProps {
  currentEventKey: string
  onEventKeyChange: (eventKey: string) => void
  showCustomEvents?: boolean // Optional prop to hide custom event functionality
}

export function EventNameSelector({
  currentEventKey,
  onEventKeyChange,
  showCustomEvents = true // Default to true for backward compatibility
}: EventNameSelectorProps) {
  // In development mode, always show custom events for testing
  const isDev = import.meta.env.DEV;
  const allowCustomEvents = showCustomEvents || isDev;
  const [open, setOpen] = useState(false)
  const [customEvents, setCustomEvents] = useState<string[]>([])
  const [newEventName, setNewEventName] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  // Cast the imported JSON to the correct type
  const officialEvents = events2026 as Event2026[];

  // Load custom events from localStorage on component mount
  useEffect(() => {
    const savedCustomEvents = localStorage.getItem("customEventsList")
    const currentEvent = localStorage.getItem("eventKey")

    if (savedCustomEvents) {
      try {
        setCustomEvents(JSON.parse(savedCustomEvents))
      } catch {
        setCustomEvents([])
      }
    }

    // If there's a current event set in localStorage but not passed as prop, update the parent
    if (currentEvent && !currentEventKey) {
      onEventKeyChange(currentEvent)
    }
  }, [currentEventKey, onEventKeyChange])

  const saveEvent = (eventKey: string, eventName?: string) => {
    if (!eventKey.trim()) return

    const trimmedKey = eventKey.trim()

    // If it's a custom event (not in official list), add to custom events
    const isOfficial = officialEvents.some(e => e.key === trimmedKey)
    if (!isOfficial && !customEvents.includes(trimmedKey)) {
      const updatedCustom = [...customEvents, trimmedKey].sort()
      setCustomEvents(updatedCustom)
      localStorage.setItem("customEventsList", JSON.stringify(updatedCustom))
    }

    // Always set as current event
    onEventKeyChange(trimmedKey)
    localStorage.setItem("eventKey", trimmedKey)

    setOpen(false)
    setShowAddForm(false)
    setNewEventName("")

    const displayName = eventName || trimmedKey
    toast.success(`Event set to: ${displayName}`)
  }

  const removeCustomEvent = (eventKey: string) => {
    const updatedList = customEvents.filter(e => e !== eventKey)
    setCustomEvents(updatedList)
    localStorage.setItem("customEventsList", JSON.stringify(updatedList))

    if (currentEventKey === eventKey) {
      onEventKeyChange("")
      localStorage.removeItem("eventKey")
    }

    toast.success(`Removed custom event: ${eventKey}`)
  }

  const handleAddNewEvent = () => {
    if (newEventName.trim()) {
      saveEvent(newEventName)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
          role="combobox"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {currentEventKey || "Select event..."}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </DialogTrigger>
      <DialogContent className="p-0 max-w-75">
        <DialogTitle className="sr-only">Select Event</DialogTitle>
        <DialogDescription className="sr-only">
          Search and select an official 2026 FRC event or add a custom event
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Search events..." />
          <CommandEmpty>
            <div className="text-center p-4">
              <p className="text-sm text-muted-foreground mb-2">No events found</p>
              {allowCustomEvents && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Event
                </Button>
              )}
            </div>
          </CommandEmpty>
          <CommandList>
            {/* Add New Custom Event - At Top */}
            {allowCustomEvents && !showAddForm && (
              <CommandGroup>
                <CommandItem onSelect={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Custom Event
                </CommandItem>
              </CommandGroup>
            )}

            {allowCustomEvents && showAddForm && (
              <CommandGroup>
                <div className="p-2 space-y-2">
                  <Input
                    placeholder="Enter event key (e.g., 2026practice)..."
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddNewEvent()
                      } else if (e.key === "Escape") {
                        setShowAddForm(false)
                        setNewEventName("")
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={handleAddNewEvent}
                      className="flex-1"
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewEventName("")
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CommandGroup>
            )}

            {/* Official 2026 Events */}
            <CommandGroup heading="Official 2026 Events">
              {officialEvents.map((event) => {
                const displayName = `${event.name} (${event.key})${event.week !== null ? ` - Week ${event.week}` : ''}`
                return (
                  <CommandItem
                    key={event.key}
                    value={displayName}
                    onSelect={() => saveEvent(event.key, event.name)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentEventKey === event.key ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{event.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.week !== null && (
                        <span className="text-xs text-muted-foreground">W{event.week}</span>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">{event.key}</span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>

            {/* Custom Events */}
            {allowCustomEvents && customEvents.length > 0 && (
              <CommandGroup heading="Custom Events">
                {customEvents.map((eventKey) => (
                  <CommandItem
                    key={eventKey}
                    value={eventKey}
                    onSelect={() => saveEvent(eventKey)}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentEventKey === eventKey ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {eventKey}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCustomEvent(eventKey)
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
