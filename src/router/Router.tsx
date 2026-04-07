import UserManagementPage from "@/pages/admin/user-management";
import { Layout } from "@/components/layout";
import CouponsPage from "@/pages/coupons";
import DashboardPage from "@/pages/dashboard";
import FeesPage from "@/pages/fees";
import ExportRatesPage from "@/pages/export-rates";
import ReferralsPage from "@/pages/referrals";
import DeliveryZonesPage from "@/pages/delivery-zones";
import RestaurantOrdersPage from "@/pages/restaurant-orders";
import RestaurantOrderDetailsPage from "@/pages/restaurant-orders/details";
import RideHailingPage from "@/pages/ride-hailing";
import RideHailingDetailsPage from "@/pages/ride-hailing/details";
import RidersPage from "@/pages/riders";
import RiderDetailsPage from "@/pages/riders/details";
import ShipmentOrdersPage from "@/pages/shipment-orders";
import ShipmentOrderDetailsPage from "@/pages/shipment-orders/details";
import SupportTicketsPage from "@/pages/support-tickets";
import UsersPage from "@/pages/users";
import UserDetailsPage from "@/pages/users/details";
import VendorsPage from "@/pages/vendors";
import VendorDetailsPage from "@/pages/vendors/details";
import EcommerceMerchantsPage from "@/pages/ecommerce-merchants";
import EcommerceMerchantDetailsPage from "@/pages/ecommerce-merchants/details";
import MerchantProductsPage from "@/pages/ecommerce-merchants/products";
import ProductDetailsPage from "@/pages/ecommerce-merchants/product-details";
import MerchantTransactionsPage from "@/pages/ecommerce-merchants/transactions";
import ProductOrdersPage from "@/pages/product-orders";
import ProductOrderDetailsPage from "@/pages/product-orders/details";
import WithdrawalsPage from "@/pages/withdrawals";
import GeneralNotificationsPage from "@/pages/general-notifications";
import DHLZonesPage from "@/pages/dhl-zones";
import AppConfigPage from "@/pages/app-config";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoutes from "./ProtectedRoutes";

import PublicRoute from "./PublicRoute";
import SignInPage from "@/pages/Auth/sign-in";
import SignUpPage from "@/pages/Auth/sign-up";
import ReferralDetailsPage from "@/pages/referrals/details";
import GeneratedReferrals from "@/pages/generated-referrals";

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/sign-in"
          element={
            <PublicRoute>
              <SignInPage />
            </PublicRoute>
          }
        />
        <Route
          path="/sign-up"
          element={
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          }
        />

        <Route
          path="/*"
          element={
            <ProtectedRoutes>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserDetailsPage />} />
                  <Route path="/riders" element={<RidersPage />} />
                  <Route path="/riders/:id" element={<RiderDetailsPage />} />
                  <Route path="/vendors" element={<VendorsPage />} />
                  <Route path="/vendors/:id" element={<VendorDetailsPage />} />
                  <Route
                    path="/ecommerce-merchants"
                    element={<EcommerceMerchantsPage />}
                  />
                  <Route
                    path="/ecommerce-merchants/:id"
                    element={<EcommerceMerchantDetailsPage />}
                  />
                  <Route
                    path="/ecommerce-merchants/:id/products"
                    element={<MerchantProductsPage />}
                  />
                  <Route
                    path="/ecommerce-merchants/:id/products/:productId"
                    element={<ProductDetailsPage />}
                  />
                  <Route
                    path="/ecommerce-merchants/:id/transactions"
                    element={<MerchantTransactionsPage />}
                  />
                  <Route path="/fees" element={<FeesPage />} />
                  <Route path="/export-rates" element={<ExportRatesPage />} />
                  <Route
                    path="/delivery-zones"
                    element={<DeliveryZonesPage />}
                  />
                  <Route path="/referrals" element={<ReferralsPage />} />
                  <Route
                    path="/referrals/:id"
                    element={<ReferralDetailsPage />}
                  />
                  <Route path="/withdrawals" element={<WithdrawalsPage />} />
                  <Route path="/coupons" element={<CouponsPage />} />
                  <Route
                    path="/general-notifications"
                    element={<GeneralNotificationsPage />}
                  />
                  <Route path="/dhl-zones" element={<DHLZonesPage />} />
                  <Route path="/app-config" element={<AppConfigPage />} />
                  <Route
                    path="/support-tickets"
                    element={<SupportTicketsPage />}
                  />
                  <Route
                    path="/restaurant-orders"
                    element={<RestaurantOrdersPage />}
                  />
                  <Route
                    path="/restaurant-orders/:id"
                    element={<RestaurantOrderDetailsPage />}
                  />
                  <Route
                    path="/shipment-orders"
                    element={<ShipmentOrdersPage />}
                  />
                  <Route
                    path="/shipment-orders/:id"
                    element={<ShipmentOrderDetailsPage />}
                  />
                  <Route path="/ride-hailing" element={<RideHailingPage />} />
                  <Route
                    path="/ride-hailing/:id"
                    element={<RideHailingDetailsPage />}
                  />
                  <Route
                    path="/product-orders"
                    element={<ProductOrdersPage />}
                  />
                  <Route
                    path="/product-orders/:id"
                    element={<ProductOrderDetailsPage />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route path="/generated" element={<GeneratedReferrals />} />
                </Routes>
              </Layout>
            </ProtectedRoutes>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
