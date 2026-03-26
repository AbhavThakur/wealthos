/**
 * Library-agnostic chart abstraction layer.
 * Swap the rendering engine by editing ONLY this file.
 * Currently backed by Apache ECharts 6.
 *
 * Public API:
 *   <Chart>       – cartesian charts (line / area / bar / combo)
 *   <DonutChart>  – pie / donut charts
 */
import { memo, useMemo, useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer,
]);

/* ─── internal constants ─── */

/* Thin ECharts renderer — replaces echarts-for-react */

let digestCounter = 0; // fallback for serialization errors

/** Hash only the serializable parts of input — avoids LinearGradient issues */
function stableDigest(categories, series, grid, horizontal, labelInterval) {
  try {
    return JSON.stringify({
      categories,
      series,
      grid,
      horizontal,
      labelInterval,
    });
  } catch {
    return `err_${++digestCounter}`; // force update on error
  }
}

function EChart({ option, digest, style }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const digestRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Dispose any orphaned instance on this DOM node (StrictMode / fast remount)
    echarts.getInstanceByDom(el)?.dispose();
    const inst = echarts.init(el);
    chart.current = inst;
    // Reset digest so the setOption effect always runs on new instance
    digestRef.current = null;

    // Debounced ResizeObserver — prevents infinite layout loops
    let rid;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rid);
      rid = requestAnimationFrame(() => {
        if (!inst.isDisposed()) inst.resize();
      });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rid);
      ro.disconnect();
      if (!inst.isDisposed()) inst.dispose();
      chart.current = null;
    };
  }, []);

  // Push option to ECharts only when digest changes or on fresh instance
  useEffect(() => {
    const inst = chart.current;
    if (!inst || inst.isDisposed()) return;
    if (digest === digestRef.current) return;
    digestRef.current = digest;
    inst.setOption(option, true);
  }, [option, digest]);

  return <div ref={ref} style={style} />;
}

const TOOLTIP = {
  backgroundColor: "#13131a",
  borderColor: "rgba(255,255,255,0.07)",
  borderWidth: 1,
  textStyle: { color: "#eeeae4", fontSize: 12 },
  borderRadius: 8,
};

const VAR_MAP = {
  "var(--abhav)": "#5b9cf6",
  "var(--aanya)": "#d46eb3",
  "var(--gold)": "#c9a84c",
  "var(--green)": "#4caf82",
  "var(--red)": "#ef5350",
};

function res(c) {
  return VAR_MAP[c] || c;
}

function grad(color, op = 0.25) {
  const hex = res(color);
  const m = hex.match?.(/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (m) {
    const [, r, g, b] = m.map((x, i) => (i === 0 ? x : parseInt(x, 16)));
    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: `rgba(${r},${g},${b},${op})` },
      { offset: 1, color: `rgba(${r},${g},${b},0)` },
    ]);
  }
  return `rgba(128,128,128,${op})`;
}

/* ─── series descriptor → ECharts series ─── */

function mapSeries(s) {
  const hex = res(s.color);
  const isArea = s.type === "area";
  const isBar = s.type === "bar";

  const data = s.data?.map((d) => {
    if (d != null && typeof d === "object" && "value" in d) {
      const item = { value: d.value };
      if (d.color)
        item.itemStyle = {
          color: res(d.color),
          ...(s.barRadius ? { borderRadius: s.barRadius } : {}),
        };
      return item;
    }
    return d;
  });

  const out = { name: s.name, type: isArea ? "line" : s.type, data };

  if (isBar) {
    out.itemStyle = {
      color: hex,
      borderRadius: s.barRadius || [4, 4, 0, 0],
      ...(s.opacity != null ? { opacity: s.opacity } : {}),
    };
    if (s.stack) out.stack = s.stack;
    if (s.barMaxWidth) out.barMaxWidth = s.barMaxWidth;
  } else {
    out.smooth = true;
    out.symbol = s.symbol === true || s.symbol === "circle" ? "circle" : "none";
    if (s.symbol) out.symbolSize = s.symbolSize || 6;
    out.lineStyle = {
      color: hex,
      width: s.lineWidth || 2,
      ...(s.dashed ? { type: "dashed" } : {}),
    };
    out.itemStyle = { color: hex };
    if (isArea) out.areaStyle = { color: grad(hex, s.areaOpacity || 0.25) };
  }

  return out;
}

