import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function isValidCoord(lat, lng) {
  if (lat == null || lng == null) return false
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat), 10)
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng), 10)
  if (Number.isNaN(la) || Number.isNaN(ln)) return false
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180
}

/**
 * Closes the Leaflet popup before opening the app modal so z-index / stacking stays sane
 * (Leaflet popups use z-index ~6500; our Modal defaulted much lower).
 */
function PreviewDetailsButton({ locale, onPreviewLocale }) {
  const map = useMap()
  return (
    <button
      type="button"
      className="w-full mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        map.closePopup()
        requestAnimationFrame(() => onPreviewLocale(locale))
      }}
    >
      Preview details
    </button>
  )
}

function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) {
      map.setView([20, 0], 2)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14 })
    }
  }, [map, points])

  return null
}

/**
 * World map of locales (SuperAdmin). Requires latitude/longitude on each locale.
 */
export default function LocalesWorldMap({ locales = [], onPreviewLocale }) {
  const points = useMemo(() => {
    return (locales || [])
      .map((l) => {
        const lat = typeof l.latitude === 'number' ? l.latitude : parseFloat(String(l.latitude), 10)
        const lng = typeof l.longitude === 'number' ? l.longitude : parseFloat(String(l.longitude), 10)
        return {
          id: String(l._id),
          lat,
          lng,
          locale: l,
        }
      })
      .filter((p) => isValidCoord(p.lat, p.lng))
  }, [locales])

  const missingCount = Math.max(0, (locales?.length || 0) - points.length)

  return (
    <div className="space-y-3">
      {missingCount > 0 && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center gap-2"
          role="status"
        >
          <span className="font-semibold">{missingCount}</span>
          <span>
            {missingCount === 1
              ? 'locale has no coordinates and is not shown on the map. Edit the locale to add lat/lng.'
              : 'locales have no coordinates and are not shown on the map. Edit them to add lat/lng.'}
          </span>
        </div>
      )}

      <div className="relative z-0 isolate h-[min(560px,70vh)] w-full min-h-[320px] rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="h-full w-full"
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((p) => {
            const active = p.locale.isActive !== false
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={active ? 9 : 7}
                pathOptions={{
                  color: active ? '#15803d' : '#9a3412',
                  fillColor: active ? '#22c55e' : '#fb923c',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="min-w-[200px] max-w-[260px] text-gray-900">
                    <p className="font-bold text-sm leading-tight mb-1">{p.locale.name || 'Locale'}</p>
                    <p className="text-xs text-gray-600 mb-2">
                      {[p.locale.city, p.locale.stateProvince].filter(Boolean).join(', ') || '—'}
                      {p.locale.countryCode ? ` · ${p.locale.countryCode}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          active ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </span>
                    </div>
                    {typeof onPreviewLocale === 'function' && (
                      <PreviewDetailsButton locale={p.locale} onPreviewLocale={onPreviewLocale} />
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Showing <strong className="text-gray-700">{points.length}</strong> plotted
          {locales?.length ? (
            <>
              {' '}
              of <strong className="text-gray-700">{locales.length}</strong> in current filter
            </>
          ) : null}
        </span>
        <span>© OpenStreetMap contributors</span>
      </div>
    </div>
  )
}
