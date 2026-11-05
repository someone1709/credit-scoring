import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { Shell } from '@/components/layout/Shell';
import { GuestOnly, RequireRole } from '@/components/auth/RouteGuards';
import { Spinner } from '@/components/shared/UI';

// Landing
import LandingPage from '@/pages/Landing';

// Authentication
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import VerifyEmail from '@/pages/auth/VerifyEmail';

// Platform administration
import LenderApprovals from '@/pages/admin/LenderApprovals';

// Shared
import Notifications from '@/pages/shared/Notifications';

// Beneficiary pages
import BeneficiaryDashboard from '@/pages/beneficiary/Dashboard';
import ApplyForLoan from '@/pages/beneficiary/ApplyForLoan';
import MyApplications from '@/pages/beneficiary/MyApplications';
import ApplicationDetail from '@/pages/beneficiary/ApplicationDetail';
import Documents from '@/pages/beneficiary/Documents';
import LoanOffers from '@/pages/beneficiary/LoanOffers';
import BeneficiaryDisbursement from '@/pages/beneficiary/DisbursementTracking';
import Profile from '@/pages/beneficiary/Profile';
import HelpSupport from '@/pages/beneficiary/HelpSupport';

// Lender pages
import LoanApplications from '@/pages/lender/LoanApplications';
import ApplicationReview from '@/pages/lender/ApplicationReview';
import MyOffers from '@/pages/lender/MyOffers';
import AcceptedOffers from '@/pages/lender/AcceptedOffers';
import LenderDisbursement from '@/pages/lender/Disbursement';
import Repayments from '@/pages/lender/Repayments';
import LenderSettings from '@/pages/lender/Settings';

// The chart library is large, so only the pages with charts load it.
const LenderDashboard = lazy(() => import('@/pages/lender/Dashboard'));
const Analytics = lazy(() => import('@/pages/lender/Analytics'));

function ChartPage({ page: Page }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner size="lg" /></div>}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Authentication */}
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Reached from an email, signed in or not */}
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Guarded by a key rather than an account, since the brief has only two user roles */}
            <Route path="/admin/lenders" element={<LenderApprovals />} />

            {/* Beneficiary Portal */}
            <Route element={<RequireRole role="beneficiary" />}>
              <Route path="/beneficiary" element={<Shell />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<BeneficiaryDashboard />} />
                <Route path="apply" element={<ApplyForLoan />} />
                <Route path="applications" element={<MyApplications />} />
                <Route path="applications/:id" element={<ApplicationDetail />} />
                <Route path="documents" element={<Documents />} />
                <Route path="offers" element={<LoanOffers />} />
                <Route path="disbursement" element={<BeneficiaryDisbursement />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="help" element={<HelpSupport />} />
              </Route>
            </Route>

            {/* Lender Portal */}
            <Route element={<RequireRole role="lender" />}>
              <Route path="/lender" element={<Shell />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ChartPage page={LenderDashboard} />} />
                <Route path="applications" element={<LoanApplications />} />
                <Route path="applications/:id" element={<ApplicationReview />} />
                <Route path="offers" element={<MyOffers />} />
                <Route path="accepted-offers" element={<AcceptedOffers />} />
                <Route path="disbursement" element={<LenderDisbursement />} />
                <Route path="repayments" element={<Repayments />} />
                <Route path="analytics" element={<ChartPage page={Analytics} />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<LenderSettings />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