/* ─── <Chart> ─── */

const Chart = memo(function Chart({
  categories,
  series,
  height = "100%",
  width = "100%",
  style,
  fmt,
  tooltip,
  grid,
  horizontal = false,
  labelInterval,
  labelSize = 11,
  labelColor = "#55535e",
}) {
  const option = useMemo(() => {
    const catAxis = {
      type: "category",
      data: categories,
      axisLabel: {
        fontSize: labelSize,
        color: labelColor,
        ...(labelInterval != null ? { interval: labelInterval } : {}),
      },
      axisLine: { show: false },
      axisTick: { show: false },
    };
    const valAxis = { type: "value", show: false };

    const fmtFn =
      tooltip ||
      ((params) => {
        const arr = Array.isArray(params) ? params : [params];
        return arr
          .map(
            (p) =>
              `${p.marker} ${p.seriesName}: ${fmt ? fmt(p.value) : p.value}`,
          )
          .join("<br/>");
      });

    return {
      grid: {
        top: 4,
        right: 0,
        bottom: 24,
        left: 0,
        containLabel: false,
        ...grid,
      },
      tooltip: { ...TOOLTIP, trigger: "axis", formatter: fmtFn },
      xAxis: horizontal ? valAxis : catAxis,
      yAxis: horizontal ? catAxis : valAxis,
      series: series.map(mapSeries),
    };
  }, [
    categories,
    series,
    fmt,
    tooltip,
    grid,
    horizontal,
    labelInterval,
    labelSize,
    labelColor,
  ]);

  // Stable digest from input props only (no LinearGradient objects)
  const digest = useMemo(
    () => stableDigest(categories, series, grid, horizontal, labelInterval),
    [categories, series, grid, horizontal, labelInterval],
  );

  return (
    <EChart
      option={option}
      digest={digest}
      style={{ height, width, ...style }}
    />
  );
});

/* ─── <DonutChart> ─── */

const DonutChart = memo(function DonutChart({
  data,
  height = "100%",
  width = "100%",
  style,
  fmt,
  innerRadius = "45%",
  outerRadius = "75%",
  legend = false,
  center,
  padAngle,
}) {
  const option = useMemo(() => {
    const opt = {
      tooltip: {
        ...TOOLTIP,
        formatter: (p) =>
          `${p.marker} ${p.name}: ${fmt ? fmt(p.value) : p.value}`,
      },
      series: [
        {
          type: "pie",
          radius: [innerRadius, outerRadius],
          ...(center ? { center } : {}),
          ...(padAngle != null ? { padAngle } : {}),
          data: data.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: res(d.color) },
          })),
          label: { show: false },
          emphasis: { scale: false },
          itemStyle: { borderWidth: 0 },
        },
      ],
    };
    if (legend) {
      opt.legend = {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#b0aab8", fontSize: 11 },
      };
    }
    return opt;
  }, [data, fmt, innerRadius, outerRadius, legend, center, padAngle]);

  // Stable digest from input props only
  const digest = useMemo(() => {
    try {
      return JSON.stringify({
        data,
        innerRadius,
        outerRadius,
        legend,
        center,
        padAngle,
      });
    } catch {
      return `err_${++digestCounter}`;
    }
  }, [data, innerRadius, outerRadius, legend, center, padAngle]);

  return (
    <EChart
      option={option}
      digest={digest}
      style={{ height, width, ...style }}
    />
  );
});

export { Chart, DonutChart };
