import { useEffect, useRef, useState, useCallback } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

if (API_KEY) {
  setOptions({ key: API_KEY })
}

function parseAddressComponents(components) {
  const result = { city: '', state_region: '', country: '' }
  if (!components) return result

  for (const c of components) {
    const types = c.types
    if (types.includes('locality')) result.city = c.longText || ''
    else if (types.includes('postal_town') && !result.city) result.city = c.longText || ''
    else if (types.includes('administrative_area_level_2') && !result.city) result.city = c.longText || ''
    if (types.includes('administrative_area_level_1')) result.state_region = c.longText || ''
    if (types.includes('country')) result.country = c.longText || ''
  }
  return result
}

function formatLocation(city, stateRegion, country) {
  return [city, stateRegion, country].filter(Boolean).join(', ')
}

/**
 * LocationAutocomplete — Google Places city search rendered in design-system UI.
 *
 * Uses Places API fetchAutocompleteSuggestions() for results,
 * rendered in our own dropdown. Falls back to manual inputs
 * if API key is missing.
 *
 * @param {string} city
 * @param {string} stateRegion
 * @param {string} country
 * @param {function} onChange - Called with { city, state_region, country }
 */
export default function LocationAutocomplete({ city, stateRegion, country, onChange }) {
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionTokenRef = useRef(null)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!API_KEY) return
    importLibrary('places').then(() => setReady(true)).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
    }
    return sessionTokenRef.current
  }, [])

  useEffect(() => {
    if (!ready || !query.trim()) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: getSessionToken(),
          includedPrimaryTypes: ['(cities)'],
        })
        setSuggestions(result.suggestions || [])
        setOpen(true)
      } catch {
        setSuggestions([])
      }
      setLoading(false)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, ready, getSessionToken])

  async function handleSelect(suggestion) {
    setOpen(false)
    setSuggestions([])
    try {
      const place = suggestion.placePrediction.toPlace()
      await place.fetchFields({ fields: ['addressComponents'] })
      const parsed = parseAddressComponents(place.addressComponents)
      onChange(parsed)
      setQuery('')
      // End session — next search gets a new token
      sessionTokenRef.current = null
    } catch {
      // Fallback: use the suggestion text
      onChange({ city: suggestion.placePrediction.mainText?.text || query, state_region: '', country: '' })
      setQuery('')
    }
  }

  function handleClear() {
    onChange({ city: '', state_region: '', country: '' })
    setQuery('')
  }

  if (!ready) {
    return <FallbackInputs city={city} stateRegion={stateRegion} country={country} onChange={onChange} />
  }

  const locationDisplay = formatLocation(city, stateRegion, country)

  // If a location is already set, show it with a clear button
  if (locationDisplay) {
    return (
      <div className="location-selected">
        <span>{locationDisplay}</span>
        <button type="button" className="location-clear" onClick={handleClear}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="location-autocomplete">
      <input
        className="input input-full"
        placeholder="Search for a city..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div className="location-dropdown">
          {suggestions.map((s, i) => {
            const pred = s.placePrediction
            return (
              <div key={i} className="location-option" onClick={() => handleSelect(s)}>
                <span className="cell-strong">{pred.mainText?.text}</span>
                {pred.secondaryText?.text && <span className="cell-muted"> — {pred.secondaryText.text}</span>}
              </div>
            )
          })}
        </div>
      )}
      {open && query.trim() && !loading && suggestions.length === 0 && (
        <div className="location-dropdown">
          <div className="location-empty">No cities found</div>
        </div>
      )}
    </div>
  )
}

function FallbackInputs({ city, stateRegion, country, onChange }) {
  return (
    <div className="form-grid-3col">
      <input
        className="input"
        placeholder="City"
        value={city || ''}
        onChange={e => onChange({ city: e.target.value, state_region: stateRegion || '', country: country || '' })}
      />
      <input
        className="input"
        placeholder="State/Region"
        value={stateRegion || ''}
        onChange={e => onChange({ city: city || '', state_region: e.target.value, country: country || '' })}
      />
      <input
        className="input"
        placeholder="Country"
        value={country || ''}
        onChange={e => onChange({ city: city || '', state_region: stateRegion || '', country: e.target.value })}
      />
    </div>
  )
}
