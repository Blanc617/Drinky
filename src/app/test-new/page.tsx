import { Suspense } from 'react'
import TestNewClient from './TestNewClient'

export const dynamic = 'force-dynamic'

export default function TestNewPage() {
  return (
    <Suspense>
      <TestNewClient />
    </Suspense>
  )
}
