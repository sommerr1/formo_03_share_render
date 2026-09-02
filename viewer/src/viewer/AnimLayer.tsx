import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, Object3D } from "three";
import type {
  AnimActor,
  CornerId,
  DrawerActor,
  FacadeActor,
  Vec3O,
} from "./overlayTypes.js";

const ANIM_TAU_S = 0.22;
const CORNER_MIN_M = 0.07;
const CORNER_FRAC = 0.22;
const DRAWER_CENTER_FRAC = 0.48;

function cornerPadM(size: Vec3O): number {
  return Math.max(CORNER_MIN_M, Math.min(size.x, size.y) * CORNER_FRAC);
}

function cornerLocalPos(corner: CornerId, size: Vec3O): Vec3O {
  const pad = cornerPadM(size);
  const hx = size.x / 2 - pad / 2;
  const hy = size.y / 2 - pad / 2;
  const z = size.z / 2 + 0.002;
  const x = corner === "tl" || corner === "bl" ? -hx : hx;
  const y = corner === "tl" || corner === "tr" ? hy : -hy;
  return { x, y, z };
}

function HotspotMesh({
  position,
  args,
  onToggle,
}: {
  position: [number, number, number];
  args: [number, number, number];
  onToggle: () => void;
}) {
  const { gl } = useThree();
  return (
    <mesh
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = "";
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <boxGeometry args={args} />
      <meshBasicMaterial color="#e8eef8" transparent opacity={0.001} depthWrite={false} />
    </mesh>
  );
}

function useAttach(
  innerRef: MutableRefObject<Group | null>,
  objects: Object3D[],
) {
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || objects.length === 0) return;
    const orig: Array<{ obj: Object3D; parent: Object3D }> = [];
    for (const obj of objects) {
      if (!obj.parent) continue;
      orig.push({ obj, parent: obj.parent });
      inner.attach(obj);
    }
    return () => {
      for (const { obj, parent } of orig) {
        parent.attach(obj);
      }
    };
  }, [innerRef, objects]);
}

function FacadeRig({
  actor,
  root,
  open,
  onToggle,
  interactive,
}: {
  actor: FacadeActor;
  root: Object3D;
  open: boolean;
  onToggle: () => void;
  interactive: boolean;
}) {
  const object = useMemo(
    () => root.getObjectByName(actor.partId) ?? null,
    [root, actor.partId],
  );
  const innerRef = useRef<Group>(null);
  const swingRef = useRef<Group>(null);
  const objects = useMemo(() => (object ? [object] : []), [object]);
  useAttach(innerRef, objects);

  const progress = useRef(0);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt / ANIM_TAU_S);
    const tgt = open ? 1 : 0;
    progress.current += (tgt - progress.current) * k;
    if (Math.abs(tgt - progress.current) < 0.0008) progress.current = tgt;
    if (swingRef.current) {
      swingRef.current.rotation.y = progress.current * actor.signedAngle;
    }
  });

  if (!object) return null;
  const corners: CornerId[] = open ? actor.closeCorners : actor.openCorners;
  const pad = cornerPadM(actor.size);
  const { pivot } = actor;

  return (
    <group position={[pivot.x, pivot.y, pivot.z]}>
      <group ref={swingRef}>
        <group ref={innerRef} position={[-pivot.x, -pivot.y, -pivot.z]}>
          {interactive
            ? corners.map((c) => {
                const p = cornerLocalPos(c, actor.size);
                return (
                  <group
                    key={c}
                    position={[actor.center.x, actor.center.y, actor.center.z]}
                  >
                    <HotspotMesh
                      position={[p.x, p.y, p.z]}
                      args={[pad, pad, 0.008]}
                      onToggle={onToggle}
                    />
                  </group>
                );
              })
            : null}
        </group>
      </group>
    </group>
  );
}

function DrawerRig({
  actor,
  root,
  open,
  onToggle,
  interactive,
}: {
  actor: DrawerActor;
  root: Object3D;
  open: boolean;
  onToggle: () => void;
  interactive: boolean;
}) {
  const objects = useMemo(() => {
    const found: Object3D[] = [];
    for (const id of actor.partIds) {
      const o = root.getObjectByName(id);
      if (o) found.push(o);
    }
    return found;
  }, [root, actor.partIds]);
  const drawerRef = useRef<Group>(null);
  useAttach(drawerRef, objects);
  const progress = useRef(0);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt / ANIM_TAU_S);
    const tgt = open ? 1 : 0;
    progress.current += (tgt - progress.current) * k;
    if (Math.abs(tgt - progress.current) < 0.0008) progress.current = tgt;
    if (drawerRef.current) {
      drawerRef.current.position.z = progress.current * actor.travelZ;
    }
  });

  const w = Math.max(0.08, actor.size.x * DRAWER_CENTER_FRAC * 2);
  const h = Math.max(0.06, actor.size.y * DRAWER_CENTER_FRAC * 2);

  return (
    <group ref={drawerRef}>
      <group position={[actor.center.x, actor.center.y, actor.center.z]}>
        {interactive ? (
          <HotspotMesh
            position={[0, 0, actor.size.z / 2 + 0.012]}
            args={[w, h, 0.016]}
            onToggle={onToggle}
          />
        ) : null}
      </group>
    </group>
  );
}

export function AnimLayer({
  root,
  actors,
  facadesOn,
  interactive = true,
}: {
  root: Object3D;
  actors: readonly AnimActor[];
  facadesOn: boolean;
  interactive?: boolean;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <group>
      {actors.map((actor) => {
        if (actor.kind === "facade") {
          if (!facadesOn) return null;
          return (
            <FacadeRig
              key={actor.id}
              actor={actor}
              root={root}
              open={openIds.has(actor.id)}
              onToggle={() => toggle(actor.id)}
              interactive={interactive}
            />
          );
        }
        return (
          <DrawerRig
            key={actor.id}
            actor={actor}
            root={root}
            open={openIds.has(actor.id)}
            onToggle={() => toggle(actor.id)}
            interactive={interactive}
          />
        );
      })}
    </group>
  );
}
