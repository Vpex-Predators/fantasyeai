import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import PageTransition from './components/PageTransition';
import RouteFallback from './components/RouteFallback';

// Pages are code-split so the first paint doesn't wait on every tab's chunk.
const Home = lazy(() => import('./pages/Home'));
const Analyst = lazy(() => import('./pages/Analyst'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WarRoom = lazy(() => import('./pages/WarRoom'));
const WaiverWire = lazy(() => import('./pages/WaiverWire'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

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
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      const publicAuth = ["/login", "/register", "/forgot-password", "/reset-password", "/oauth/consent", "/about", "/contact"];
      if (!publicAuth.includes(location.pathname)) {
        navigateToLogin();
        return null;
      }
    }
  }

  // Render the main app — lazy pages share one Suspense shell and route
  // changes crossfade via AnimatePresence keyed on the pathname.
  return (
    <Suspense fallback={<RouteFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
          <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
          <Route path="/oauth/consent" element={<PageTransition><OAuthConsent /></PageTransition>} />
          <Route path="/about" element={<PageTransition><About /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/analyst" element={<PageTransition><Analyst /></PageTransition>} />
          <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/warroom" element={<PageTransition><WarRoom /></PageTransition>} />
          <Route path="/waivers" element={<PageTransition><WaiverWire /></PageTransition>} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <MotionConfig reducedMotion="user">
              <AuthenticatedApp />
            </MotionConfig>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App