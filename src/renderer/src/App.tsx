import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginPage from './pages/auth/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminLayout from './layouts/AdminLayout';
import RolesPage from './pages/admin/roles/page';
import RoleDetails from './pages/admin/roles/detail';
import UsersPage from './pages/admin/users/page';
import StoresPage from './pages/admin/stores/page';
import StoreDetails from './pages/admin/stores/detail';
import ProfilePage from './pages/admin/profile/page';
import StoreLayout from "./layouts/StoreLayout";
import ProductsPage from "@renderer/pages/store/inventory/products/page";
import ProductDetails from "@renderer/pages/store/inventory/products/detail";
import CategoriesPage from "@renderer/pages/store/inventory/categories/page";
import BrandsPage from "@renderer/pages/store/inventory/brands/page";
import SuppliersPage from "@renderer/pages/store/purchases/suppliers/page";
import PurchaseOrdersPage from "@renderer/pages/store/purchases/orders/page";
import CreatePurchaseOrder from "@renderer/pages/store/purchases/orders/create/page";
import EditPurchaseOrder from "@renderer/pages/store/purchases/orders/edit";
import PurchaseOrderDetails from "./pages/store/purchases/orders/detail";
import StoreSettingsPage from "@renderer/pages/store/settings/page";
import SettingsProfilePage from "@renderer/pages/store/settings/profile/page";
import POSPage from "@renderer/pages/store/sales/pos/page";



interface User {
  id: string;
  email: string;
  fullName: string;
  globalRole: 'ADMIN' | 'USER';
}

function ProtectedRoute({
  children,
  user,
  allowedRoles
}: {
  children: React.ReactNode;
  user: User | null;
  allowedRoles?: string[];
}) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.globalRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <>
      <HashRouter>
        <Routes>
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={user.globalRole === 'ADMIN' ? '/admin' : '/dashboard'} replace />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute user={user} allowedRoles={['ADMIN']}>
                <AdminLayout onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="roles/:id" element={<RoleDetails />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="stores/:id" element={<StoreDetails />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <StoreLayout onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route index element={<div>Store Dashboard (Coming Soon)</div>} />
            <Route path="pos" element={<POSPage />} />
            <Route path="inventory/products" element={<ProductsPage />} />
            <Route path="inventory/products/:id" element={<ProductDetails />} />
            <Route path="inventory/categories" element={<CategoriesPage />} />
            <Route path="inventory/brands" element={<BrandsPage />} />
            <Route path="purchases/suppliers" element={<SuppliersPage />} />
            <Route path="purchases/orders" element={<PurchaseOrdersPage />} />
            <Route path="purchases/orders/create" element={<CreatePurchaseOrder />} />
            <Route path="purchases/orders/:id/edit" element={<EditPurchaseOrder />} />
            <Route path="purchases/orders/:id" element={<PurchaseOrderDetails />} />
            <Route path="settings" element={<StoreSettingsPage />} />
            <Route path="settings/profile" element={<SettingsProfilePage />} />
          </Route>

          <Route
            path="/"

            element={
              user ? (
                <Navigate to={user.globalRole === 'ADMIN' ? '/admin' : '/dashboard'} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </HashRouter>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
