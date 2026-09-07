import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  prepareCountries,
  countryAt,
  distanceKm,
  cityVisible,
  isPlaceClick,
  raySphere,
  CITY_ZOOM,
} from "../src/geo.js";
const countries = prepareCountries(
  JSON.parse(
    await readFile(
      new URL("../public/data/countries.json", import.meta.url),
      "utf8",
    ),
  ),
);
test("real locations resolve to their countries, including small states and islands", () => {
  for (const [name, lon, lat, id] of [
    ["Paris", 2.35, 48.86, "FRA"],
    ["Delhi", 77.21, 28.61, "IND"],
    ["New York", -74, 40.71, "USA"],
    ["Tokyo", 139.69, 35.68, "JPN"],
    ["Rome", 12.49, 41.89, "ITA"],
    ["Wellington", 174.77, -41.29, "NZL"],
    ["Sydney", 151.2, -33.86, "AUS"],
    ["Monaco", 7.4246, 43.7384, "MCO"],
    ["Suva", 178.45, -18.14, "FJI"],
    ["Nairobi", 36.82, -1.29, "KEN"],
  ])
    assert.equal(countryAt(countries, lon, lat)?.id, id, name);
  assert.equal(
    countryAt(countries, -140, 0),
    undefined,
    "ocean has no selected country",
  );
});
test("antimeridian polygons and holes do not select the opposite hemisphere", () => {
  const places = prepareCountries([
    {
      id: "island",
      geometry: {
        coordinates: [
          [
            [
              [175, -10],
              [-175, -10],
              [-175, 10],
              [175, 10],
              [175, -10],
            ],
            [
              [179, -2],
              [-179, -2],
              [-179, 2],
              [179, 2],
              [179, -2],
            ],
          ],
        ],
      },
    },
  ]);
  assert.equal(countryAt(places, 178, 5)?.id, "island");
  assert.equal(countryAt(places, -178, 5)?.id, "island");
  assert.equal(countryAt(places, 0, 5), undefined);
  assert.equal(countryAt(places, 180, 0), undefined);
});
test("cities reveal progressively with zoom", () => {
  const small = { population: 3000, capital: false };
  const capital = { ...small, capital: true };
  assert.equal(cityVisible(capital, CITY_ZOOM - 0.01), false);
  assert.equal(cityVisible(capital, CITY_ZOOM), true);
  assert.equal(cityVisible(small, 0.9), false);
  assert.equal(cityVisible(small, 1.1), true);
});
test("a drag, pinch, cancelled press, or miss never selects a country", () => {
  assert.equal(isPlaceClick(null, { x: 0, y: 0 }), false);
  assert.equal(isPlaceClick({ x: 10, y: 10 }, { x: 11, y: 12 }), true);
  assert.equal(isPlaceClick({ x: 10, y: 10 }, { x: 25, y: 10 }), false);
  assert.equal(
    isPlaceClick({ x: 0, y: 0, multitouch: true }, { x: 0, y: 0 }),
    false,
  );
  assert.ok(
    Math.abs(
      raySphere({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 }, 2.55) - 7.45,
    ) < 1e-10,
  );
  assert.equal(
    raySphere({ x: 0, y: 0, z: 10 }, { x: 1, y: 0, z: 0 }, 2.55),
    null,
  );
});
test("nearby history associations use great-circle distance across the date line", () => {
  assert.ok(distanceKm({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }) < 23);
  assert.ok(
    Math.abs(
      distanceKm({ lat: 51.5, lon: -0.12 }, { lat: 48.86, lon: 2.35 }) - 343,
    ) < 5,
  );
});
