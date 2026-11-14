// SVG charts drawn to match the web dashboard's Recharts output (same margins, tick
// counts, colours, dashed grid, monotone curves and legends) on both platforms.
import React, { useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/hooks/use-theme";
import { Box, Txt } from "./primitives";

const FONT = "Inter_400Regular";

function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5) setSize({ width, height });
  };
  return { size, onLayout };
}

const digitCount = (v: number) => (v === 0 ? 1 : Math.floor(Math.log10(Math.abs(v))) + 1);

function formatStep(rough: number, correction: number): number {
  if (rough <= 0) return 0;
  const digits = digitCount(rough);
  const base = Math.pow(10, digits);
  const ratio = rough / base;
  const scale = digits !== 1 ? 0.05 : 0.1;
  const amended = (Math.ceil(Number((ratio / scale).toFixed(8))) + correction) * scale;
  return Number((amended * base).toPrecision(12));
}

/** Axis ticks computed the way Recharts does (recharts-scale getNiceTickValues, 5 ticks). */
export function niceTicks(minV: number, maxV: number, count = 5): number[] {
  const min = Math.min(0, minV);
  let max = Math.max(0, maxV);
  if (min === max) max = min + 4;
  for (let correction = 0; correction < 50; correction++) {
    const step = formatStep((max - min) / (count - 1), correction);
    if (!step) break;
    let below = Math.ceil(Number(((0 - min) / step).toFixed(8)));
    let up = Math.ceil(Number((max / step).toFixed(8)));
    const total = below + up + 1;
    if (total > count) continue;
    if (total < count) {
      if (max > 0) up += count - total;
      else below += count - total;
    }
    return Array.from({ length: below + up + 1 }, (_, i) => Number(((i - below) * step).toPrecision(12)));
  }
  return [min, max];
}

const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.56;

/** Recharts' default tick interval ("preserveEnd"): keep the last label, drop any that would collide. */
function visibleTicks(positions: number[], labels: string[], fontSize: number, minPos: number, maxPos: number) {
  const n = positions.length;
  const out: { index: number; x: number }[] = [];
  if (!n) return out;
  const gap = 4;
  const clamp = (i: number) => {
    const half = textWidth(labels[i], fontSize) / 2;
    return Math.max(minPos + half, Math.min(positions[i], maxPos - half));
  };
  const lastX = clamp(n - 1);
  const lastStart = lastX - textWidth(labels[n - 1], fontSize) / 2;
  let prevEnd = -Infinity;
  for (let i = 0; i < n - 1; i++) {
    const half = textWidth(labels[i], fontSize) / 2;
    const x = clamp(i);
    if (x - half >= prevEnd + gap && x + half <= lastStart - gap) {
      out.push({ index: i, x });
      prevEnd = x + half;
    }
  }
  out.push({ index: n - 1, x: lastX });
  return out;
}

function wrapWords(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** d3 curveMonotoneX */
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
    }
  }
  t.push(m[n - 2]);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function ChartTooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title?: string; rows: { label?: string; value: string; color?: string }[] }) {
  const boxW = 150;
  const left = Math.max(0, Math.min(x + 10, width - boxW));
  return (
    <Box pointerEvents="none" className="absolute rounded-lg border border-border bg-popover px-2.5 py-2" style={{ left, top: Math.max(0, y - 20), width: boxW }}>
      {title ? <Txt className="text-sm text-popover-foreground">{title}</Txt> : null}
      {rows.map((r, i) => (
        <Txt key={i} className="text-sm" style={r.color ? { color: r.color } : undefined}>
          {r.label ? `${r.label} : ` : ""}
          {r.value}
        </Txt>
      ))}
    </Box>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; shape?: "rect" | "line" }[] }) {
  return (
    <Box className="flex-row flex-wrap items-center justify-center" style={{ columnGap: 10 }}>
      {items.map((it) => (
        <Box key={it.label} className="flex-row items-center" style={{ gap: 4 }}>
          <Box style={{ width: 14, height: 10.5, backgroundColor: it.color }} />
          <Txt className="text-xs" style={{ color: it.color }}>
            {it.label}
          </Txt>
        </Box>
      ))}
    </Box>
  );
}

/* ------------------------------------------------------ Cartesian charts */

export interface Series {
  key: string;
  label?: string;
  color: string;
  type: "line" | "area" | "bar";
  fill?: string;
}

