import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./state/CartContext.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import MenuScreen from "./student/MenuScreen.jsx";
import CartScreen from "./student/CartScreen.jsx";
import CheckoutScreen from "./student/CheckoutScreen.jsx";
import OrderStatusScreen from "./student/OrderStatusScreen.jsx";
import ProfileScreen from "./student/ProfileScreen.jsx";
import DashboardScreen from "./dashboard/DashboardScreen.jsx";

function StudentApp() {
  return (
    <AuthGate role="student">
      <CartProvider>
        <Routes>
          <Route path="/" element={<MenuScreen />} />
          <Route path="/cart" element={<CartScreen />} />
          <Route path="/checkout" element={<CheckoutScreen />} />
          <Route path="/order/:id" element={<OrderStatusScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
        </Routes>
      </CartProvider>
    </AuthGate>
  );
}

function StaffApp() {
  return (
    <AuthGate role="staff">
      <DashboardScreen />
    </AuthGate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<StaffApp />} />
        <Route path="/*" element={<StudentApp />} />
      </Routes>
    </BrowserRouter>
  );
}
