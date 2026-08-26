import { afterEach, describe, expect, it } from "vitest";

import { cacheBrand, readCachedBrand } from "./brandCache";

const KEY = "anitrack-brand";

/**
 * Tests run without a DOM, so there is no `localStorage` unless one is put
 * there. That is not only scaffolding: it is also the shape of a browser that
 * has storage disabled, which the last case below leans on deliberately.
 */
function installStorage(overrides: Partial<Storage> = {}) {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
    ...overrides,
  } as Storage;
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("readCachedBrand", () => {
  it("has nothing to say on a browser that has never loaded the app", () => {
    installStorage();
    expect(readCachedBrand()).toBeNull();
  });

  it("round-trips the instance's own brand", () => {
    installStorage();
    cacheBrand({
      instance_name: "Kaito's Library",
      logo_url: "https://example.com/logo.png",
      accent_color: "#8b5cf6",
    });
    expect(readCachedBrand()).toEqual({
      instanceName: "Kaito's Library",
      logoUrl: "https://example.com/logo.png",
      accentColor: "#8b5cf6",
    });
  });

  it("keeps the empty strings the API actually sends", () => {
    // `logo_url` and `accent_color` are strings on the wire and are "" when
    // unset, which is the documented reset rather than a missing value.
    installStorage();
    cacheBrand({ instance_name: "AniTracker", logo_url: "", accent_color: "" });
    expect(readCachedBrand()).toEqual({
      instanceName: "AniTracker",
      logoUrl: "",
      accentColor: "",
    });
  });

  it("ignores a value that is not this format", () => {
    const storage = installStorage();
    for (const junk of ["not json at all", "null", "42", '"a string"', "[]"]) {
      storage.setItem(KEY, junk);
      expect(readCachedBrand()).toBeNull();
    }
  });

  it("ignores a cached brand with no usable name", () => {
    // A blank name would paint an empty screen, which is the failure this
    // feature exists to remove — the built-in brand is the better answer.
    const storage = installStorage();
    for (const junk of ["{}", '{"instanceName":""}', '{"instanceName":7}']) {
      storage.setItem(KEY, junk);
      expect(readCachedBrand()).toBeNull();
    }
  });

  it("survives a cache written before the logo and accent were kept", () => {
    // The name is the half that matters; an older entry still beats no brand.
    const storage = installStorage();
    storage.setItem(KEY, '{"instanceName":"Kaito\'s Library"}');
    expect(readCachedBrand()).toEqual({
      instanceName: "Kaito's Library",
      logoUrl: "",
      accentColor: "",
    });
  });

  it("returns null instead of throwing when storage refuses to be read", () => {
    // Safari in private mode, and any browser set to block site data.
    installStorage({
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(readCachedBrand()).toBeNull();
  });

  it("returns null instead of throwing when there is no storage at all", () => {
    expect(readCachedBrand()).toBeNull();
  });
});

describe("cacheBrand", () => {
  const brand = () =>
    cacheBrand({ instance_name: "AniTracker", logo_url: "", accent_color: "#d4af37" });

  it("does not throw when storage refuses to be written", () => {
    // A full quota must not take the app down on the one line that is only
    // ever an optimisation for the next load.
    installStorage({
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });
    expect(() => brand()).not.toThrow();
  });

  it("does not throw when there is no storage at all", () => {
    expect(() => brand()).not.toThrow();
  });
});
