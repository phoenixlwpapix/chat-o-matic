import { describe, expect, it } from "vitest";
import { PERSONAS } from "./personas";

describe("persona quick prompts", () => {
  it("offers four distinct conversation starters for every persona", () => {
    const labels = PERSONAS.flatMap((persona) =>
      (persona.quickPrompts ?? []).map((prompt) => prompt.label),
    );

    for (const persona of PERSONAS) {
      expect(persona.quickPrompts).toHaveLength(4);
    }

    expect(labels).toHaveLength(20);
    expect(new Set(labels).size).toBe(20);
  });

  it("keeps the science experiment starter explicitly safety-scoped", () => {
    const scientist = PERSONAS.find((persona) => persona.id === "mad-scientist");
    const experiment = scientist?.quickPrompts?.find(
      (prompt) => prompt.label === "安全实验",
    );

    expect(experiment?.prompt).toContain("不使用火、刀具、插座或药品");
    expect(experiment?.prompt).toContain("成年人陪同");
  });

  it("makes the learning companion starters honor the active learning mode", () => {
    const learningCompanion = PERSONAS.find(
      (persona) => persona.id === "default",
    );
    const learningPrompts = learningCompanion?.quickPrompts ?? [];

    expect(
      learningPrompts.filter((prompt) => prompt.prompt.includes("当前学习模式")),
    ).toHaveLength(2);
  });
});
