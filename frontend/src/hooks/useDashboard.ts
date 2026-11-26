import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectToEvents,
  dashboardClientConfig,
  fetchDashboardSnapshot,
  type DashboardSnapshot,
  type SnapshotResult,
} from '../lib/dashboard-client'

type RealtimeState = {
  status: 'not-configured' | 'connecting' | 'connected' | 'disconnected'
}

export function useDashboard() {
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResult>(() =>
    dashboardClientConfig.isConfigured
      ? { state: 'loading', snapshot: null, message: null }
      : {
          state: 'not-configured',
          snapshot: null,
          message: 'La conexión de datos no está configurada.',
        },
  )
  const [realtime, setRealtime] = useState<RealtimeState>({
    status: dashboardClientConfig.hasRealtime ? 'connecting' : 'not-configured',
  })
  const requestController = useRef<AbortController | null>(null)

  const requestSnapshot = useCallback(async (signal: AbortSignal) => {
    try {
      const snapshot: DashboardSnapshot = await fetchDashboardSnapshot(signal)
      setSnapshotResult({ state: 'ready', snapshot, message: null })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setSnapshotResult({
        state: 'error',
        snapshot: null,
        message:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al cargar los datos.',
      })
    }
  }, [])

  const refreshInBackground = useCallback(async () => {
    if (!dashboardClientConfig.isConfigured) return

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    await requestSnapshot(controller.signal)
  }, [requestSnapshot])

  const refresh = useCallback(async () => {
    if (!dashboardClientConfig.isConfigured) {
      setSnapshotResult({
        state: 'not-configured',
        snapshot: null,
        message: 'La conexión de datos no está configurada.',
      })
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setSnapshotResult({ state: 'loading', snapshot: null, message: null })
    await requestSnapshot(controller.signal)
  }, [requestSnapshot])

  useEffect(() => {
    if (!dashboardClientConfig.isConfigured) {
      return
    }

    const controller = new AbortController()
    requestController.current = controller
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void requestSnapshot(controller.signal)
      }
    })
    return () => {
      controller.abort()
    }
  }, [requestSnapshot])

  useEffect(() => {
    if (!dashboardClientConfig.hasRealtime) {
      return
    }

    return connectToEvents(
      (connected) => {
        queueMicrotask(() => {
          setRealtime((current) => ({
            ...current,
            status: connected ? 'connected' : 'disconnected',
          }))
        })
      },
      () => void refreshInBackground(),
      () => {
        setRealtime((current) => ({ ...current, status: 'disconnected' }))
      },
    )
  }, [refreshInBackground])

  return {
    snapshot: snapshotResult.snapshot,
    snapshotState: snapshotResult.state,
    snapshotMessage: snapshotResult.message,
    refresh,
    realtime,
  }
}
