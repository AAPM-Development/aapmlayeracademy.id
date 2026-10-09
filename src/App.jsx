import { lazy, Suspense, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Outlet, Route, Routes } from 'react-router-dom';
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
import AppBrand from '@/components/AppBrand';
import AapmIcon from '@/components/icons/AapmIcon';
import { Button, StateView } from '@/design-system';
import { StatusPage } from '@/design-system/patterns/AppShell';

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
const VerifyEmail = lazy(() => loadRouteModule('verifyEmail'));
const VerifyCertificate = lazy(() => loadRouteModule('verifyCertificate'));
const AdminCertificates = lazy(() => loadRouteModule('adminCertificates'));
const AdminOverview = lazy(() => loadRouteModule('adminOverview'));
const AdminCourses = lazy(() => loadRouteModule('adminCourses'));
const AdminCourseDetail = lazy(() => loadRouteModule('adminCourseDetail'));
const AdminLearners = lazy(() => loadRouteModule('adminLearners'));
const AdminLearnerDetail = lazy(() => loadRouteModule('adminLearnerDetail'));
const AdminUsers = lazy(() => loadRouteModule('adminUsers'));
const AdminModuleEditor = lazy(() => loadRouteModule('adminModuleEditor'));
const AdminAiSettings = lazy(() => loadRouteModule('adminAiSettings'));
const AdminWorkspaceStatus = lazy(() => loadRouteModule('adminWorkspaceStatus'));

/**
 * Boot surface for everything before a shell paints: the session check and
 * the first route chunk share one centred, branded screen, so a hard load
 * never jumps from the mark to a loose text line. The shells take over with
 * an in-canvas fallback once their chrome is up.
 */
function BootScreen({ label }) {
  return (
    <div className="aapm-boot-screen" role="status" aria-live="polite">
      <AppBrand variant="icon" className="aapm-boot-screen__mark" alt="" />
      <span className="aapm-spinner" aria-hidden="true" />
      <span className="aapm-boot-screen__label">{label}</span>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, checkAppState } = useAuth();

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
    return <BootScreen label="Memuat Academy…" />;
  }

  // The session check failed for a reason other than "signed out": say so
  // and offer the retry, instead of leaving a bare line of red text.
  if (authError) {
    return (
      <StatusPage>
        <StateView
          kind="error"
          titleAs="h1"
          title="Academy belum bisa dimuat"
          description={authError.message}
          action={<Button onClick={() => void checkAppState()}><AapmIcon name="refresh" />Coba lagi</Button>}
        />
      </StatusPage>
    );
  }

  return (
    <Suspense fallback={<BootScreen label="Menyiapkan halaman…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-certificate/:publicId" element={<VerifyCertificate />} />
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
              <Route path="/admin/certificates" element={<AdminCertificates />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/ai-settings" element={<AdminAiSettings />} />
              <Route path="/admin/workspace-status" element={<AdminWorkspaceStatus />} />
              <Route path="/admin/*" element={<PageNotFound scope="admin" />} />
            </Route>
          </Route>
        </Route>
        {/* Signed in, an unknown address keeps the learner shell around the 404. */}
        <Route element={isAuthenticated ? <Layout /> : <Outlet />}>
          <Route path="*" element={<PageNotFound />} />
        </Route>
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
