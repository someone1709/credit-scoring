import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from '@/context/RoleContext';
import { AppProvider } from '@/context/AppContext';
import { Shell } from '@/components/layout/Shell';

// Landing
import LandingPage from '@/pages/Landing';

// Beneficiary pages
import BeneficiaryDashboard from '@/pages/beneficiary/Dashboard';
import ApplyForLoan from '@/pages/beneficiary/ApplyForLoan';
import MyApplications from '@/pages/beneficiary/MyApplications';
import ApplicationDetail from '@/pages/beneficiary/ApplicationDetail';
import Documents from '@/pages/beneficiary/Documents';
import LoanOffers from '@/pages/beneficiary/LoanOffers';
import BeneficiaryDisbursement from '@/pages/beneficiary/DisbursementTracking';
import Notifications from '@/pages/beneficiary/Notifications';
import Profile from '@/pages/beneficiary/Profile';
import HelpSupport from '@/pages/beneficiary/HelpSupport';

// Lender pages
import LenderDashboard from '@/pages/lender/Dashboard';
import LoanApplications from '@/pages/lender/LoanApplications';
import ApplicationReview from '@/pages/lender/ApplicationReview';
import MyOffers from '@/pages/lender/MyOffers';
import AcceptedOffers from '@/pages/lender/AcceptedOffers';
import LenderDisbursement from '@/pages/lender/Disbursement';
import Analytics from '@/pages/lender/Analytics';
import LenderSettings from '@/pages/lender/Settings';

export default function App() {
  return (
    <RoleProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Beneficiary Portal */}
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

            {/* Lender Portal */}
            <Route path="/lender" element={<Shell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LenderDashboard />} />
              <Route path="applications" element={<LoanApplications />} />
              <Route path="applications/:id" element={<ApplicationReview />} />
              <Route path="offers" element={<MyOffers />} />
              <Route path="accepted-offers" element={<AcceptedOffers />} />
              <Route path="disbursement" element={<LenderDisbursement />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<LenderSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </RoleProvider>
  );
}
