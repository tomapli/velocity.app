import { describe, expect, it } from "vitest";

import { buildIgSearchOptions } from "@/lib/ig/search-options";

const PROFILES = [
  { ig_username: "saunia_cz", ig_name: "Saunia" },
  { ig_username: "salori.cz", ig_name: "Salori" },
  { ig_username: "velocity", ig_name: null },
];

describe("buildIgSearchOptions", () => {
  it("returns every existing profile for empty input", () => {
    expect(buildIgSearchOptions("   ", PROFILES)).toEqual([
      {
        id: "existing:saunia_cz",
        kind: "existing",
        username: "saunia_cz",
        displayName: "Saunia",
        exact: false,
      },
      {
        id: "existing:salori.cz",
        kind: "existing",
        username: "salori.cz",
        displayName: "Salori",
        exact: false,
      },
      {
        id: "existing:velocity",
        kind: "existing",
        username: "velocity",
        displayName: null,
        exact: false,
      },
    ]);
  });

  it("puts an exact existing match first and marks it exact", () => {
    const options = buildIgSearchOptions("saunia_cz", PROFILES);

    expect(options[0]).toEqual({
      id: "existing:saunia_cz",
      kind: "existing",
      username: "saunia_cz",
      displayName: "Saunia",
      exact: true,
    });
    expect(options.some((option) => option.kind === "new")).toBe(false);
  });

  it("puts a new option first when the username is not known", () => {
    const options = buildIgSearchOptions("brandnew", PROFILES);

    expect(options[0]).toEqual({
      id: "new:brandnew",
      kind: "new",
      username: "brandnew",
      isUrlInput: false,
    });
  });

  it("includes partial existing matches after the primary option", () => {
    const options = buildIgSearchOptions("sa", PROFILES);

    expect(options[0]).toMatchObject({ kind: "new", username: "sa" });
    expect(options.slice(1).map((option) => option.username)).toEqual([
      "saunia_cz",
      "salori.cz",
    ]);
  });

  it("parses Instagram URLs into a new or existing primary option", () => {
    const options = buildIgSearchOptions(
      "https://www.instagram.com/saunia_cz/",
      PROFILES,
    );

    expect(options[0]).toMatchObject({
      kind: "existing",
      username: "saunia_cz",
      exact: true,
    });
  });
});
