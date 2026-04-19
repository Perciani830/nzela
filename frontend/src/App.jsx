import { Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import PublicSite from './pages/PublicSite';
import LoginAgency from './pages/LoginAgency';
import AgencyDashboard from './pages/AgencyDashboard';
import AdminDashboard from './pages/AdminDashboard';

function Guard({ children, role }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicSite />} />
      <Route path="/login" element={<LoginAgency />} />
      <Route path="/agency" element={<Guard role="agency"><AgencyDashboard /></Guard>} />
      <Route path="/admin" element={<Guard role="admin"><AdminDashboard /></Guard>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}