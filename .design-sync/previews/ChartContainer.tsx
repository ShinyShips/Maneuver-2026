import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "maneuver-2026";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const scoringData = [
  { match: "Q12", coral: 8, algae: 3 },
  { match: "Q15", coral: 11, algae: 2 },
  { match: "Q19", coral: 9, algae: 4 },
  { match: "Q23", coral: 13, algae: 1 },
  { match: "Q27", coral: 10, algae: 3 },
  { match: "Q31", coral: 14, algae: 2 },
];

const scoringConfig = {
  coral: {
    label: "Coral",
    color: "var(--chart-1)",
  },
  algae: {
    label: "Algae",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function TeamScoringTrend() {
  return (
    <ChartContainer config={scoringConfig} className="h-64 w-full max-w-xl">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart accessibilityLayer data={scoringData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="match"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={24} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="coral" fill="var(--color-coral)" radius={4} />
          <Bar dataKey="algae" fill="var(--color-algae)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
