import { createContext, useContext } from 'react'

export const EntryFlowContext = createContext(null)

export function useEntryFlow() {
  const ctx = useContext(EntryFlowContext)
  if (!ctx) throw new Error('useEntryFlow must be used within EntryFlowProvider')
  return ctx
}
