"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { Card } from "@/components/ui/card";
import { estimateTextWidth, fitsInsideWedge } from "@/features/shared/pie-label-fit";

// Colors mapped to CSS custom properties (design tokens), not hardcoded hex —
// keeps this chart restylable in the later ui-ux-pro-max pass (plan §6).
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

// Deliberately NOT var(--foreground): that flips to near-white in dark mode,
// while the three slice fills stay light-to-mid in BOTH themes (L 0.62-0.85).
// Text drawn on top of a slice therefore needs a fixed dark ink either way —
// this is the light theme's --foreground value.
const SLICE_INK = "oklch(0.205 0.03 235)";

const RADIAN = Math.PI / 180;

// Sized against the h-72 plot box: leaves room for a fallback label to elbow
// out past the rim (rim + ~30px) without the text clipping at the top or bottom
// of the container, while still filling the card rather than floating in it.
const OUTER_RADIUS = 88;

const NAME_FONT_SIZE = 11;
const VALUE_FONT_SIZE = 12;

function makeMacroLabelRenderer(total: number) {
  return function renderMacroLabel(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, outerRadius, name, value } = props;
    if (
      typeof cx !== "number" ||
      typeof cy !== "number" ||
      typeof midAngle !== "number" ||
      typeof outerRadius !== "number" ||
      typeof value !== "number" ||
      value <= 0
    ) {
      // A zero-gram macro has no wedge to point at, so a label would just be
      // text floating on the rim with nothing under it.
      return null;
    }

    const macroName = String(name ?? "");
    const grams = `${Math.round(value)}g`;
    const share = total > 0 ? value / total : 0;
    const cos = Math.cos(-midAngle * RADIAN);
    const sin = Math.sin(-midAngle * RADIAN);

    // 0.68 of the radius rather than the centroid: a wedge is widest at its
    // outer edge, and pushing the text outwards is what buys room for the
    // longer Vietnamese names ("Tinh bột", "Chất béo").
    const r = outerRadius * 0.68;
    const textWidth = Math.max(
      estimateTextWidth(macroName, NAME_FONT_SIZE),
      estimateTextWidth(grams, VALUE_FONT_SIZE),
    );

    if (fitsInsideWedge(share, r, textWidth)) {
      const x = cx + r * cos;
      const y = cy + r * sin;
      return (
        // pointerEvents none so a label never eats the hover that opens the
        // tooltip on the slice beneath it.
        <text
          x={x}
          y={y}
          fill={SLICE_INK}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
        >
          <tspan x={x} dy="-0.35em" fontSize={NAME_FONT_SIZE}>
            {macroName}
          </tspan>
          <tspan x={x} dy="1.3em" fontSize={VALUE_FONT_SIZE} fontWeight={600}>
            {grams}
          </tspan>
        </text>
      );
    }

    const sx = cx + (outerRadius + 2) * cos;
    const sy = cy + (outerRadius + 2) * sin;
    const mx = cx + (outerRadius + 14) * cos;
    const my = cy + (outerRadius + 14) * sin;
    const dir = cos >= 0 ? 1 : -1;
    const ex = mx + dir * 14;
    const tx = ex + dir * 4;
    return (
      <g pointerEvents="none">
        <polyline
          points={`${sx},${sy} ${mx},${my} ${ex},${my}`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1}
        />
        <text
          x={tx}
          y={my}
          fill="var(--foreground)"
          textAnchor={dir === 1 ? "start" : "end"}
          dominantBaseline="central"
        >
          <tspan x={tx} dy="-0.35em" fontSize={NAME_FONT_SIZE}>
            {macroName}
          </tspan>
          <tspan x={tx} dy="1.3em" fontSize={VALUE_FONT_SIZE} fontWeight={600}>
            {grams}
          </tspan>
        </text>
      </g>
    );
  };
}

/**
 * Protein / carb / fat split as a pie, with each slice naming its own macro and
 * gram total so the chart reads without hovering. Shared by VietMeal (weekly
 * totals) and VietLean (daily targets) so the two cannot drift apart.
 *
 * Note the slices are proportional to *grams*, not to the calories those grams
 * carry — fat is 9 kcal/g against 4 for protein and carbohydrate, so a fat
 * slice always looks smaller here than its share of energy.
 */
export function MacroPieChart({
  heading,
  proteinLabel,
  carbsLabel,
  fatLabel,
  proteinG,
  carbG,
  fatG,
}: {
  heading: string;
  proteinLabel: string;
  carbsLabel: string;
  fatLabel: string;
  proteinG: number;
  carbG: number;
  fatG: number;
}) {
  const data = useMemo(
    () => [
      { name: proteinLabel, grams: proteinG },
      { name: carbsLabel, grams: carbG },
      { name: fatLabel, grams: fatG },
    ],
    [proteinLabel, carbsLabel, fatLabel, proteinG, carbG, fatG],
  );

  const total = proteinG + carbG + fatG;
  const renderLabel = useMemo(() => makeMacroLabelRenderer(total), [total]);

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">{heading}</h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="grams"
              nameKey="name"
              outerRadius={OUTER_RADIUS}
              labelLine={false}
              label={renderLabel}
              // Recharts only draws labels once the entry animation finishes, so
              // the default 1.5s left the chart unlabelled for exactly as long.
              // Short enough that the numbers are readable almost immediately,
              // long enough to still read as a reveal rather than a jump.
              animationDuration={600}
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `${Math.round(value)}g` : String(value ?? "")
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
