import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import AdminLayout from './features/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Trips from './pages/admin/Trips';
import Reports from './pages/admin/Reports';
import EmployeeMatrix from './pages/admin/EmployeeMatrix';
import Clients from './pages/admin/Clients';
import PayrollManagement from './pages/admin/PayrollManagement';
import Billing from './pages/admin/Billing';
import Home from './pages/employee/Home';
import EmployeeTrips from './pages/employee/Trips';
import Report from './pages/employee/Report';
import MySchedule from './pages/employee/MySchedule';
import MyPayroll from './pages/employee/MyPayroll';
import LoginForm from './features/auth/LoginForm';
import RegisterForm from './features/auth/RegisterForm';
import PendingApprovalScreen from './pages/PendingApprovalScreen';
import EmployeeLayout from './features/employee/EmployeeLayout';
import { useAuth } from './hooks/useAuth';

const ProtectedRoute = ({ allowedRole }: { allowedRole: 'admin' | 'employee' }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center font-semibold text-blue-600">טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.status === 'pending') {
    return <PendingApprovalScreen />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <Outlet />;
};

const RootRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center font-semibold text-blue-600">טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
};

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginForm /> },
  { path: '/register', element: <RegisterForm /> },
  { path: '/pending', element: <PendingApprovalScreen /> },
  {
    path: '/admin',
    element: <ProtectedRoute allowedRole="admin" />,
    children: [
      {
        path: '',
        element: <AdminLayout><Outlet /></AdminLayout>,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'trips', element: <Trips /> },
          { path: 'clients', element: <Clients /> },
          { path: 'matrix', element: <EmployeeMatrix /> },
          { path: 'payroll', element: <PayrollManagement /> },
          { path: 'billing', element: <Billing /> },
          { path: 'reports', element: <Reports /> }
        ]
      }
    ]
  },
  {
    path: '/employee',
    element: <ProtectedRoute allowedRole="employee" />,
    children: [
      {
        path: '',
        element: <EmployeeLayout><Outlet /></EmployeeLayout>,
        children: [
          { index: true, element: <Home /> },
          { path: 'trips', element: <EmployeeTrips /> },
          { path: 'schedule', element: <MySchedule /> },
          { path: 'payroll', element: <MyPayroll /> },
          { path: 'report', element: <Report /> }
        ]
      }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
