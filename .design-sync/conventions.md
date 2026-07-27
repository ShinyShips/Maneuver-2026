## Maneuver UI — conventions

Maneuver's component kit is shadcn/ui on Tailwind v4 (CSS-first — tokens are real CSS custom properties, not a JS config). Build with the real components below; style layout glue with the same token vocabulary the components themselves use.

### Styling idiom: semantic Tailwind utilities, not raw colors

Every component is styled with Tailwind utility classes bound to **semantic color tokens** — never raw palette utilities like `bg-blue-500`. Use this family for any layout/wrapper `className` you add:

| Utility | Token | Use for |
|---|---|---|
| `bg-background` / `text-foreground` | `--background` / `--foreground` | page/app background |
| `bg-card` / `text-card-foreground` | `--card` | card surfaces |
| `bg-primary` / `text-primary-foreground` | `--primary` | primary actions |
| `bg-secondary` / `text-secondary-foreground` | `--secondary` | secondary actions |
| `bg-muted` / `text-muted-foreground` | `--muted` | de-emphasized text/surfaces |
| `bg-accent` / `text-accent-foreground` | `--accent` | hover/highlight states |
| `bg-destructive` | `--destructive` | delete/danger actions |
| `border-border` / `border-input` | `--border` / `--input` | borders, form field outlines |
| `ring-ring` | `--ring` | focus rings |
| `bg-sidebar*` | `--sidebar*` | sidebar-specific surfaces (separate palette from `card`) |
| `bg-chart-1` … `bg-chart-5` | `--chart-1..5` | chart series colors (see `Chart`) |

Radius: `rounded-sm/md/lg/xl` map to `--radius` (0.625rem base), not arbitrary values. Font: `font-sans` (and the default body font) is **Titillium Web** — do not introduce another font family.

### Dark mode

Toggling dark mode is a `.dark` class on an ancestor element (`next-themes`-style), not a prop. All the tokens above are redefined under `.dark` — components need no dark-specific styling of their own.

### Provider requirements

Most components (`Button`, `Card`, `Badge`, `Input`, form controls, etc.) need no wrapper — they're self-contained. Two exceptions:

- **`Sidebar` and its sub-parts** (`SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarGroup`, `SidebarMenu*`, `SidebarTrigger`, `SidebarInset`, `SidebarRail`, …) all read from context and **will not render without `<SidebarProvider>`** wrapping them. Standard shape: `<SidebarProvider><Sidebar>…groups/menu…</Sidebar><SidebarInset>…main content…</SidebarInset></SidebarProvider>`. Note `Sidebar`'s default responsive behavior only shows a visible column above the 2xl breakpoint — pass `collapsible="none"` for a layout that's always a visible column regardless of viewport width.
- **`Tooltip`** wraps itself in `TooltipProvider` internally — no external provider needed, just use `Tooltip`/`TooltipTrigger`/`TooltipContent` directly.

Overlay components (`Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Select`) are Radix primitives with real open/close state — build them exactly as they render normally (trigger + content), no special handling needed in your own designs.

### Where the truth lives

Read the bound `styles.css` (imports the real compiled tokens + component CSS) before hand-rolling any styling, and each component's own `.prompt.md` for its exact prop API — `.d.ts` contracts here come from a source scan (this repo has no published component-library build), so cross-check anything unusual against the `.prompt.md` example.

### Example — idiomatic composition

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from "maneuver-ui";

<Card className="w-80">
  <CardHeader>
    <CardTitle>Team 3314 — Mechanical Mustangs</CardTitle>
    <CardDescription>Rank 4 · 18 matches scouted</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">Averages 12.4 coral scored per match.</p>
  </CardContent>
  <CardFooter className="border-t">
    <Button variant="outline" size="sm">View match history</Button>
  </CardFooter>
</Card>
```
