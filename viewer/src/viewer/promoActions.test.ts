import { describe, expect, it } from "vitest";
import {
  hasRealGlb,
  promoShowModelActions,
  parsePromoContentScope,
} from "./promoActions.js";

describe("promoActions", () => {
  it("parsePromoContentScope", () => {
    expect(parsePromoContentScope({ promoContentScope: "both" })).toBe("both");
    expect(parsePromoContentScope({})).toBeUndefined();
  });

  it("hasRealGlb ignores stub", () => {
    expect(hasRealGlb({ fileSizeBytes: 500 })).toBe(false);
    expect(hasRealGlb({ fileSizeBytes: 50_000 })).toBe(true);
  });

  it("promoShowModelActions for both requires frames", () => {
    expect(
      promoShowModelActions({
        scope: "both",
        framesCount: 4,
        allow3D: true,
        meta: { fileSizeBytes: 1_000_000 },
      }),
    ).toBe(true);
    expect(
      promoShowModelActions({
        scope: "both",
        framesCount: 0,
        allow3D: true,
        meta: { fileSizeBytes: 1_000_000 },
      }),
    ).toBe(false);
  });

  it("gallery_only hides model actions", () => {
    expect(
      promoShowModelActions({
        scope: "gallery_only",
        framesCount: 4,
        allow3D: true,
        meta: { fileSizeBytes: 1_000_000 },
      }),
    ).toBe(false);
  });
});
