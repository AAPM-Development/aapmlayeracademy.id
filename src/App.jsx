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
import { exactColor, Ten4SevenProvider, ToastProvider } from '@ten4seven/ui';
import { ThemeModeProvider, useThemeMode } from '@/lib/useThemeMode';

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
    <div className="flex min-h-[14rem] items-center justify-center bg-background px-6 text-sm text-muted-foreground" role="status" aria-live="polite">
      <span className="mr-3 flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" />
      </span>
      Menyiapkan halaman…
    </div>
  );
}

function Ten4SevenRuntime({ children }) {
  const { mode } = useThemeMode();

  return (
    <Ten4SevenProvider
      theme="product"
      preferences={{ appearance: mode, density: 'default' }}
      overrides={{
        // Product recipe supplies composition; approved AAPM colors own the
        // action/accent roles instead of silently falling back to indigo/cyan.
        // Emerald keeps any non-brand semantic fallback in the same green
        // family; data series deliberately use the spectrum chart palette so
        // operational categories do not collapse into one green signal.
        config: {
          palette: 'emerald',
          chartPalette: 'spectrum',
          primary: exactColor('#318139'),
          accent: exactColor('#d4451a'),
        },
        // Provider-generated variables are emitted inline. Keep the focus
        // contract here so input borders, focus rings, and chart focus states
        // cannot fall back to the product recipe's unrelated blue default.
        variables: {
          '--t7-focus-hsl': 'var(--t7-primary-hsl)',
          '--t7-input-focus-border-hsl': 'var(--t7-primary-hsl)',
          '--t7-chart-focus-hsl': 'var(--t7-primary-hsl)',
          '--t7-focus-halo': '0 0 0 var(--t7-focus-offset) hsl(var(--t7-surface-hsl))',
          '--t7-focus-ring': 'var(--t7-focus-halo), 0 0 0 calc(var(--t7-focus-offset) + var(--t7-focus-width)) hsl(var(--t7-focus-hsl))',
          '--t7-focus-ring-inset': 'inset 0 0 0 var(--t7-focus-width) hsl(var(--t7-focus-hsl))',
        },
      }}
      className="aapm-t7-runtime"
    >
      {children}
    </Ten4SevenProvider>
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

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand-green bg-background"></div>
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
    <ThemeModeProvider>
      <Ten4SevenRuntime>
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
      </Ten4SevenRuntime>
    </ThemeModeProvider>
  )
}

export default App
