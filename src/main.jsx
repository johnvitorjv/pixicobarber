import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './hooks/useStore' // Inicializa interceptação reativa do localStorage
import './index.css'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'

// Admin pages
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminAgendamentos from './pages/admin/AdminAgendamentos.jsx'
import AdminCalendario from './pages/admin/AdminCalendario.jsx'
import AdminServicos from './pages/admin/AdminServicos.jsx'
import AdminClientes from './pages/admin/AdminClientes.jsx'
import AdminDisponibilidade from './pages/admin/AdminDisponibilidade.jsx'
import AdminFinanceiro from './pages/admin/AdminFinanceiro.jsx'
import AdminNotificacoes from './pages/admin/AdminNotificacoes.jsx'
import AdminConfiguracoes from './pages/admin/AdminConfiguracoes.jsx'

// Seed de serviços padrão na inicialização
import serviceStore from './stores/serviceStore'
serviceStore.seedDefaults()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/painel" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/agendar" element={<BookingPage />} />

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
