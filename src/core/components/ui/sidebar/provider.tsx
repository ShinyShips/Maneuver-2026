import * as React from "react"
import { TooltipProvider } from "../tooltip"
import { useIsMobile } from "@/core/hooks/use-mobile"
import { cn } from "@/core/lib/utils"
import { SidebarContext, type SidebarContextProps } from "./context"
import { SwipeToOpenDetector, MobileOverlay } from "./touch-handlers"
import {
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from "./constants"

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Prevent body scroll and touch behaviors when sidebar is open (below 2xl breakpoint)
  React.useEffect(() => {
    const checkAndApplyScrollLock = () => {
      // Check if we're below 2xl breakpoint (1536px) - same as useIsMobile
      const isBelow2xlBreakpoint = window.innerWidth < 1536

      if (isBelow2xlBreakpoint && openMobile) {
        // Store original styles
        const originalOverflow = document.body.style.overflow
        const originalTouchAction = document.body.style.touchAction
        const originalPosition = document.body.style.position

        // Apply lock styles
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
        document.body.style.position = 'fixed'
        document.body.style.width = '100%'

        // Return cleanup function
        return () => {
          document.body.style.overflow = originalOverflow
          document.body.style.touchAction = originalTouchAction
          document.body.style.position = originalPosition
          document.body.style.width = ''
        }
      }

      return undefined
    }

    // Apply immediately
    const cleanup = checkAndApplyScrollLock()

    // Listen for resize events to recheck breakpoint
    const handleResize = () => {
      // Clean up previous state
      if (cleanup) cleanup()
      // Reapply based on new window size
      checkAndApplyScrollLock()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (cleanup) cleanup()
    }
  }, [openMobile])

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper h-full has-data-[variant=inset]:bg-sidebar flex min-h-auto overflow-auto w-full",
            className
          )}
          {...props}
        >
          {/* Swipe-to-open detector when sidebar is closed (below 2xl breakpoint) */}
          {!openMobile && (
            <SwipeToOpenDetector onOpen={() => setOpenMobile(true)} />
          )}
          {/* Mobile/Tablet/Desktop (below 2xl) backdrop/overlay with drag support */}
          {openMobile && (
            <MobileOverlay onClose={() => setOpenMobile(false)} />
          )}
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}
