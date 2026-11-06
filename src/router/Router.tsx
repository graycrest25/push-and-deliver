import { GameRulesPage } from "@/features/admin/game-rules";
import {
  RiderApplications,
  RiderApplication,
} from "@/features/admin/rider-applications";
import {
  PricingAudit,
  FeeEditor,
  TariffEditor,
  TariffCreate,
  OfficePricing,
  CountryPolicy,
  StatePolicy,
} from "@/features/admin/pricing";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import ProtectedRoutes from "./ProtectedRoutes";
import PublicRoute from "./PublicRoute";
import SignInPage from "@/features/auth/sign-in";
import {
  OrdersPage,
  OrderPage,
  PaymentsPage,
  ReceiptPage,
} from "@/features/admin/operations";
import {
  NotificationsPage,
  CataloguePage,
  CatalogueItemPage,
} from "@/features/admin/configuration";
import { AnalyticsPage } from "@/features/admin/reports";
import { PasswordRecovery, SecurityPage } from "@/features/admin/security";
import { Heading, Notice } from "@/features/admin/shared";
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
import { MobileReleaseSettings } from "@/features/admin/release-settings";
import {
  AdminRoles,
  NativeCoupons,
  NativeSupport,
  NativeConversation,
  SignupFunding,
} from "@/features/admin/native-dashboard";
import {
  NativeAccounts,
  NativeAccount,
  NativeRides,
  NativeRide,
  NativeFees,
  NativeOffices,
  NativeOffice,
  NativeTariffs,
  NativeTariff,
  NativeCountry,
  NativeAudit,
  AnalyticsCoverage,
} from "@/features/admin/native-read-models";
import { UnavailableAdminFeature } from "@/features/admin/native-operations";
import { TableStateProvider } from "@/features/admin/table-state";
export default function Router() {
  return (
    <BrowserRouter>
      <TableStateProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <SignInPage />
              </PublicRoute>
            }
          />
          <Route
            path="/sign-in"
            element={<Navigate to="/login" replace />}
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <PasswordRecovery />
              </PublicRoute>
            }
          />
          <Route path="/sign-up" element={<Navigate to="/sign-in" replace />} />
          <Route
            path="/*"
            element={
              <ProtectedRoutes>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<NativeDashboard />} />
                    <Route
                      path="/rider-applications"
                      element={<RiderApplications />}
                    />
                    <Route
                      path="/rider-applications/:id"
                      element={<RiderApplication />}
                    />
                    <Route path="/pricing-audit" element={<PricingAudit />} />
                    <Route path="/fees/:id" element={<FeeEditor />} />
                    <Route
                      path="/delivery-zones/states/:id"
                      element={<StatePolicy />}
                    />
                    <Route path="/users" element={<NativeAccounts />} />
                    <Route path="/users/:id" element={<NativeAccount />} />
                    <Route path="/riders" element={<NativeAccounts riders />} />
                    <Route
                      path="/riders/:id"
                      element={<NativeAccount riders />}
                    />
                    <Route
                      path="/vendors"
                      element={
                        <UnavailableAdminFeature title="Partner applications">
                          Vendor and merchant directories are not available in
                          this service yet.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/vendors/:id"
                      element={
                        <UnavailableAdminFeature title="Partner profile">
                          Partner profile inspection is not available in this
                          service yet.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/ecommerce-merchants"
                      element={
                        <UnavailableAdminFeature title="Partner applications">
                          Vendor and merchant directories are not available in
                          this service yet.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/ecommerce-merchants/:id"
                      element={
                        <UnavailableAdminFeature title="Partner profile">
                          Partner profile inspection is not available in this
                          service yet.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/ecommerce-merchants/:id/products"
                      element={
                        <UnavailableAdminFeature title="Catalogue unavailable">
                          Catalogue administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/ecommerce-merchants/:id/products/:productId"
                      element={
                        <Notice>
                          Open this item from the marketplace catalogue to
                          inspect its current record.
                        </Notice>
                      }
                    />
                    <Route
                      path="/ecommerce-merchants/:id/transactions"
                      element={
                        <Notice>
                          Merchant transaction history is not available in the
                          current service.
                        </Notice>
                      }
                    />
                    <Route path="/admin/users" element={<AdminRoles />} />
                    <Route
                      path="/shipment-orders"
                      element={<NativeShipments />}
                    />
                    <Route
                      path="/shipment-orders/:id"
                      element={<NativeShipment />}
                    />
                    <Route path="/ride-hailing" element={<NativeRides />} />
                    <Route path="/ride-hailing/:id" element={<NativeRide />} />
                    <Route
                      path="/restaurant-orders"
                      element={
                        <UnavailableAdminFeature title="Marketplace unavailable">
                          Marketplace administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/restaurant-orders/:id"
                      element={
                        <UnavailableAdminFeature title="Marketplace unavailable">
                          Marketplace administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/product-orders"
                      element={
                        <UnavailableAdminFeature title="Marketplace unavailable">
                          Marketplace administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/product-orders/:id"
                      element={
                        <UnavailableAdminFeature title="Marketplace unavailable">
                          Marketplace administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/withdrawals"
                      element={<NativeWithdrawals />}
                    />
                    <Route
                      path="/withdrawals/:id"
                      element={<NativeWithdrawal />}
                    />
                    <Route
                      path="/support-tickets"
                      element={<NativeSupport />}
                    />
                    <Route
                      path="/support-tickets/:id"
                      element={<NativeConversation />}
                    />
                    <Route path="/referrals" element={<NativeReferrals />} />
                    <Route path="/generated" element={<NativeReferrals />} />
                    <Route
                      path="/referrals/:id"
                      element={
                        <Notice>
                          Referral attribution details are not available. Use
                          the referral list and export to inspect attribution
                          records.
                        </Notice>
                      }
                    />
                    <Route path="/head-offices" element={<NativeOffices />} />
                    <Route
                      path="/head-offices/:id"
                      element={<NativeOffice />}
                    />
                    <Route path="/fees" element={<NativeFees />} />
                    <Route path="/export-rates" element={<NativeTariffs />} />
                    <Route
                      path="/export-rates/tariffs/:id"
                      element={<NativeTariff />}
                    />
                    <Route
                      path="/delivery-zones"
                      element={<NativeTariffs domestic />}
                    />
                    <Route
                      path="/delivery-zones/tariffs/:id"
                      element={<NativeTariff domestic />}
                    />
                    <Route
                      path="/dhl-zones"
                      element={<Navigate to="/export-rates" replace />}
                    />
                    <Route
                      path="/dhl-local"
                      element={<Navigate to="/delivery-zones" replace />}
                    />
                    <Route path="/game-rules" element={<GameRulesPage />} />
                    <Route path="/coupons" element={<NativeCoupons />} />
                    <Route
                      path="/general-notifications"
                      element={<NotificationsPage />}
                    />
                    <Route
                      path="/app-config"
                      element={
                        <div className="space-y-6">
                          <Heading title="App configuration" />
                          <Notice>
                            Manage Ten Seconds timing and rewards from{" "}
                            <Link
                              to="/game-rules"
                              className="text-primary underline"
                            >
                              Game rules
                            </Link>
                            .
                          </Notice>
                          <MobileReleaseSettings />
                          <SignupFunding />
                        </div>
                      }
                    />
                    <Route path="/settings" element={<SecurityPage />} />
                    <Route
                      path="/catalogue"
                      element={
                        <UnavailableAdminFeature title="Catalogue unavailable">
                          Catalogue administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route
                      path="/catalogue/:id"
                      element={
                        <UnavailableAdminFeature title="Catalogue unavailable">
                          Catalogue administration is not available in this
                          release.
                        </UnavailableAdminFeature>
                      }
                    />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route
                      path="/payments/receipts/:id"
                      element={<ReceiptPage />}
                    />
                    <Route path="/audit" element={<NativeAudit />} />
                    <Route path="/reports" element={<NativeSummaryPage />} />
                    <Route
                      path="/analytics-coverage"
                      element={<AnalyticsCoverage />}
                    />
                    <Route
                      path="/export-rates/countries/:id"
                      element={<NativeCountry />}
                    />
                    <Route path="/jobs" element={<NativeJobs />} />
                    <Route path="/jobs/:id" element={<NativeJob />} />
                    <Route path="/files" element={<NativeFiles />} />
                    <Route
                      path="/weekly-overview"
                      element={<AnalyticsPage kind="weekly-overview" />}
                    />
                    <Route
                      path="/weekly-concentration"
                      element={<AnalyticsPage kind="weekly-concentration" />}
                    />
                    <Route
                      path="/rider-weekly-deliveries"
                      element={<AnalyticsPage kind="rider-weekly-deliveries" />}
                    />
                    <Route
                      path="/user-activation"
                      element={<AnalyticsPage kind="time-to-first-order" />}
                    />
                    <Route
                      path="/coupon-redemption-metrics"
                      element={<AnalyticsPage kind="coupon-redemptions" />}
                    />
                    <Route
                      path="/"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route
                      path="*"
                      element={
                        <div className="space-y-4">
                          <Heading title="Page not found" />
                          <Notice>
                            Choose a destination from the sidebar.
                          </Notice>
                        </div>
                      }
                    />
                  </Routes>
                </Layout>
              </ProtectedRoutes>
            }
          />
        </Routes>
      </TableStateProvider>
    </BrowserRouter>
  );
}
