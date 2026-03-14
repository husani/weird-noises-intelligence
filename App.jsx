import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AuthGuard from '@shared/auth/AuthGuard'
import Layout from '@shared/layout/Layout'

const Home = lazy(() => import('@shared/pages/Home'))
const SkeletonTool = lazy(() => import('@skeleton/SkeletonPage'))
const ProducersTool = lazy(() => import('@producers/pages/ProducersPage'))

export default function App() {
  return (
    <AuthGuard>
      <Layout>
        <Suspense fallback={<div className="disc-center"><div className="loading-spinner" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/skeleton/*" element={<SkeletonTool />} />
            <Route path="/producers/*" element={<ProducersTool />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthGuard>
  )
}
