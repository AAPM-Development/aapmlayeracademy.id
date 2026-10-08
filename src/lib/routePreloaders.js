const routeLoaders = {
  layout: () => import("@/components/Layout"),
  adminShell: () => import("@/components/layout/AdminShell"),
  home: () => import("@/pages/Home"),
  modules: () => import("@/pages/Modules"),
  moduleDetail: () => import("@/pages/ModuleDetail"),
  quiz: () => import("@/pages/Quiz"),
  calculators: () => import("@/pages/Calculators"),
  kpi: () => import("@/pages/KpiDashboard"),
  aiAssistant: () => import("@/pages/AiAssistant"),
  certification: () => import("@/pages/Certification"),
  profile: () => import("@/pages/Profile"),
  finalExam: () => import("@/pages/FinalExam"),
  login: () => import("@/pages/Login"),
  register: () => import("@/pages/Register"),
  forgotPassword: () => import("@/pages/ForgotPassword"),
  resetPassword: () => import("@/pages/ResetPassword"),
  verifyEmail: () => import("@/pages/VerifyEmail"),
  adminOverview: () => import("@/pages/admin/AdminOverview"),
  adminCourses: () => import("@/pages/admin/AdminCourses"),
  adminCourseDetail: () => import("@/pages/admin/AdminCourseDetail"),
  adminLearners: () => import("@/pages/admin/AdminLearners"),
  adminLearnerDetail: () => import("@/pages/admin/AdminLearnerDetail"),
  adminUsers: () => import("@/pages/admin/AdminUsers"),
  adminModuleEditor: () => import("@/pages/admin/AdminModuleEditor"),
  adminAiSettings: () => import("@/pages/admin/AdminAiSettings"),
  adminWorkspaceStatus: () => import("@/pages/admin/AdminWorkspaceStatus"),
};

const routePromises = new Map();

export function loadRouteModule(name) {
  const loader = routeLoaders[name];
  if (!loader) throw new Error(`Unknown route module: ${name}`);

  if (!routePromises.has(name)) {
    routePromises.set(name, loader());
  }

  return routePromises.get(name);
}

export function preloadRoute(pathname) {
  const path = pathname.split("?")[0].split("#")[0];
  let moduleName = null;

  if (path === "/") moduleName = "home";
  else if (path === "/modules") moduleName = "modules";
  else if (path.startsWith("/modules/")) moduleName = "moduleDetail";
  else if (path.startsWith("/quiz/")) moduleName = "quiz";
  else if (path === "/final-exam") moduleName = "finalExam";
  else if (path === "/calculators") moduleName = "calculators";
  else if (path === "/kpi") moduleName = "kpi";
  else if (path === "/ai-assistant") moduleName = "aiAssistant";
  else if (path === "/certification") moduleName = "certification";
  else if (path === "/profile") moduleName = "profile";
  else if (path === "/login") moduleName = "login";
  else if (path === "/register") moduleName = "register";
  else if (path === "/forgot-password") moduleName = "forgotPassword";
  else if (path === "/reset-password") moduleName = "resetPassword";
  else if (path === "/verify-email") moduleName = "verifyEmail";
  else if (path === "/admin") moduleName = "adminOverview";
  else if (path === "/admin/courses") moduleName = "adminCourses";
  else if (path.startsWith("/admin/courses/") && path.includes("/modules/")) {
    moduleName = "adminModuleEditor";
  } else if (path.startsWith("/admin/courses/")) {
    moduleName = "adminCourseDetail";
  } else if (path === "/admin/learners") moduleName = "adminLearners";
  else if (path.startsWith("/admin/learners/")) moduleName = "adminLearnerDetail";
  else if (path === "/admin/users") moduleName = "adminUsers";
  else if (path === "/admin/ai-settings") moduleName = "adminAiSettings";
  else if (path === "/admin/workspace-status") moduleName = "adminWorkspaceStatus";

  return moduleName ? loadRouteModule(moduleName) : Promise.resolve();
}
