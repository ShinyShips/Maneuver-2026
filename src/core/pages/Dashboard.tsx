import { AppSidebar } from "@/core/components/dashboard/app-sidebar"
import { SiteHeader } from "@/core/components/dashboard/site-header"
import { BottomNavigation } from "@/core/components/BottomNavigation"
import { ScrollToTop } from "@/core/components/ScrollToTop"
import {
    SidebarInset,
    SidebarProvider,
} from "@/core/components/ui/sidebar"

import { Outlet } from "react-router-dom"



export default function Dashboard() {
    return (
        <SidebarProvider
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <ScrollToTop />
                <div
                    className="2xl:pb-0 !2xl:pt-0"
                >
                    <Outlet />
                </div>
                <BottomNavigation />
            </SidebarInset>
        </SidebarProvider>
    )
}
