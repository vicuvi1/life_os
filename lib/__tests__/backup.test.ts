import { describe, it, expect } from "vitest";
import {
  buildBackup,
  countDocs,
  decodeValue,
  encodeValue,
  historyFileName,
  historyToPrune,
  parseBackup,
} from "@/lib/backup";

const ts = (ms: number) => ({ toMillis: () => ms, seconds: ms / 1000 });

describe("backup serialization", () => {
  it("turns timestamps into marks, deeply, and back again", () => {
    const data = { title: "x", createdAt: ts(1700000000000), log: [{ at: ts(5), n: 1 }], none: null };
    const encoded = encodeValue(data);
    expect(encoded).toEqual({
      title: "x",
      createdAt: { __timestamp: 1700000000000 },
      log: [{ at: { __timestamp: 5 }, n: 1 }],
      none: null,
    });
    const decoded = decodeValue(encoded, (ms) => `TS(${ms})`);
    expect(decoded).toEqual({ title: "x", createdAt: "TS(1700000000000)", log: [{ at: "TS(5)", n: 1 }], none: null });
  });

  it("does not mistake ordinary data for a timestamp mark", () => {
    const v = { __timestamp: 5, other: 1 };
    expect(decodeValue(v, () => "TS")).toEqual(v);
    expect(decodeValue({ __timestamp: "5" }, () => "TS")).toEqual({ __timestamp: "5" });
  });

  it("round-trips through JSON text", () => {
    const file = buildBackup(
      { tasks: [{ id: "t1", data: { title: "A", dueDate: "2026-11-26", createdAt: ts(42) } }], goals: [] },
      new Date("2026-11-26T10:00:00Z")
    );
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.exportedAt).toBe("2026-11-26T10:00:00.000Z");
    expect(countDocs(parsed)).toBe(1);
    expect(parsed.collections.tasks[0].data.createdAt).toEqual({ __timestamp: 42 });
    expect(parsed.collections.tasks[0].data.dueDate).toBe("2026-11-26");
  });

  it("rejects files that are not Life OS backups", () => {
    expect(() => parseBackup("not json")).toThrow(/valid JSON/);
    expect(() => parseBackup("[]")).toThrow(/Life OS backup/);
    expect(() => parseBackup(JSON.stringify({ app: "other", collections: {} }))).toThrow(/Life OS backup/);
    expect(() =>
      parseBackup(JSON.stringify({ app: "life-os", version: 99, collections: {} }))
    ).toThrow(/newer version/);
    expect(() =>
      parseBackup(JSON.stringify({ app: "life-os", version: 1, collections: { tasks: [{ id: 1 }] } }))
    ).toThrow(/damaged/);
  });
});

describe("backup history", () => {
  it("names dated copies and prunes the oldest", () => {
    expect(historyFileName("2026-11-26")).toBe("life-os-2026-11-26.json");
    const names = ["life-os-2026-11-03.json", "notes.txt", "life-os-2026-11-01.json", "life-os-2026-11-02.json"];
    expect(historyToPrune(names, 2)).toEqual(["life-os-2026-11-01.json"]);
    expect(historyToPrune(names, 5)).toEqual([]);
  });
});
