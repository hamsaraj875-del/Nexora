import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// ── Landing / Login ─────────────────────────────────────────────────────────
import { LandingLoginPage } from './pages/LandingLoginPage';

// ── Officer Portal ───────────────────────────────────────────────────────────
import { OfficerLayout } from './portals/officer/OfficerLayout';
import { OfficerLoginPage } from './portals/officer/pages/OfficerLoginPage';
import { OfficerDashboardPage } from './portals/officer/pages/OfficerDashboardPage';
import { OfficerCasesPage } from './portals/officer/pages/OfficerCasesPage';
import { OfficerCaseDetailPage } from './portals/officer/pages/OfficerCaseDetailPage';
import { OfficerAssignmentQueuePage } from './portals/officer/pages/OfficerAssignmentQueuePage';
import { OfficerOverlapsPage } from './portals/officer/pages/OfficerOverlapsPage';
import { OfficerMatchReviewPage } from './portals/officer/pages/OfficerMatchReviewPage';
import { OfficerAlertsPage } from './portals/officer/pages/OfficerAlertsPage';
import { OfficerInstitutionsPage } from './portals/officer/pages/OfficerInstitutionsPage';
import { OfficerInstitutionDetailPage } from './portals/officer/pages/OfficerInstitutionDetailPage';
import { OfficerReportsPage } from './portals/officer/pages/OfficerReportsPage';
import { OfficerAdminPage } from './portals/officer/pages/OfficerAdminPage';

// ── Bureau Portal ────────────────────────────────────────────────────────────
import { BureauLayout } from './portals/bureau/BureauLayout';
import { BureauLoginPage } from './portals/bureau/pages/BureauLoginPage';
import { BureauDashboardPage } from './portals/bureau/pages/BureauDashboardPage';
import { BureauCasesPage } from './portals/bureau/pages/BureauCasesPage';
import { BureauAttentionPage } from './portals/bureau/pages/BureauAttentionPage';
import { BureauCaseDetailPage } from './portals/bureau/pages/BureauCaseDetailPage';
import { BureauOverlapsPage } from './portals/bureau/pages/BureauOverlapsPage';
import { BureauImportsPage } from './portals/bureau/pages/BureauImportsPage';
import { BureauAlertsPage } from './portals/bureau/pages/BureauAlertsPage';

// ── Student Portal ───────────────────────────────────────────────────────────
import { StudentLayout } from './portals/student/StudentLayout';
import { StudentLoginPage } from './portals/student/pages/StudentLoginPage';
import { StudentRegisterPage } from './portals/student/pages/StudentRegisterPage';
import { StudentComplaintsPage } from './portals/student/pages/StudentComplaintsPage';
import { StudentNewComplaintPage } from './portals/student/pages/StudentNewComplaintPage';
import { StudentNeedsReplyPage } from './portals/student/pages/StudentNeedsReplyPage';
import { StudentClosedPage } from './portals/student/pages/StudentClosedPage';
import { StudentCaseDetailPage } from './portals/student/pages/StudentCaseDetailPage';

// ── Global loading fallback ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
      <Loader2 className="w-8 h-8 animate-spin text-[#00E676]" />
    </div>
  );
}

// ── QueryClient ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ── Direct Multi-Portal Login ─────────────────────────── */}
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<LandingLoginPage />} />
                  <Route path="/officer/login" element={<LandingLoginPage defaultPortal="officer" />} />
                  <Route path="/bureau/login" element={<LandingLoginPage defaultPortal="bureau" />} />
                  <Route path="/student/login" element={<LandingLoginPage defaultPortal="student" />} />
                  {/* Public: student self-registration */}
                  <Route path="/student/register" element={<StudentRegisterPage />} />

                  {/* ── Officer Portal ──────────────────────────────────── */}
                  <Route
                    path="/officer"
                    element={
                      <ProtectedRoute portal="officer">
                        <OfficerLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<OfficerDashboardPage />} />
                    <Route path="cases" element={<OfficerCasesPage />} />
                    <Route path="cases/:id" element={<OfficerCaseDetailPage />} />
                    <Route path="assignment-queue" element={<OfficerAssignmentQueuePage />} />
                    <Route path="overlaps" element={<OfficerOverlapsPage />} />
                    <Route path="match-review" element={<OfficerMatchReviewPage />} />
                    <Route path="alerts" element={<OfficerAlertsPage />} />
                    <Route path="institutions" element={<OfficerInstitutionsPage />} />
                    <Route path="institutions/:id" element={<OfficerInstitutionDetailPage />} />
                    <Route path="reports" element={<OfficerReportsPage />} />
                    <Route path="admin" element={<OfficerAdminPage />} />
                    <Route path="*" element={<Navigate to="/officer" replace />} />
                  </Route>

                  {/* ── Bureau Portal ───────────────────────────────────── */}
                  <Route
                    path="/bureau"
                    element={
                      <ProtectedRoute portal="bureau">
                        <BureauLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<BureauDashboardPage />} />
                    <Route path="cases" element={<BureauCasesPage />} />
                    <Route path="cases/:id" element={<BureauCaseDetailPage />} />
                    <Route path="attention" element={<BureauAttentionPage />} />
                    <Route path="overlaps" element={<BureauOverlapsPage />} />
                    <Route path="imports" element={<BureauImportsPage />} />
                    <Route path="match-review" element={<OfficerMatchReviewPage />} />
                    <Route path="alerts" element={<BureauAlertsPage />} />
                    <Route path="*" element={<Navigate to="/bureau" replace />} />
                  </Route>

                  {/* ── Student Portal ──────────────────────────────────── */}
                  <Route
                    path="/student"
                    element={
                      <ProtectedRoute portal="student">
                        <StudentLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<StudentComplaintsPage />} />
                    <Route path="new" element={<StudentNewComplaintPage />} />
                    <Route path="needs-reply" element={<StudentNeedsReplyPage />} />
                    <Route path="closed" element={<StudentClosedPage />} />
                    <Route path="cases/:id" element={<StudentCaseDetailPage />} />
                    <Route path="*" element={<Navigate to="/student" replace />} />
                  </Route>

                  {/* ── Global fallback ─────────────────────────────────── */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
