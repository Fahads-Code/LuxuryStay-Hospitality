import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, homeForRole, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/ui.jsx';

import LandingPage from './pages/LandingPage.jsx';
import BookPage from './pages/BookPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import FeedbackPage from './pages/FeedbackPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FrontDeskPage from './pages/FrontDeskPage.jsx';
import BookingsPage from './pages/BookingsPage.jsx';
import BookingDetailPage from './pages/BookingDetailPage.jsx';
import GuestsPage from './pages/GuestsPage.jsx';
import BillingPage from './pages/BillingPage.jsx';
import InvoiceDetailPage from './pages/InvoiceDetailPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import HousekeepingPage from './pages/HousekeepingPage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import FeedbackInboxPage from './pages/FeedbackInboxPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import StaffAdminPage from './pages/StaffAdminPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import MyStayPage from './pages/MyStayPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const STAFF = ['admin', 'manager', 'receptionist', 'housekeeping'];

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
};

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
};

const RoleGate = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return children;
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/book"
            element={
              <RequireAuth>
                <BookPage />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RoleGate roles={STAFF}>
                  <DashboardPage />
                </RoleGate>
              }
            />
            <Route
              path="front-desk"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <FrontDeskPage />
                </RoleGate>
              }
            />
            <Route
              path="bookings"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <BookingsPage />
                </RoleGate>
              }
            />
            <Route
              path="bookings/:id"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <BookingDetailPage />
                </RoleGate>
              }
            />
            <Route
              path="guests"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <GuestsPage />
                </RoleGate>
              }
            />
            <Route
              path="billing"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <BillingPage />
                </RoleGate>
              }
            />
            <Route
              path="billing/:id"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <InvoiceDetailPage />
                </RoleGate>
              }
            />
            <Route
              path="rooms"
              element={
                <RoleGate roles={['admin', 'manager', 'housekeeping']}>
                  <RoomsPage />
                </RoleGate>
              }
            />
            <Route
              path="housekeeping"
              element={
                <RoleGate roles={['admin', 'manager', 'housekeeping']}>
                  <HousekeepingPage />
                </RoleGate>
              }
            />
            <Route
              path="maintenance"
              element={
                <RoleGate roles={['admin', 'manager', 'housekeeping']}>
                  <MaintenancePage />
                </RoleGate>
              }
            />
            <Route
              path="services"
              element={
                <RoleGate roles={['admin', 'manager', 'housekeeping']}>
                  <ServicesPage />
                </RoleGate>
              }
            />
            <Route
              path="reports"
              element={
                <RoleGate roles={['admin', 'manager']}>
                  <ReportsPage />
                </RoleGate>
              }
            />
            <Route
              path="feedback"
              element={
                <RoleGate roles={['admin', 'manager', 'receptionist']}>
                  <FeedbackInboxPage />
                </RoleGate>
              }
            />
            <Route
              path="staff"
              element={
                <RoleGate roles={['admin', 'manager']}>
                  <StaffPage />
                </RoleGate>
              }
            />
            <Route
              path="staff-admin"
              element={
                <RoleGate roles={['admin', 'manager']}>
                  <StaffAdminPage />
                </RoleGate>
              }
            />
            <Route
              path="settings"
              element={
                <RoleGate roles={['admin', 'manager']}>
                  <SettingsPage />
                </RoleGate>
              }
            />
            <Route
              path="my-stay"
              element={
                <RoleGate roles={['guest']}>
                  <MyStayPage />
                </RoleGate>
              }
            />
            <Route
              path="book"
              element={
                <RoleGate roles={['guest']}>
                  <BookPage embedded />
                </RoleGate>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage publicPage />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
