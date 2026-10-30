"use client";
import { useState } from "react";
import { VehicleCard, type PublicVehicle } from "./vehicle-card";
export function FleetBrowser({
  cars,
  query,
  initialCategory = "",
}: {
  cars: PublicVehicle[];
  query: string;
  initialCategory?: string;
}) {
  const [filter, setFilter] = useState(initialCategory || "All Cars");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("All Brands");
  const [sort, setSort] = useState("featured");
  const visible = cars
    .filter(
      (c) =>
        (filter === "All Cars" ||
          c.category.toLowerCase().includes(filter.toLowerCase())) &&
        c.name.toLowerCase().includes(search.toLowerCase()) &&
        (brand === "All Brands" || c.name.startsWith(brand)),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.dailyRate - b.dailyRate
        : sort === "price-desc"
          ? b.dailyRate - a.dailyRate
          : 0,
    );
  return (
    <>
      <div className="filter-bar">
        <div className="filter-tabs" role="group" aria-label="Car category">
          {["All Cars", "Sedan", "SUV", "Hatchback", "Luxury"].map((f) => (
            <button
              type="button"
              aria-pressed={filter === f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          aria-label="Search vehicles"
          placeholder="Search cars"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="fleet-results-toolbar">
        <p role="status">{visible.length} Vehicles Found</p>
        <div>
          <select
            aria-label="Filter by brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            {[
              "All Brands",
              ...Array.from(new Set(cars.map((c) => c.name.split(" ")[0]))),
            ].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select
            aria-label="Sort vehicles"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="featured">Featured Order</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>
      <div className="fleet-grid">
        {visible.map((c) => (
          <VehicleCard car={c} query={query} detailed key={c.id} />
        ))}
      </div>
      {!visible.length && (
        <div className="empty">
          <h3>No vehicles match this search.</h3>
          <p>Try another category or change your dates.</p>
          <button
            className="button"
            onClick={() => {
              setFilter("All Cars");
              setSearch("");
              setBrand("All Brands");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </>
  );
}
