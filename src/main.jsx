import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import './lib/registerSW'
const App = lazy(() => import('./App.jsx'))
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'

// Admin pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminAgendamentos = lazy(() => import('./pages/admin/AdminAgendamentos.jsx'))
const AdminCalendario = lazy(() => import('./pages/admin/AdminCalendario.jsx'))
const AdminServicos = lazy(() => import('./pages/admin/AdminServicos.jsx'))
const AdminClientes = lazy(() => import('./pages/admin/AdminClientes.jsx'))
const AdminDisponibilidade = lazy(() => import('./pages/admin/AdminDisponibilidade.jsx'))
const AdminFinanceiro = lazy(() => import('./pages/admin/AdminFinanceiro.jsx'))
const AdminNotificacoes = lazy(() => import('./pages/admin/AdminNotificacoes.jsx'))
const AdminConfiguracoes = lazy(() => import('./pages/admin/AdminConfiguracoes.jsx'))

import RecoveryPage from './pages/RecoveryPage.jsx'
import DataProvider from './context/DataProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import SessionNotice from './components/SessionNotice.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import DataState from './components/DataState.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary><DataProvider><SessionNotice /><InstallPrompt /><Suspense fallback={<DataState loading />}><Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-acesso" element={<RecoveryPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/painel" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/agendar" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="agendamentos" element={<AdminAgendamentos />} />
            <Route path="calendario" element={<AdminCalendario />} />
            <Route path="servicos" element={<AdminServicos />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="disponibilidade" element={<AdminDisponibilidade />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="notificacoes" element={<AdminNotificacoes />} />
            <Route path="configuracoes" element={<AdminConfiguracoes />} />
          </Route>
        <Route path="*" element={<div className="min-h-screen bg-black text-white p-12">Página não encontrada. <a href="/">Voltar ao site</a></div>} /></Routes></Suspense></DataProvider></ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
