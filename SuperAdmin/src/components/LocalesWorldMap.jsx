import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import { reverseGeocodeTourist, fetchTourismOsmInBounds, reverseAddressForImport } from '../utils/geocoding'

function isValidCoord(lat, lng) {
  if (lat == null || lng == null) return false
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat), 10)
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng), 10)
  if (Number.isNaN(la) || Number.isNaN(ln)) return false
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180
}

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

function ImportFromMapButton({ placePayload, onImportTouristPlace }) {
  const map = useMap()
  return (
    <button
      type="button"
      className="w-full mt-3 px-3 py-2 text-xs font-bold rounded-lg bg-blue-950 text-white hover:bg-blue-900 active:bg-blue-950 shadow-md shadow-blue-950/30 transition-colors border border-blue-800"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        map.closePopup()
        requestAnimationFrame(() => onImportTouristPlace(placePayload))
      }}
    >
      Import → create locale page
    </button>
  )
}

/** Auto-load OSM tourism POIs for current map bounds (navy dots). */
function TourismOsmMarkers({ enabled, onImportTouristPlace, onOsmUi }) {
  const map = useMap()
  const [pois, setPois] = useState([])
  const [hoverId, setHoverId] = useState(null)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)
  /** Avoid duplicate Overpass calls when fitBounds + moveend fire with same viewport */
  const lastSuccessfulFetchKeyRef = useRef('')

  const pushUi = useCallback(
    (partial) => {
      if (typeof onOsmUi === 'function') {
        onOsmUi((prev) => ({ ...prev, ...partial }))
      }
    },
    [onOsmUi]
  )

  const runFetch = useCallback(async () => {
    if (!enabled) return

    const z = map.getZoom()

    const b = map.getBounds()
    const south = b.getSouth()
    const west = b.getWest()
    const north = b.getNorth()
    const east = b.getEast()
    const latSpan = north - south
    const lngSpan = east - west

    /** Match backend Overpass bbox cap (~regional / large city); no fixed zoom level */
    if (latSpan > 0.55 || lngSpan > 0.55) {
      lastSuccessfulFetchKeyRef.current = ''
      setPois([])
      pushUi({
        loading: false,
        count: 0,
        message:
          'Zoom or pan so this map window is smaller — navy landmark pins load when the view is city-sized (area limit). Green dots are your saved locales.',
      })
      return
    }

    const fetchKey = `${z}_${south.toFixed(4)}_${west.toFixed(4)}_${north.toFixed(4)}_${east.toFixed(4)}`
    if (fetchKey === lastSuccessfulFetchKeyRef.current) {
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    pushUi({ loading: true, message: '' })

    try {
      const data = await fetchTourismOsmInBounds(south, west, north, east, signal)
      const list = data?.pois || []
      const hint = data?.hint
      setPois(Array.isArray(list) ? list : [])

      let message = ''
      if (hint === 'zoom_in_area') {
        message = 'Zoom in closer to load landmark pins.'
      } else if (hint === 'overpass_error' || hint === 'error') {
        message = 'Landmark list temporarily unavailable — try again or tap the map to search.'
      } else if (list.length === 0) {
        message = 'No mapped tourism spots in this view — pan slightly or tap the map to search Google.'
      } else {
        message = `${list.length} landmark${list.length === 1 ? '' : 's'} in view — click a navy dot to import.`
      }

      pushUi({
        loading: false,
        count: list.length,
        message,
      })
      lastSuccessfulFetchKeyRef.current = fetchKey
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
        return
      }
      setPois([])
      pushUi({
        loading: false,
        count: 0,
        message: 'Could not load landmarks — try again.',
      })
    }
  }, [enabled, map, pushUi])

  const scheduleFetch = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runFetch()
    }, 1200)
  }, [runFetch])

  useEffect(() => {
    if (!enabled) {
      lastSuccessfulFetchKeyRef.current = ''
      setPois([])
      pushUi({ loading: false, count: 0, message: '' })
      return undefined
    }

    scheduleFetch()

    const onMove = () => scheduleFetch()
    map.on('moveend', onMove)
    map.on('zoomend', onMove)

    return () => {
      map.off('moveend', onMove)
      map.off('zoomend', onMove)
      clearTimeout(debounceRef.current)
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [enabled, map, scheduleFetch, pushUi])

  if (!enabled || typeof onImportTouristPlace !== 'function') return null

  return (
    <>
      {pois.map((poi) => {
        const hovered = hoverId === poi.id
        return (
          <CircleMarker
            key={poi.id}
            center={[poi.lat, poi.lng]}
            radius={hovered ? 8 : 6}
            pathOptions={{
              color: '#172554',
              fillColor: hovered ? '#60a5fa' : '#1e3a8a',
              fillOpacity: 0.93,
              weight: hovered ? 3 : 2,
            }}
            eventHandlers={{
              mouseover: () => setHoverId(poi.id),
              mouseout: () => setHoverId(null),
            }}
          >
            <Popup className="locales-discover-popup-pane">
              <div className="min-w-[220px] max-w-[290px] overflow-hidden rounded-lg shadow-xl border-2 border-blue-950 ring-1 ring-blue-400/30">
                <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 px-3 py-2.5 text-white">
                  <p className="font-bold text-sm leading-tight tracking-tight">{poi.name}</p>
                  <p className="text-[10px] font-medium text-blue-100/90 mt-1 uppercase tracking-wide">
                    {poi.tourism ? `OSM · ${poi.tourism}` : 'OpenStreetMap landmark'}
                  </p>
                </div>
                <div className="bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-600 font-mono border-l-2 border-blue-900 pl-2">
                    {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
                  </p>
                  <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-950 border border-blue-200">
                    Ready to import
                  </span>
                  <ImportOsmLocaleButton poi={poi} onImportTouristPlace={onImportTouristPlace} />
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

function ImportOsmLocaleButton({ poi, onImportTouristPlace }) {
  const map = useMap()
  const [loading, setLoading] = useState(false)

  return (
    <button
      type="button"
      disabled={loading}
      className="w-full mt-3 px-3 py-2 text-xs font-bold rounded-lg bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-70 shadow-md shadow-blue-950/30 transition-colors border border-blue-800"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setLoading(true)
        try {
          const enriched = await reverseAddressForImport(poi.lat, poi.lng, poi.name)
          if (!enriched) {
            toast.error('Could not resolve address. Try again or fill the form manually.')
            return
          }
          map.closePopup()
          requestAnimationFrame(() => onImportTouristPlace(enriched))
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? 'Preparing…' : 'Import → create locale page'}
    </button>
  )
}

function MapTouristDiscover({ enabled, onImportTouristPlace }) {
  const [hit, setHit] = useState(null)
  const lastClickRef = useRef(0)
  const toastLoadRef = useRef(null)

  const dismissLoadingToast = useCallback(() => {
    if (toastLoadRef.current) {
      toast.dismiss(toastLoadRef.current)
      toastLoadRef.current = null
    }
  }, [])

  const touristIcon = useMemo(
    () =>
      L.divIcon({
        className: 'locales-tourist-marker',
        html:
          '<span class="locales-tourist-pin-outer"><span class="locales-tourist-pin-inner"></span></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    []
  )

  useMapEvents({
    click: async (e) => {
      if (!enabled || typeof onImportTouristPlace !== 'function') return
      const now = Date.now()
      if (now - lastClickRef.current < 750) return
      lastClickRef.current = now

      setHit(null)
      dismissLoadingToast()
      toastLoadRef.current = toast.loading('Checking this spot…')

      try {
        const data = await reverseGeocodeTourist(e.latlng.lat, e.latlng.lng)
        dismissLoadingToast()

        if (!data) {
          toast.error('Could not look up this location. Try again.')
          return
        }

        if (!data.isTouristPlace) {
          toast('No tourist attraction detected here — try tapping closer to a landmark or use a navy OSM dot.', {
            duration: 4200,
          })
          return
        }

        setHit({
          lat: data.lat,
          lng: data.lng,
          place: data,
        })
      } catch {
        dismissLoadingToast()
        toast.error('Could not look up this location.')
      }
    },
  })

  useEffect(() => {
    return () => dismissLoadingToast()
  }, [dismissLoadingToast])

  if (!enabled || typeof onImportTouristPlace !== 'function') return null

  return hit ? (
    <Marker
      position={[hit.lat, hit.lng]}
      icon={touristIcon}
      eventHandlers={{
        add: (ev) => {
          ev.target.openPopup()
        },
      }}
    >
      <Popup
        className="locales-discover-popup-pane"
        eventHandlers={{
          popupclose: () => setHit(null),
        }}
      >
        <div className="min-w-[220px] max-w-[290px] overflow-hidden rounded-lg shadow-xl border-2 border-blue-950 ring-1 ring-blue-400/30">
          <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 px-3 py-2.5 text-white">
            <p className="font-bold text-sm leading-tight tracking-tight">{hit.place.name || 'Place'}</p>
            <p className="text-[10px] font-medium text-blue-100/90 mt-1 uppercase tracking-wide">Google · landmark</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <p className="text-[11px] text-slate-700 leading-snug border-l-2 border-blue-900 pl-2">
              {hit.place.formattedAddress || `${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}`}
            </p>
            <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-950 border border-blue-200">
              Tourist place
            </span>
            <ImportFromMapButton placePayload={hit.place} onImportTouristPlace={onImportTouristPlace} />
          </div>
        </div>
      </Popup>
    </Marker>
  ) : null
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
 * World map of locales (SuperAdmin). Navy dots = OSM tourism POIs in view (auto). Tap empty map for Google fallback.
 */
export default function LocalesWorldMap({ locales = [], onPreviewLocale, onImportTouristPlace }) {
  const [hoverLocaleId, setHoverLocaleId] = useState(null)
  const [mapSurfaceHover, setMapSurfaceHover] = useState(false)
  const [osmUi, setOsmUi] = useState({ loading: false, count: 0, message: '' })

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

  const discoverEnabled = typeof onImportTouristPlace === 'function'

  return (
    <div className="space-y-3">
      <style>{`
        .locales-tourist-marker { background: transparent !important; border: none !important; }
        .locales-tourist-pin-outer {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: rgba(30, 58, 138, 0.25);
          animation: locales-pin-ring 2s ease-out infinite;
        }
        .locales-tourist-pin-inner {
          display: block;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #172554;
          border: 3px solid #fff;
          box-shadow: 0 2px 10px rgba(30, 58, 138, 0.55);
        }
        @keyframes locales-pin-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        .locales-discover-popup-pane .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 18px 50px rgba(23, 37, 84, 0.35);
        }
        .locales-discover-popup-pane .leaflet-popup-content {
          margin: 0;
          min-width: 220px;
        }
        .locales-discover-popup-pane .leaflet-popup-tip-container {
          filter: drop-shadow(0 4px 6px rgba(23, 37, 84, 0.25));
        }
      `}</style>

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

      <div
        className={`relative z-0 isolate h-[min(560px,70vh)] w-full min-h-[320px] rounded-xl overflow-hidden border shadow-md transition-all duration-300 bg-slate-100 ${
          discoverEnabled
            ? `border-blue-900/40 ${
                mapSurfaceHover
                  ? 'ring-4 ring-blue-900/35 shadow-[0_0_0_1px_rgba(30,58,138,0.5)]'
                  : 'ring-2 ring-blue-900/15 hover:ring-blue-900/30'
              }`
            : 'border-gray-200'
        }`}
        onMouseEnter={() => setMapSurfaceHover(true)}
        onMouseLeave={() => setMapSurfaceHover(false)}
      >
        {discoverEnabled && (
          <>
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-[700] flex flex-col items-center px-3 pt-3 gap-1 transition-all duration-300 ${
                mapSurfaceHover ? 'opacity-100 scale-[1.01]' : 'opacity-95'
              }`}
            >
              <div className="max-w-xl rounded-full border border-blue-700/50 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 px-4 py-2 text-center shadow-lg shadow-blue-950/40">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-100">Discover mode</p>
                <p className="text-xs font-medium text-white mt-0.5">
                  Navy dots = mapped landmarks (auto). Hover or click a dot → import. Or tap empty map for Google lookup.
                </p>
              </div>
              {(osmUi.message || osmUi.loading) && (
                <div className="rounded-lg border border-blue-800/40 bg-blue-950/85 px-3 py-1.5 text-[11px] text-blue-50 max-w-xl text-center shadow-md">
                  {osmUi.loading ? (
                    <span>Loading landmark pins from OpenStreetMap…</span>
                  ) : (
                    <span>{osmUi.message}</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}

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
          <TourismOsmMarkers enabled={discoverEnabled} onImportTouristPlace={onImportTouristPlace} onOsmUi={setOsmUi} />
          <MapTouristDiscover enabled={discoverEnabled} onImportTouristPlace={onImportTouristPlace} />
          {points.map((p) => {
            const active = p.locale.isActive !== false
            const hovered = hoverLocaleId === p.id
            const baseColor = active ? '#15803d' : '#9a3412'
            const baseFill = active ? '#22c55e' : '#fb923c'
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={hovered ? (active ? 11 : 9) : active ? 9 : 7}
                pathOptions={{
                  color: hovered ? '#172554' : baseColor,
                  fillColor: hovered ? '#3b82f6' : baseFill,
                  fillOpacity: hovered ? 0.95 : 0.9,
                  weight: hovered ? 4 : 2,
                  opacity: hovered ? 1 : 0.95,
                }}
                eventHandlers={{
                  mouseover: () => setHoverLocaleId(p.id),
                  mouseout: () => setHoverLocaleId(null),
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
          {discoverEnabled ? (
            <span className="text-slate-600">
              {' '}
              · <strong className="text-blue-950">Navy dots</strong>: suggested OSM landmarks for this map window (zoom/pan until they appear).{' '}
              <strong className="text-green-800">Green</strong> = your saved locales.
            </span>
          ) : null}
        </span>
        <span>© OpenStreetMap contributors</span>
      </div>
    </div>
  )
}
