import { describe, expect, it } from "vitest";
import { parseMessageSegments } from "@/features/vietask/format-message";

const plain = (text: string) => ({ text, bold: false });
const bold = (text: string) => ({ text, bold: true });

describe("parseMessageSegments", () => {
  it("returns a single plain run when there is no emphasis", () => {
    expect(parseMessageSegments("Eat more vegetables.")).toEqual([plain("Eat more vegetables.")]);
  });

  it("lifts a bold dish name out of surrounding text", () => {
    expect(parseMessageSegments("Try **Canh chua cá** tonight.")).toEqual([
      plain("Try "),
      bold("Canh chua cá"),
      plain(" tonight."),
    ]);
  });

  it("handles several bold runs in one message", () => {
    expect(parseMessageSegments("**A** and **B**")).toEqual([
      bold("A"),
      plain(" and "),
      bold("B"),
    ]);
  });

  it("leaves an unmatched marker literal rather than swallowing the rest", () => {
    expect(parseMessageSegments("2 ** 3 = 8")).toEqual([plain("2 ** 3 = 8")]);
    expect(parseMessageSegments("**unclosed")).toEqual([plain("**unclosed")]);
  });

  it("does not treat a single asterisk as emphasis", () => {
    expect(parseMessageSegments("*not bold*")).toEqual([plain("*not bold*")]);
  });

  it("preserves newlines inside and around a bold run", () => {
    expect(parseMessageSegments("a\n**b\nc**\nd")).toEqual([
      plain("a\n"),
      bold("b\nc"),
      plain("\nd"),
    ]);
  });

  it("returns nothing for an empty message", () => {
    expect(parseMessageSegments("")).toEqual([]);
  });

  it("ignores an empty marker pair", () => {
    expect(parseMessageSegments("****")).toEqual([plain("****")]);
  });

  it("round-trips the original text when segments are concatenated", () => {
    for (const input of [
      "Try **Phở gà** or **Bún chả**.",
      "no emphasis here",
      "**leading** middle **trailing**",
      "2 ** 3",
    ]) {
      const joined = parseMessageSegments(input)
        .map((s) => (s.bold ? `**${s.text}**` : s.text))
        .join("");
      expect(joined).toBe(input);
    }
  });
});
