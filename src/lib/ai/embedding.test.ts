import { describe, expect, it } from "vitest";
import { buildPropertyText } from "./embedding";

describe("buildPropertyText", () => {
  it("joins useful property fields into a searchable description", () => {
    const text = buildPropertyText({
      title: "Emaar Palm Heights",
      description: "Ready to move apartment",
      location: "Sector 77, Gurgaon",
      property_type: "3 BHK Apartment",
      bedrooms: 3,
      price: 14200000,
      amenities: ["Clubhouse", "Parking"],
    });

    expect(text).toContain("Emaar Palm Heights");
    expect(text).toContain("Ready to move apartment");
    expect(text).toContain("Sector 77, Gurgaon");
    expect(text).toContain("3 BHK");
    expect(text).toContain("INR 1,42,00,000");
    expect(text).toContain("Clubhouse, Parking");
  });

  it("omits nullish optional fields without adding empty separators", () => {
    expect(buildPropertyText({
      title: "DLF The Arbour",
      description: null,
      location: null,
      property_type: null,
      bedrooms: null,
      price: null,
      amenities: null,
    })).toBe("DLF The Arbour");
  });
});
