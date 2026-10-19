import { describe, expect, it } from "vitest";
import { PERSONAS } from "./personas";
import { getLocalizedOpening } from "./persona-localization";
import { REPLY_LANGUAGE_IDS } from "./reply-languages";

describe("localized persona openings", () => {
  it.each(PERSONAS)("keeps $name cards in Chinese in auto mode", (persona) => {
    const opening = getLocalizedOpening(persona, "auto");
    expect(opening.intro).toBe("试试下面的话题，或直接输入问题");
    expect(opening.quickPrompts).toEqual(persona.quickPrompts);
    expect(opening.placeholder).toBe(persona.placeholder);
    expect(opening.inputHint).toBe("输入消息…");
    expect(getLocalizedOpening(persona, "zh-CN")).toEqual(opening);
  });

  it.each(REPLY_LANGUAGE_IDS.filter((id) => id !== "auto" && id !== "zh-CN"))("translates all 20 cards, prompts and opening text in %s", (language) => {
    let count = 0;
    for (const persona of PERSONAS) {
      const opening = getLocalizedOpening(persona, language);
      expect(opening.intro).not.toBe("试试下面的话题，或直接输入问题");
      expect(opening.inputHint).not.toBe("输入消息…");
      expect(opening.placeholder).toBeTruthy();
      expect(opening.placeholder).not.toBe(persona.placeholder);
      expect(opening.quickPrompts).toHaveLength(4);
      opening.quickPrompts.forEach((item, index) => {
        const original = persona.quickPrompts![index];
        expect(item.label).toBeTruthy();
        expect(item.prompt).not.toBe(original.prompt);
        expect(item.icon).toBe(original.icon);
        expect(item.colorVar).toBe(original.colorVar);
        count++;
      });
      const quiz = getLocalizedOpening(PERSONAS[0], language).quickPrompts[3];
      expect(quiz.prompt).toContain("quiz");
      expect(quiz.prompt).toContain("3");
    }
    expect(count).toBe(20);
  });

  it("sends the translated card prompt and leaves the original persona intact", () => {
    const persona = PERSONAS[0];
    const french = getLocalizedOpening(persona, "fr");
    expect(french.quickPrompts[0].label).toBe("Comprendre une idée");
    expect(french.quickPrompts[0].prompt).toMatch(/^Je veux comprendre/);
    expect(getLocalizedOpening(persona, "en").quickPrompts[0].prompt).toMatch(/^I want to understand/);
    expect(getLocalizedOpening(persona, "auto").quickPrompts[0].label).toBe("讲懂概念");
    expect(persona.quickPrompts?.[0].prompt).toMatch(/^我想弄懂/);
  });
});
