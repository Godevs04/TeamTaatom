# Locale Module – Developer Guide

Documentation for the **Locale** (places discovery) module.

---

## 1. Purpose & User Flow

- **Screen:** `app/(tabs)/locale.tsx` (tab: Locale).
- **Purpose:** Discover “locales” (places): list/filter by country, state, spot type; show on map; show distance if user location available; tap locale for detail or related posts.
- **User flow:** Open Locale tab → see list/map of places → filter by country/state/spot type → tap place → detail or posts at that place.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **List locales** | `getLocales(search, countryCode, stateCode, spotTypes, page, limit, includeInactive)`. |
| **Locale by ID** | `getLocaleById(id)` for detail screen. |
| **Filters** | Country, state, spot type (single or array); search query. |
| **Pagination** | page, limit (e.g. 50). |
| **Map** | Display locales on map; optional “current location” for distance. |
| **Distance** | If user location available, compute distance to each locale for sorting/display. |
| **Countries/States** | location service: countries list, states by country (for filter dropdowns). |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/locales?page=&limit=&search=&countryCode=&stateCode=&spotTypes=&includeInactive=` | List locales with filters. |
| GET | `/api/v1/locales/${id}` | Get single locale; response includes `locale`. |

**Query params:** page, limit, search, countryCode, stateCode, spotTypes (comma-separated), includeInactive (true/false).

---

## 4. Types & Schemas

**Locale (service):**

```ts
interface Locale {
  _id: string;
  name: string;
  country?: string;
  countryCode: string;
  stateProvince?: string;
  stateCode?: string;
  city?: string;
  description?: string;
  imageUrl: string;
  spotTypes?: string[];
  travelInfo?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  displayOrder?: number;
  createdAt: string;
}
```

**LocalesResponse:** success, message, locales[], pagination (currentPage, totalPages, total, limit).

---

## 5. File Map

| File | Role |
|------|------|
| `app/(tabs)/locale.tsx` | Locale tab: list, filters, map, distance. |
| `services/locale.ts` | getLocales, getLocaleById. |
| `services/location.ts` | Countries, states (for filter dropdowns). |
| Map components | Map view for locales and current location. |

---

## 6. Locale type – full schema (technical)

**Locale:** _id, name, country?, countryCode, stateProvince?, stateCode?, city?, description?, imageUrl, spotTypes? (string[]), travelInfo?, latitude?, longitude?, isActive, displayOrder?, createdAt.

**LocalesResponse:** success, message, locales (Locale[]), pagination (currentPage, totalPages, total, limit).

---

## 7. getLocales – query params (technical)

- **Required/default:** page (default 1), limit (default 50).
- **Optional:** search (trimmed string), countryCode (skip if 'all' or empty), stateCode (skip if 'all' or empty), spotTypes (string or array; if array join with ','), includeInactive (true to include inactive locales).
- **URL:** `GET /api/v1/locales?${params.toString()}`.

---

## 8. Distance calculation (functional)

- If user location available (Expo Location or stored), for each locale with latitude/longitude compute distance (e.g. Haversine). Sort or display "X km away". If no permission, hide distance or show "Enable location for distance."

---

## 9. Countries & states (location service)

- **Countries:** GET `/locations/countries` (or similar) for filter dropdown; may be from location.ts or config.
- **States:** GET `/locations/states/${countryCode}` for state filter when country selected. Used in Locale tab to filter by country/state before calling getLocales.

---

## 10. File map (detailed)

| File | Role |
|------|------|
| `app/(tabs)/locale.tsx` | Locale tab: filters (search, country, state, spot type), list or map of locales, getLocales with filter state; optional distance; tap locale → getLocaleById and navigate to detail or show in bottom sheet. |
| `services/locale.ts` | getLocales, getLocaleById. |
| `services/location.ts` | getCountries, getStates(countryCode) for dropdowns. |

---

*TripScore (continents/countries/locations): [10-ACTIVITY-SEARCH-TRIPSCORE.md](./10-ACTIVITY-SEARCH-TRIPSCORE.md). API: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*
