import { useEffect, useState } from 'react'

import { fetchGrowthSettings, getDefaultGrowthSettings, type GrowthSettings } from '@/services/growthService'

export const useGrowthSettings = () => {
  const [settings, setSettings] = useState<GrowthSettings>(getDefaultGrowthSettings())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)

    fetchGrowthSettings()
      .then((nextSettings) => {
        if (active) {
          setSettings(nextSettings)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return {
    settings,
    loading,
  }
}
