/**
 * Root application component.
 *
 * Wraps everything in AuthGuard (redirects to login if not authenticated),
 * then Layout (nav bar), then a Suspense boundary for lazy-loaded tool routes.
 *
 * To add a new tool route:
 * 1. Add a lazy import: const MyTool = lazy(() => import('./mytool/MyToolPage'))
 * 2. Add a Route: <Route path="/mytool/*" element={<MyTool />} />
 */

import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AuthGuard from './shared/auth/AuthGuard'
import Layout from './shared/layout/Layout'

const Home = lazy(() => import('./pages/Home'))
const SkeletonTool = lazy(() => import('./skeleton/SkeletonPage'))

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
      <div className="loading-spinner" />
    </div>
  )
}

export default function App() {
  return (
    <AuthGuard>
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/skeleton/*" element={<SkeletonTool />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthGuard>
  )
}
