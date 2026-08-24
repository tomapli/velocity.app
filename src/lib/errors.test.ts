import { describe, expect, it } from "vitest";

import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("reads native Error messages", () => {
    expect(getErrorMessage(new Error("Native failure"), "Fallback")).toBe(
      "Native failure",
    );
  });

  it("reads structured API error messages", () => {
    expect(getErrorMessage({ message: "Database failure" }, "Fallback")).toBe(
      "Database failure",
    );
  });

  it("uses the fallback for values without a message", () => {
    expect(getErrorMessage({ code: "UNKNOWN" }, "Fallback")).toBe("Fallback");
  });
});
