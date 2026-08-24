import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import Layout from '@/components/Layout';
import AdminShell from '@/components/layout/AdminShell';
import Home from '@/pages/Home';
import Modules from '@/pages/Modules';
import ModuleDetail from '@/pages/ModuleDetail';
import Quiz from '@/pages/Quiz';
import Calculators from '@/pages/Calculators';
import KpiDashboard from '@/pages/KpiDashboard';
import AiAssistant from '@/pages/AiAssistant';
import Certification from '@/pages/Certification';
import FinalExam from '@/pages/FinalExam';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminCourses from '@/pages/admin/AdminCourses';
import AdminCourseDetail from '@/pages/admin/AdminCourseDetail';
import AdminLearners from '@/pages/admin/AdminLearners';
import AdminLearnerDetail from '@/pages/admin/AdminLearnerDetail';
import AdminAiSettings from '@/pages/admin/AdminAiSettings';
import { Navigate } from 'react-router-dom';
// Add page imports here

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
        </Route>
        <Route element={<AdminRoute />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/courses" element={<AdminCourses />} />
            <Route path="/admin/courses/:courseId" element={<AdminCourseDetail />} />
          <Route path="/admin/learners" element={<AdminLearners />} />
          <Route path="/admin/learners/:learnerId" element={<AdminLearnerDetail />} />
          <Route path="/admin/ai-settings" element={<AdminAiSettings />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
