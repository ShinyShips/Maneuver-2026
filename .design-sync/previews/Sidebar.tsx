import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
} from "maneuver-2026";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Wrench,
  RadioTower,
} from "lucide-react";

// collapsible="none" is used deliberately: Sidebar's default responsive
// variants only render below-2xl (fixed, off-canvas, translate-x-full until
// openMobile is toggled by user interaction) or hidden below the 2xl
// breakpoint (>=1536px) on desktop. Neither is reachable in a static preview
// card, so the "always-visible column" collapsible mode is the realistic way
// to show a real app shell.
export function AppShell() {
  return (
    <SidebarProvider className="h-[500px] w-full overflow-hidden rounded-lg border">
      <Sidebar collapsible="none" className="border-r">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              M
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Maneuver</span>
              <span className="text-xs text-sidebar-foreground/70">
                2026 Reefscape
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Scouting</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Scout Match">
                    <ClipboardList />
                    <span>Scout Match</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Pit Scouting">
                    <Wrench />
                    <span>Pit Scouting</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Analysis</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Team Stats">
                    <BarChart3 />
                    <span>Team Stats</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Data Transfer">
                    <RadioTower />
                    <span>Data Transfer</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">
              JD
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium">Jamie Diaz</span>
              <span className="text-xs text-sidebar-foreground/70">
                Scout &middot; Team 3314
              </span>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <span className="text-sm font-medium">Match 42 &mdash; Qualification</span>
        </header>
        <div className="flex-1 p-4 text-sm text-muted-foreground">
          Select a match from the schedule to begin scouting.
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
