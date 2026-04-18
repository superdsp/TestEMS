// Hook for using mock data in local development
import { useState, useEffect } from 'react'
import { mockApi } from '../lib/mockData'
import type { SystemSnapshot } from '../lib/types'

const USE_MOCK = import.meta.env.DEV

export function useSimulation() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      // Use mock data
      const update = () => {
        setSnapshot(mockApi.getSimulation())
        setHistory(mockApi.getRealtime('15min'))
        setLoading(false)
      }
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    } else {
      // Use real API
      const fetchData = async () => {
        try {
          const res = await fetch('/api/simulation')
          const data = await res.json()
          setSnapshot(data)
          setLoading(false)
        } catch (err) {
          console.error('Failed to fetch simulation:', err)
        }
      }
      fetchData()
      const interval = setInterval(fetchData, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  return { snapshot, history, loading }
}

export function useHistory(range: 'day' | 'week' | 'month' | 'year') {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      setData(mockApi.getHistory(range))
      setLoading(false)
    } else {
      const fetchData = async () => {
        try {
          const res = await fetch(`/api/history?range=${range}`)
          const result = await res.json()
          setData(result)
          setLoading(false)
        } catch (err) {
          console.error('Failed to fetch history:', err)
        }
      }
      fetchData()
    }
  }, [range])

  return { data, loading }
}

export function useRealtime(range: '15min' | '1hour' | '24hour') {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      setData(mockApi.getRealtime(range))
      setLoading(false)
    } else {
      const fetchData = async () => {
        try {
          const res = await fetch(`/api/realtime?range=${range}`)
          const result = await res.json()
          setData(result)
          setLoading(false)
        } catch (err) {
          console.error('Failed to fetch realtime:', err)
        }
      }
      fetchData()
    }
  }, [range])

  return { data, loading }
}
