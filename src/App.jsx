import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import { Navigate } from 'react-router-dom';

const Layout = lazy(() => import('@/components/Layout'));
const AdminShell = lazy(() => import('@/components/layout/AdminShell'));
const Home = lazy(() => import('@/pages/Home'));
const Modules = lazy(() => import('@/pages/Modules'));
const ModuleDetail = lazy(() => import('@/pages/ModuleDetail'));
const Quiz = lazy(() => import('@/pages/Quiz'));
const Calculators = lazy(() => import('@/pages/Calculators'));
const KpiDashboard = lazy(() => import('@/pages/KpiDashboard'));
const AiAssistant = lazy(() => import('@/pages/AiAssistant'));
const Certification = lazy(() => import('@/pages/Certification'));
const Profile = lazy(() => import('@/pages/Profile'));
const FinalExam = lazy(() => import('@/pages/FinalExam'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'));
const AdminCourseDetail = lazy(() => import('@/pages/admin/AdminCourseDetail'));
const AdminLearners = lazy(() => import('@/pages/admin/AdminLearners'));
const AdminLearnerDetail = lazy(() => import('@/pages/admin/AdminLearnerDetail'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminModuleEditor = lazy(() => import('@/pages/admin/AdminModuleEditor'));
const AdminAiSettings = lazy(() => import('@/pages/admin/AdminAiSettings'));
const AdminWorkspaceStatus = lazy(() => import('@/pages/admin/AdminWorkspaceStatus'));

function RouteLoading() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-6 text-sm text-muted-foreground" role="status" aria-live="polite">
      <span className="mr-3 h-2 w-2 animate-pulse rounded-full bg-brand-orange" aria-hidden="true" />
      Memuat halaman…
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    return <div className="fixed inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">{authError.message}</div>;
  }

  // Render the main app
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/modules/:moduleNumber" element={<ModuleDetail />} />
            <Route path="/quiz/:moduleNumber" element={<Quiz />} />
            <Route path="/final-exam" element={<FinalExam />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/kpi" element={<KpiDashboard />} />
            <Route path="/ai-assistant" element={<AiAssistant />} />
            <Route path="/certification" element={<Certification />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<AdminShell />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/courses/:courseId/modules/:moduleId" element={<AdminModuleEditor />} />
              <Route path="/admin/courses/:courseId" element={<AdminCourseDetail />} />
              <Route path="/admin/learners" element={<AdminLearners />} />
              <Route path="/admin/learners/:learnerId" element={<AdminLearnerDetail />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/ai-settings" element={<AdminAiSettings />} />
              <Route path="/admin/workspace-status" element={<AdminWorkspaceStatus />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
