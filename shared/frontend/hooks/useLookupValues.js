import { useState, useEffect } from 'react'
import { getLookupValues } from '@producers/api'

/**
 * Fetch and cache lookup values for a category + entity type.
 * Returns { values, loading } where values is [{id, value, display_label, css_class}].
 * Use `values` to populate <select> option lists in forms.
 * Display components should read lookup data directly from API response objects.
 */
export function useLookupValues(category, entityType) {
  const [values, setValues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLookupValues(category, entityType)
      .then(data => {
        if (!cancelled) setValues(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [category, entityType])

  return { values, loading }
}
