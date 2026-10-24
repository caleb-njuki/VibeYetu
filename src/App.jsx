import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SellerAuthProvider } from "./context/SellerAuthContext.jsx";
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { LocationProvider } from "./context/LocationContext.jsx";
import { OrdersProvider } from "./context/OrdersContext.jsx";
import Layout from "./components/Layout.jsx";
import Button from "./components/Button.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import Home from "./pages/Home.jsx";
import Search from "./pages/Search.jsx";
import Product from "./pages/Product.jsx";
import Shop from "./pages/Shop.jsx";
import Cart from "./pages/Cart.jsx";
import Login from "./pages/Login.jsx";
import Terms from "./pages/Terms.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderSuccess from "./pages/OrderSuccess.jsx";
import Orders from "./pages/Orders.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import Privacy from "./pages/Privacy.jsx";
import SellerLogin from "./pages/seller/SellerLogin.jsx";
import SellerRegister from "./pages/seller/SellerRegister.jsx";
import SellerBranchNew from "./pages/seller/SellerBranchNew.jsx";
import SellerSuspension from "./pages/seller/SellerSuspension.jsx";
import SellerLayout from "./pages/seller/SellerLayout.jsx";
import SellerOrders from "./pages/seller/SellerOrders.jsx";
import SellerOrderDetail from "./pages/seller/SellerOrderDetail.jsx";
import SellerInventory from "./pages/seller/SellerInventory.jsx";
import SellerOffers from "./pages/seller/SellerOffers.jsx";
import SellerSales from "./pages/seller/SellerSales.jsx";
import SellerSettings from "./pages/seller/SellerSettings.jsx";
import SellerAds from "./pages/seller/SellerAds.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import AdminCases from "./pages/admin/AdminCases.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminShops from "./pages/admin/AdminShops.jsx";
import AdminAds from "./pages/admin/AdminAds.jsx";

// Shown for pages we have not built yet.
function ComingSoon() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Coming soon</h1>
      <p className="text-ink-mute">We are still building this page. Please check back shortly.</p>
      <Button to="/">Back to home</Button>
    </div>
  );
}

// Pages that need a signed-in buyer.
const guard = (page) => <RequireAuth>{page}</RequireAuth>;

export default function App() {
  return (
    <AuthProvider>
      <SellerAuthProvider>
        <AdminAuthProvider>
          <LocationProvider>
          <CartProvider>
            <OrdersProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="search" element={<Search />} />
                  <Route path="product/:id" element={<Product />} />
                  <Route path="shop/:id" element={<Shop />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="login" element={<Login />} />
                  <Route path="terms" element={<Terms />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="checkout" element={guard(<Checkout />)} />
                  <Route path="checkout/success" element={guard(<OrderSuccess />)} />
                  <Route path="orders" element={guard(<Orders />)} />
                  <Route path="orders/:id" element={guard(<OrderDetail />)} />
                  <Route path="my-shop/login" element={<SellerLogin />} />
                  <Route path="my-shop/register" element={<SellerRegister />} />
                  <Route path="*" element={<ComingSoon />} />
                </Route>
                <Route path="my-shop" element={<SellerLayout />}>
                  <Route index element={<SellerOrders />} />
                  <Route path="orders/:id" element={<SellerOrderDetail />} />
                  <Route path="inventory" element={<SellerInventory />} />
                  <Route path="offers" element={<SellerOffers />} />
                  <Route path="sales" element={<SellerSales />} />
                  <Route path="ads" element={<SellerAds />} />
                  <Route path="settings" element={<SellerSettings />} />
                  <Route path="branches/new" element={<SellerBranchNew />} />
                  <Route path="report" element={<SellerSuspension />} />
                </Route>
                <Route path="admin/login" element={<AdminLogin />} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="cases" element={<AdminCases />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="shops" element={<AdminShops />} />
                  <Route path="ads" element={<AdminAds />} />
                </Route>
              </Routes>
            </OrdersProvider>
          </CartProvider>
          </LocationProvider>
        </AdminAuthProvider>
      </SellerAuthProvider>
    </AuthProvider>
  );
}
