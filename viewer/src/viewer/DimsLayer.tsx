import { Html, Line } from "@react-three/drei";
import type { StudioDim, Vec3T } from "./overlayTypes.js";

const COLOR: Record<StudioDim["kind"], string> = {
  carcass: "#cbd5e1",
  zone: "#fbbf24",
  facade: "#fb923c",
};

const TICK = 0.01;

function axisOf(a: Vec3T, b: Vec3T): "x" | "y" | "z" {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  const dz = Math.abs(a[2] - b[2]);
  if (dx >= dy && dx >= dz) return "x";
  if (dy >= dx && dy >= dz) return "y";
  return "z";
}

function tickEnds(p: Vec3T, along: "x" | "y" | "z", half: number): [Vec3T, Vec3T] {
  if (along === "x") {
    return [
      [p[0], p[1] - half, p[2]],
      [p[0], p[1] + half, p[2]],
    ];
  }
  if (along === "y") {
    return [
      [p[0] - half, p[1], p[2]],
      [p[0] + half, p[1], p[2]],
    ];
  }
  return [
    [p[0], p[1], p[2] - half],
    [p[0], p[1], p[2] + half],
  ];
}

function noHit() {
  return null;
}

function DimMark({ dim }: { dim: StudioDim }) {
  const color = COLOR[dim.kind];
  const axis = axisOf(dim.a, dim.b);
  const tickAlong = axis === "x" ? "y" : "x";
  const tickA = tickEnds(dim.a, tickAlong, TICK);
  const tickB = tickEnds(dim.b, tickAlong, TICK);
  return (
    <group>
      <Line points={[dim.extA[0], dim.extA[1]]} color={color} lineWidth={1} depthTest={false} renderOrder={50} raycast={noHit} />
      <Line points={[dim.extB[0], dim.extB[1]]} color={color} lineWidth={1} depthTest={false} renderOrder={50} raycast={noHit} />
      <Line points={[dim.a, dim.b]} color={color} lineWidth={1.6} depthTest={false} renderOrder={51} raycast={noHit} />
      <Line points={tickA} color={color} lineWidth={1.6} depthTest={false} renderOrder={51} raycast={noHit} />
      <Line points={tickB} color={color} lineWidth={1.6} depthTest={false} renderOrder={51} raycast={noHit} />
      <Html position={dim.label} center sprite occlude={false} style={{ pointerEvents: "none" }} zIndexRange={[220, 0]}>
        <div className={`share-dim share-dim--${dim.kind}`}>{dim.valueMm}</div>
      </Html>
    </group>
  );
}

export function DimsLayer({ dims }: { dims: readonly StudioDim[] }) {
  if (dims.length === 0) return null;
  return (
    <group>
      {dims.map((d) => (
        <DimMark key={d.id} dim={d} />
      ))}
    </group>
  );
}
