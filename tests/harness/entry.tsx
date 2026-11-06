import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  NativeDashboard,
  NativeSummaryPage,
  NativeShipments,
  NativeShipment,
  NativeWithdrawals,
  NativeWithdrawal,
  NativeJobs,
  NativeJob,
  NativeReferrals,
} from "@/features/admin/native-operations";
import { NativeFiles } from "@/features/uploads/native-files";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <main className="min-h-screen bg-background p-6 text-foreground">
      <Routes>
        <Route path="/dashboard" element={<NativeDashboard />} />
        <Route path="/reports" element={<NativeSummaryPage />} />
        <Route path="/shipment-orders" element={<NativeShipments />} />
        <Route path="/shipment-orders/:id" element={<NativeShipment />} />
        <Route path="/withdrawals" element={<NativeWithdrawals />} />
        <Route path="/withdrawals/:id" element={<NativeWithdrawal />} />
        <Route path="/jobs" element={<NativeJobs />} />
        <Route path="/jobs/:id" element={<NativeJob />} />
        <Route path="/referrals" element={<NativeReferrals />} />
        <Route path="/files" element={<NativeFiles />} />
      </Routes>
    </main>
  </BrowserRouter>,
);