export function CartesianChart({
  data,
  xKey,
  series,
  formatY,
  showLegend,
}: {
  data: Record<string, any>[];
  xKey: string;
  series: Series[];
  formatY: (v: number) => string;
  showLegend?: boolean;
}) {
  const { colors } = useTheme();
  const { size, onLayout } = useSize();
  const [active, setActive] = useState<number | null>(null);

  const legendH = showLegend ? 24 : 0;
  const margin = { top: 5, right: 5, bottom: 5, left: 5 };
  const yAxisW = 60;
  const xAxisH = 30;
  const plot = {
    x: margin.left + yAxisW,
    y: margin.top,
    w: Math.max(0, size.width - margin.left - margin.right - yAxisW),
    h: Math.max(0, size.height - legendH - margin.top - margin.bottom - xAxisH),
  };

  const { ticks, yOf } = useMemo(() => {
    const values = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
    const t = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
    const lo = t[0];
    const hi = t[t.length - 1];
    return { ticks: t, yOf: (v: number) => plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h };
  }, [data, series, plot.y, plot.h]);

  const hasBars = series.some((s) => s.type === "bar");
  const n = data.length;
  const band = n > 0 ? plot.w / n : 0;
  // Bars sit on a band scale; lines/areas run point-to-point across the full width.
  const xOf = (i: number) => (hasBars ? plot.x + band * (i + 0.5) : n <= 1 ? plot.x + plot.w / 2 : plot.x + (plot.w * i) / (n - 1));

  const axis = colors["muted-foreground"];
  const ready = size.width > 0 && plot.h > 0;

  const xLabels = visibleTicks(
    data.map((_, i) => xOf(i)),
    data.map((d) => String(d[xKey])),
    12,
    0,
    size.width,
  );

  const handleTouch = (e: GestureResponderEvent) => {
    if (!n) return;
    const x = e.nativeEvent.locationX;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xOf(i) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setActive(best);
  };

  const barSeries = series.filter((s) => s.type === "bar");
  const groupW = band * 0.8;
  const barGap = 4;
  const barW = barSeries.length ? Math.max(1, (groupW - barGap * (barSeries.length - 1)) / barSeries.length) : 0;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {ready && (
        <View
          style={{ width: size.width, height: size.height - legendH }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleTouch}
          onResponderMove={handleTouch}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
        >
          <Svg width={size.width} height={size.height - legendH}>
            {/* grid */}
            {ticks.map((t) => (
              <Line key={`h${t}`} x1={plot.x} x2={plot.x + plot.w} y1={yOf(t)} y2={yOf(t)} stroke={colors.border} strokeDasharray="3 3" />
            ))}
            {data.map((_, i) => (
              <Line key={`v${i}`} x1={xOf(i)} x2={xOf(i)} y1={plot.y} y2={plot.y + plot.h} stroke={colors.border} strokeDasharray="3 3" />
            ))}
            <Line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke={colors.border} strokeDasharray="3 3" />
            <Line x1={plot.x + plot.w} x2={plot.x + plot.w} y1={plot.y} y2={plot.y + plot.h} stroke={colors.border} strokeDasharray="3 3" />

            {/* active cursor */}
            {active !== null &&
              (hasBars ? (
                <Rect x={plot.x + band * active} y={plot.y} width={band} height={plot.h} fill="#cccccc" opacity={0.25} />
              ) : (
                <Line x1={xOf(active)} x2={xOf(active)} y1={plot.y} y2={plot.y + plot.h} stroke="#cccccc" />
              ))}

            {/* series */}
            {series.map((s, si) => {
              if (s.type === "bar") {
                const bi = barSeries.indexOf(s);
                return (
                  <G key={s.key}>
                    {data.map((d, i) => {
                      const v = Number(d[s.key]) || 0;
                      const x = plot.x + band * i + (band - groupW) / 2 + bi * (barW + barGap);
                      const y0 = yOf(0);
                      const y1 = yOf(v);
                      const h = Math.abs(y0 - y1);
                      if (h <= 0) return null;
                      const r = Math.min(4, barW / 2, h);
                      const top = Math.min(y0, y1);
                      const path = `M${x},${top + h}L${x},${top + r}Q${x},${top} ${x + r},${top}L${x + barW - r},${top}Q${x + barW},${top} ${x + barW},${top + r}L${x + barW},${top + h}Z`;
                      return <Path key={i} d={path} fill={s.color} />;
                    })}
                  </G>
                );
              }
              const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(Number(d[s.key]) || 0) }));
              const line = monotonePath(pts);
              return (
                <G key={s.key}>
                  {s.type === "area" && pts.length > 1 && (
                    <Path d={`${line}L${pts[pts.length - 1].x},${yOf(0)}L${pts[0].x},${yOf(0)}Z`} fill={s.fill ?? s.color} />
                  )}
                  <Path d={line} stroke={s.color} strokeWidth={2} fill="none" />
                  {s.type === "line" && pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} stroke={s.color} strokeWidth={2} />)}
                  {active !== null && pts[active] && s.type !== "line" && (
                    <Circle cx={pts[active].x} cy={pts[active].y} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                  )}
                  {active !== null && pts[active] && s.type === "line" && (
                    <Circle cx={pts[active].x} cy={pts[active].y} r={5} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                  )}
                </G>
              );
            })}

            {/* axes */}
            <Line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke={axis} />
            <Line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke={axis} />
            {ticks.map((t) => (
              <G key={`yt${t}`}>
                <Line x1={plot.x - 6} x2={plot.x} y1={yOf(t)} y2={yOf(t)} stroke={axis} />
                <SvgText x={plot.x - 8} y={yOf(t) + 4.26} fontSize={12} fontFamily={FONT} fill={axis} textAnchor="end">
                  {formatY(t)}
                </SvgText>
              </G>
            ))}
            {data.map((_, i) => (
              <Line key={`xl${i}`} x1={xOf(i)} x2={xOf(i)} y1={plot.y + plot.h} y2={plot.y + plot.h + 6} stroke={axis} />
            ))}
            {xLabels.map((t) => (
              <SvgText key={`xt${t.index}`} x={t.x} y={plot.y + plot.h + 16.5} fontSize={12} fontFamily={FONT} fill={axis} textAnchor="middle">
                {String(data[t.index][xKey])}
              </SvgText>
            ))}
          </Svg>
          {active !== null && data[active] && (
            <ChartTooltip
              x={xOf(active)}
              y={plot.y + plot.h / 2}
              width={size.width}
              title={String(data[active][xKey])}
              rows={series.map((s) => ({ label: s.label, value: formatY(Number(data[active][s.key]) || 0), color: s.color }))}
            />
          )}
        </View>
      )}
      {showLegend && ready && (
        <Box style={{ height: legendH }} className="justify-end">
          <ChartLegend items={series.map((s) => ({ label: s.key.charAt(0).toUpperCase() + s.key.slice(1), color: s.color }))} />
        </Box>
      )}
    </View>
  );
}

