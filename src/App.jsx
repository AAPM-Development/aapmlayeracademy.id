import { lazy, Suspense, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import { Navigate } from 'react-router-dom';
import { loadRouteModule, preloadRoute } from '@/lib/routePreloaders';
import { ToastProvider } from '@/design-system/components/toast';
import { TooltipProvider } from '@/design-system/components/tooltip';
import { ThemeModeProvider } from '@/lib/useThemeMode';

const Layout = lazy(() => loadRouteModule('layout'));
const AdminShell = lazy(() => loadRouteModule('adminShell'));
const Home = lazy(() => loadRouteModule('home'));
const Modules = lazy(() => loadRouteModule('modules'));
const ModuleDetail = lazy(() => loadRouteModule('moduleDetail'));
const Quiz = lazy(() => loadRouteModule('quiz'));
const Calculators = lazy(() => loadRouteModule('calculators'));
const KpiDashboard = lazy(() => loadRouteModule('kpi'));
const AiAssistant = lazy(() => loadRouteModule('aiAssistant'));
const Certification = lazy(() => loadRouteModule('certification'));
const Profile = lazy(() => loadRouteModule('profile'));
const FinalExam = lazy(() => loadRouteModule('finalExam'));
const Login = lazy(() => loadRouteModule('login'));
const Register = lazy(() => loadRouteModule('register'));
const ForgotPassword = lazy(() => loadRouteModule('forgotPassword'));
const ResetPassword = lazy(() => loadRouteModule('resetPassword'));
const AdminOverview = lazy(() => loadRouteModule('adminOverview'));
const AdminCourses = lazy(() => loadRouteModule('adminCourses'));
const AdminCourseDetail = lazy(() => loadRouteModule('adminCourseDetail'));
const AdminLearners = lazy(() => loadRouteModule('adminLearners'));
const AdminLearnerDetail = lazy(() => loadRouteModule('adminLearnerDetail'));
const AdminUsers = lazy(() => loadRouteModule('adminUsers'));
const AdminModuleEditor = lazy(() => loadRouteModule('adminModuleEditor'));
const AdminAiSettings = lazy(() => loadRouteModule('adminAiSettings'));
const AdminWorkspaceStatus = lazy(() => loadRouteModule('adminWorkspaceStatus'));

function RouteLoading() {
  return (
    <div className="aapm-route-loading" role="status" aria-live="polite">
      <span className="aapm-spinner" aria-hidden="true" />
      Menyiapkan halaman…
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const timer = window.setTimeout(() => {
      ["/", "/modules", "/calculators", "/profile", "/ai-assistant"].forEach(
        (path) => void preloadRoute(path),
      );
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  // Brand boot screen while public settings and the session are resolved.
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="aapm-boot-screen" role="status" aria-label="Memuat Academy">
        <img src="/brand/aapm/icon.svg" alt="" className="aapm-boot-screen__mark" />
        <span className="aapm-spinner" aria-hidden="true" />
      </div>
    );
  }

  if (authError) {
    return <div className="aapm-boot-screen aapm-boot-screen--error" role="alert">{authError.message}</div>;
  }

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
    <ThemeModeProvider>
      <TooltipProvider>
        <ToastProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <ScrollToTop />
                <AuthenticatedApp />
              </Router>
            </QueryClientProvider>
          </AuthProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeModeProvider>
  )
}

export default App
