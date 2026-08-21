import { describe, expect, it } from "vitest";
import { estimateTextWidth, fitsInsideWedge } from "@/features/shared/pie-label-fit";

// The macro pie draws at outerRadius 80 and places labels at 0.68 of it.
const LABEL_RADIUS = 80 * 0.68;
const NAME_FONT_SIZE = 11;
const VALUE_FONT_SIZE = 12;

function fits(label: string, share: number) {
  return fitsInsideWedge(share, LABEL_RADIUS, estimateTextWidth(label, NAME_FONT_SIZE));
}

describe("estimateTextWidth", () => {
  it("grows with both length and font size", () => {
    expect(estimateTextWidth("Fat", 11)).toBeLessThan(estimateTextWidth("Chất béo", 11));
    expect(estimateTextWidth("Fat", 11)).toBeLessThan(estimateTextWidth("Fat", 22));
  });

  it("charges nothing extra for Vietnamese diacritics", () => {
    // They render above the base letter, so they add height, not width.
    expect(estimateTextWidth("Dam", 11)).toBe(estimateTextWidth("Đạm", 11));
  });
});

describe("fitsInsideWedge", () => {
  it("splits on the label, not on a fixed percentage of the pie", () => {
    // The whole reason this is measured rather than thresholded: at VietLean's
    // ordinary 11.5% fat slice the English name fits and the Vietnamese one
    // does not, so a single percentage cut-off would either clip "Chất béo" or
    // needlessly exile "Fat".
    const fatShare = 63 / (154 + 343 + 63);
    expect(fatShare).toBeLessThan(0.12);
    expect(fits("Fat", fatShare)).toBe(true);
    expect(fits("Chất béo", fatShare)).toBe(false);
  });

  it("keeps both languages inside on a comfortably wide slice", () => {
    const carbShare = 343 / (154 + 343 + 63);
    expect(fits("Carbs", carbShare)).toBe(true);
    expect(fits("Tinh bột", carbShare)).toBe(true);
  });

  it("sends a sliver outside however short its name", () => {
    // A keto meal plan can drive carbohydrate down to a few percent of total
    // grams; nothing legible fits in a wedge that narrow.
    expect(fits("Fat", 0.02)).toBe(false);
  });

  it("stays inside for wedges past a half turn, where the chord shrinks again", () => {
    // sin(angle/2) peaks at a half turn and falls away after it, so the raw
    // chord would wrongly report a near-whole pie as too narrow to label.
    expect(fits("Chất béo", 0.5)).toBe(true);
    expect(fits("Chất béo", 0.95)).toBe(true);
    expect(fits("Chất béo", 1)).toBe(true);
  });

  it("refuses degenerate geometry rather than dividing by nothing", () => {
    expect(fitsInsideWedge(0, LABEL_RADIUS, 10)).toBe(false);
    expect(fitsInsideWedge(-0.2, LABEL_RADIUS, 10)).toBe(false);
    expect(fitsInsideWedge(0.5, 0, 10)).toBe(false);
  });

  it("accounts for the value line too, not just the name", () => {
    // VietMeal sums a whole week, so its gram figures reach four digits and can
    // be the widest line in the label.
    const share = 0.085;
    expect(fitsInsideWedge(share, LABEL_RADIUS, estimateTextWidth("Fat", NAME_FONT_SIZE))).toBe(true);
    expect(fitsInsideWedge(share, LABEL_RADIUS, estimateTextWidth("1483g", VALUE_FONT_SIZE))).toBe(
      false,
    );
  });
});
