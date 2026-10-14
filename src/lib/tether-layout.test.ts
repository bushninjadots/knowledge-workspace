import { describe, expect, it } from "vitest";
import {
  ballPosition,
  ballSize,
  grownBy,
  layoutTether,
  MAX_RINGS,
  poleHeight,
  tetherLevel,
  tetherTimeline,
  type TetherNodeIn,
} from "./tether-layout";

const n = (id: string, type: TetherNodeIn["type"], at?: string, weight = 1): TetherNodeIn => ({
  id,
  type,
  label: id,
  at,
  weight,
});

describe("layoutTether", () => {
  it("puts each kind on its own ring, closest relationships inside", () => {
    const three = (t: TetherNodeIn["type"]) => [n(`${t}1`, t), n(`${t}2`, t), n(`${t}3`, t)];
    const rings = layoutTether([...three("skill"), ...three("person"), ...three("project")]);
    expect(rings.map((r) => r.type)).toEqual(["person", "project", "skill"]);
    expect(rings[0].radius).toBeLessThan(rings[1].radius);
    expect(Math.sign(rings[0].speed)).not.toBe(Math.sign(rings[1].speed));
    expect(rings[0].nodes).toHaveLength(3);
  });

  it("gathers small kinds on one shared outer ring", () => {
    const rings = layoutTether([
      n("a", "person"),
      n("b", "person"),
      n("c", "person"),
      n("x", "community"),
      n("y", "organization"),
    ]);
    expect(rings.map((r) => r.type)).toEqual(["person", "other"]);
    expect(rings[1].label).toBe("More");
    expect(rings[1].nodes.map((x) => x.type).sort()).toEqual(["community", "organization"]);
  });

  it("spreads a ring evenly and keeps it stable", () => {
    const a = layoutTether([
      n("a", "person"),
      n("b", "person"),
      n("c", "person"),
      n("d", "person"),
    ]);
    const angles = a[0].nodes.map((x) => x.angle);
    expect(angles[1] - angles[0]).toBeCloseTo(Math.PI / 2);
    const b = layoutTether([
      n("a", "person"),
      n("b", "person"),
      n("c", "person"),
      n("d", "person"),
    ]);
    expect(b[0].nodes.map((x) => x.angle)).toEqual(angles);
  });

  it("folds extra kinds into one outer ring", () => {
    const types: TetherNodeIn["type"][] = [
      "person",
      "project",
      "skill",
      "repository",
      "community",
      "organization",
      "knowledge",
      "badge",
    ];
    const rings = layoutTether(
      types.flatMap((t) => [n(`${t}`, t), n(`${t}-2`, t), n(`${t}-3`, t)]),
    );
    expect(rings).toHaveLength(MAX_RINGS);
    expect(rings[MAX_RINGS - 1].type).toBe("other");
    expect(new Set(rings[MAX_RINGS - 1].nodes.map((x) => x.type))).toEqual(
      new Set(["organization", "knowledge", "badge"]),
    );
  });

  it("sizes balls by weight", () => {
    expect(ballSize(1)).toBeLessThan(ballSize(9));
    expect(ballSize(10_000)).toBe(20);
  });
});

describe("growth", () => {
  it("levels up and raises the pole", () => {
    expect(tetherLevel([]).name).toBe("Seed");
    const many = Array.from({ length: 30 }, (_, i) => n(`p${i}`, "person"));
    const lvl = tetherLevel(many);
    expect(lvl.name).toBe("In orbit");
    expect(lvl.next).toBe("Constellation");
    expect(lvl.progress).toBeGreaterThan(0);
    expect(poleHeight(lvl.index)).toBeGreaterThan(poleHeight(0));
  });

  it("replays the story by date", () => {
    const nodes = [n("a", "person", "2026-01-01"), n("b", "person", "2026-06-01"), n("c", "skill")];
    expect(grownBy(nodes, Date.parse("2026-03-01")).map((x) => x.id)).toEqual(["a", "c"]);
    const tl = tetherTimeline(nodes);
    expect(tl?.start).toBe(Date.parse("2026-01-01"));
    expect(tetherTimeline([n("a", "person")])).toBeNull();
  });

  it("puts the front of the orbit lower and larger", () => {
    const ring = { radius: 100, speed: 0 };
    const front = ballPosition(ring, Math.PI / 2, 0, { x: 0, y: 0 });
    const back = ballPosition(ring, -Math.PI / 2, 0, { x: 0, y: 0 });
    expect(front.y).toBeGreaterThan(back.y);
    expect(front.scale).toBeGreaterThan(back.scale);
  });
});
