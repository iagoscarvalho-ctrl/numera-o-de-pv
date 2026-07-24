import { useEffect, useRef, useState } from "react";
import { usePVStore } from "@/lib/pv/store";
import { findNearestVertex } from "@/lib/pv/geometry";
import type { Vec2 } from "@/lib/pv/types";

type Transform = { scale: number; tx: number; ty: number };

// How close (in screen pixels) a click/hover needs to be to a vertex to
// "hit" it. Kept fairly generous since precise clicking on a dense network
// is hard, especially on touch devices.
const CLICK_PIXEL_RADIUS = 12;

export function PVCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { polylines, pvs, clickVertex } = usePVStore();

  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [hoverVertex, setHoverVertex] = useState<Vec2 | null>(null);

  // Resize observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute initial fit
  useEffect(() => {
    if (polylines.length === 0 || size.w === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of polylines)
      for (const v of p.points) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      }
    const pad = 40;
    const dw = maxX - minX || 1;
    const dh = maxY - minY || 1;
    const scale = Math.min((size.w - pad * 2) / dw, (size.h - pad * 2) / dh);
    // world (x,y) -> screen: sx = (x - minX) * scale + pad, sy = size.h - ((y - minY) * scale + pad)
    // Match toScreen formula: sx = x*scale + tx, sy = -y*scale + ty
    const tx = pad - minX * scale;
    const ty = size.h - pad + minY * scale;
    setTransform({ scale, tx, ty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, polylines.length]);

  const toScreen = (p: Vec2) => ({
    x: p.x * transform.scale + transform.tx,
    y: -p.y * transform.scale + transform.ty,
  });
  const toWorld = (sx: number, sy: number): Vec2 => ({
    x: (sx - transform.tx) / transform.scale,
    y: -(sy - transform.ty) / transform.scale,
  });

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // background grid (subtle)
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, size.w, size.h);

    // polylines
    for (const poly of polylines) {
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      poly.points.forEach((v, i) => {
        const s = toScreen(v);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();

      // vertices (unnumbered = hollow, numbered = filled)
      for (const v of poly.points) {
        const s = toScreen(v);
        const numbered = Object.values(pvs).find((pv) => Math.hypot(pv.x - v.x, pv.y - v.y) <= 0.05);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        if (numbered) {
          ctx.fillStyle = "#16a34a";
          ctx.fill();
        } else {
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Hover highlight — shows which vertex a click would hit right now
    if (hoverVertex) {
      const s = toScreen(hoverVertex);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // PV labels
    ctx.fillStyle = "#065f46";
    ctx.font = "12px system-ui, sans-serif";
    for (const pv of Object.values(pvs)) {
      const s = toScreen({ x: pv.x, y: pv.y });
      ctx.fillText(pv.label, s.x + 7, s.y - 7);
    }
  }, [size, transform, polylines, pvs, hoverVertex]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = toWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newScale = Math.max(0.0001, transform.scale * factor);
    // keep world point under cursor
    const tx = sx - world.x * newScale;
    const ty = sy + world.y * newScale;
    setTransform({ scale: newScale, tx, ty });
  };

  const zoomBy = (factor: number) => {
    const cx = size.w / 2;
    const cy = size.h / 2;
    const world = toWorld(cx, cy);
    const newScale = Math.max(0.0001, transform.scale * factor);
    setTransform({
      scale: newScale,
      tx: cx - world.x * newScale,
      ty: cy + world.y * newScale,
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      panRef.current = { x: e.clientX, y: e.clientY, tx: transform.tx, ty: transform.ty };
      setIsPanning(true);
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const pan = panRef.current;
    if (pan) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      setTransform((t) => ({ ...t, tx: pan.tx + dx, ty: pan.ty + dy }));
      return;
    }
    // Not panning: highlight the vertex a click would currently hit.
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const maxDist = CLICK_PIXEL_RADIUS / transform.scale;
    setHoverVertex(findNearestVertex(polylines, world, maxDist));
  };
  const onMouseUp = () => {
    panRef.current = null;
    setIsPanning(false);
  };

  const onClick = (e: React.MouseEvent) => {
    if (isPanning) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = toWorld(sx, sy);
    const maxDist = CLICK_PIXEL_RADIUS / transform.scale;
    clickVertex(world, maxDist);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full bg-slate-50 border border-slate-200 rounded-md overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: isPanning ? "grabbing" : "crosshair", display: "block" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          onMouseUp();
          setHoverVertex(null);
        }}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => zoomBy(1.25)}
          className="w-9 h-9 rounded bg-white border border-slate-300 shadow text-lg font-semibold hover:bg-slate-100"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.25)}
          className="w-9 h-9 rounded bg-white border border-slate-300 shadow text-lg font-semibold hover:bg-slate-100"
        >
          −
        </button>
      </div>
      <div className="absolute top-3 left-3 text-xs bg-white/90 border border-slate-200 rounded px-2 py-1 text-slate-600">
        Roda: zoom · Shift+arrastar: pan · Clique num nó para numerar (na ordem que for clicando)
      </div>
    </div>
  );
}
