import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmojiLoader, FullScreenLoader } from '@/components/common/EmojiLoader';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ResetPassword from '@/pages/ResetPassword';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const UserWorkspace = lazy(() => import('@/pages/UserWorkspace'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
const Profile = lazy(() => import('@/pages/Profile'));

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const page = (el: ReactNode) => <Suspense fallback={<EmojiLoader />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={page(<Dashboard />)} />
        <Route path="u/:userId/categories/:categoryId" element={page(<UserWorkspace />)} />
        <Route path="u/:userId/:tab?" element={page(<UserWorkspace />)} />
        <Route path="profile" element={page(<Profile />)} />
        <Route path="admin/:tab?" element={<RequireAuth admin>{page(<AdminPanel />)}</RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