/* ------------------------------------------------- Horizontal bar chart */

export function HorizontalBarChart({
  data,
  labelKey,
  valueKey,
  color,
  formatX,
  labelWidth = 85,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color: string;
  formatX: (v: number) => string;
  labelWidth?: number;
}) {
  const { colors } = useTheme();
  const { size, onLayout } = useSize();
  const [active, setActive] = useState<number | null>(null);
  const axis = colors["muted-foreground"];
  const margin = 5;
  const xAxisH = 30;
  const plot = {
    x: margin + labelWidth,
    y: margin,
    w: Math.max(0, size.width - margin * 2 - labelWidth),
    h: Math.max(0, size.height - margin * 2 - xAxisH),
  };
  const ticks = niceTicks(0, Math.max(0, ...data.map((d) => Number(d[valueKey]) || 0)));
  const hi = ticks[ticks.length - 1] || 1;
  const xOf = (v: number) => plot.x + (v / hi) * plot.w;
  const band = data.length ? plot.h / data.length : 0;
  const barH = band * 0.8;
  const ready = size.width > 0 && plot.h > 0;

  const handleTouch = (e: GestureResponderEvent) => {
    if (!band) return;
    const i = Math.floor((e.nativeEvent.locationY - plot.y) / band);
    setActive(i >= 0 && i < data.length ? i : null);
  };

  const xLabels = visibleTicks(
    ticks.map((t) => xOf(t)),
    ticks.map((t) => formatX(t)),
    12,
    0,
    size.width,
  );

  return (
    <View
      style={{ flex: 1 }}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={() => setActive(null)}
      onResponderTerminate={() => setActive(null)}
    >
      {ready && (
        <Svg width={size.width} height={size.height}>
          {active !== null && <Rect x={plot.x} y={plot.y + band * active} width={plot.w} height={band} fill="#cccccc" opacity={0.25} />}
          {data.map((d, i) => {
            const v = Number(d[valueKey]) || 0;
            const w = Math.max(0, xOf(v) - plot.x);
            const y = plot.y + band * i + (band - barH) / 2;
            const r = Math.min(4, barH / 2, w);
            const path = `M${plot.x},${y}L${plot.x + w - r},${y}Q${plot.x + w},${y} ${plot.x + w},${y + r}L${plot.x + w},${y + barH - r}Q${plot.x + w},${y + barH} ${plot.x + w - r},${y + barH}L${plot.x},${y + barH}Z`;
            const name = String(d[labelKey]);
            return (
              <G key={i}>
                {w > 0 && <Path d={path} fill={color} />}
                <Line x1={plot.x - 6} x2={plot.x} y1={plot.y + band * (i + 0.5)} y2={plot.y + band * (i + 0.5)} stroke={axis} />
                {wrapWords(name, labelWidth - 10, 11).map((ln, li, all) => (
                  <SvgText
                    key={li}
                    x={plot.x - 8}
                    y={plot.y + band * (i + 0.5) + 3.9 + (li - (all.length - 1) / 2) * 11}
                    fontSize={11}
                    fontFamily={FONT}
                    fill={axis}
                    textAnchor="end"
                  >
                    {ln}
                  </SvgText>
                ))}
              </G>
            );
          })}
          <Line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke={axis} />
          <Line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke={axis} />
          {ticks.map((t) => (
            <Line key={t} x1={xOf(t)} x2={xOf(t)} y1={plot.y + plot.h} y2={plot.y + plot.h + 6} stroke={axis} />
          ))}
          {xLabels.map((t) => (
            <SvgText key={`xt${t.index}`} x={t.x} y={plot.y + plot.h + 16.5} fontSize={12} fontFamily={FONT} fill={axis} textAnchor="middle">
              {formatX(ticks[t.index])}
            </SvgText>
          ))}
        </Svg>
      )}
      {active !== null && data[active] && (
        <ChartTooltip
          x={plot.x + plot.w / 3}
          y={plot.y + band * active}
          width={size.width}
          title={String(data[active][labelKey])}
          rows={[{ label: "Revenue", value: formatX(Number(data[active][valueKey]) || 0), color }]}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------- Pie chart */

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (-deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

function sectorPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number) {
  const sweep = Math.min(Math.abs(end - start), 359.999);
  const e = start + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outer, start);
  const o2 = polar(cx, cy, outer, e);
  if (inner <= 0) return `M${cx},${cy}L${o1.x},${o1.y}A${outer},${outer} 0 ${large} 0 ${o2.x},${o2.y}Z`;
  const i1 = polar(cx, cy, inner, e);
  const i2 = polar(cx, cy, inner, start);
  return `M${o1.x},${o1.y}A${outer},${outer} 0 ${large} 0 ${o2.x},${o2.y}L${i1.x},${i1.y}A${inner},${inner} 0 ${large} 1 ${i2.x},${i2.y}Z`;
}

export function PieChartView({
  data,
  innerRadius = 0,
  outerRadius = 70,
  paddingAngle = 2,
  showPercentLabels,
  formatValue,
  valueLabel,
}: {
  data: { name: string; value: number; color: string }[];
  innerRadius?: number;
  outerRadius?: number;
  paddingAngle?: number;
  showPercentLabels?: boolean;
  formatValue: (v: number) => string;
  valueLabel: string;
}) {
  const { colors } = useTheme();
  const { size, onLayout } = useSize();
  const [active, setActive] = useState<number | null>(null);
  const [legendH, setLegendH] = useState(24);
  const chartH = Math.max(0, size.height - legendH);
  const cx = size.width / 2;
  const cy = chartH / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  const nonZero = data.filter((d) => d.value > 0).length;
  const pad = nonZero > 1 ? paddingAngle : 0;
  const available = 360 - pad * nonZero;

  let angle = 0;
  const sectors = data.map((d) => {
    const sweep = total > 0 ? (d.value / total) * available : 0;
    const start = angle;
    angle += sweep + (d.value > 0 ? pad : 0);
    return { ...d, start, end: start + sweep, percent: total > 0 ? d.value / total : 0 };
  });

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {size.width > 0 && chartH > 0 && (
        <View style={{ width: size.width, height: chartH }}>
          <Svg width={size.width} height={chartH}>
            {sectors.map((s, i) =>
              s.end - s.start <= 0 ? null : (
                <Path
                  key={i}
                  d={sectorPath(cx, cy, innerRadius, outerRadius, s.start, s.end)}
                  fill={s.color}
                  stroke={colors.card}
                  strokeWidth={1}
                  onPressIn={() => setActive(i)}
                  onPressOut={() => setActive(null)}
                />
              ),
            )}
            {showPercentLabels &&
              sectors.map((s, i) => {
                if (s.end - s.start <= 0) return null;
                const mid = (s.start + s.end) / 2;
                const p = polar(cx, cy, outerRadius + 16, mid);
                const cos = Math.cos((-mid * Math.PI) / 180);
                return (
                  <SvgText key={`l${i}`} x={p.x} y={p.y + 4} fontSize={12} fontFamily={FONT} fill={s.color} textAnchor={cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle"}>
                    {`${(s.percent * 100).toFixed(0)}%`}
                  </SvgText>
                );
              })}
          </Svg>
          {active !== null && sectors[active] && (
            <ChartTooltip x={cx - 75} y={cy} width={size.width} rows={[{ label: sectors[active].name, value: formatValue(sectors[active].value) }]} />
          )}
        </View>
      )}
      <View onLayout={(e) => setLegendH(Math.max(24, e.nativeEvent.layout.height))} style={{ paddingTop: 4 }}>
        <ChartLegend items={data.map((d) => ({ label: d.name, color: d.color }))} />
      </View>
    </View>
  );
}
