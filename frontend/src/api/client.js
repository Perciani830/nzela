import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { localStorage.clear(); window.location.href = '/login'; }
  return Promise.reject(err);
});

// Auth
export const authAdmin  = (u, p) => api.post('/auth/admin',  { username: u, password: p });
export const authAgency = (i, p) => api.post('/auth/agency', { identifier: i, password: p });
export const getMe = () => api.get('/auth/me');

// Public
export const searchTrips     = p => api.get('/public/search', { params: p });
export const getCities       = () => api.get('/public/cities');
export const createBooking   = d => api.post('/public/book', d);
export const processPayment  = d => api.post('/public/payment', d);
export const cancelBooking   = d => api.post('/public/cancel', d);
export const getBookingByRef = r => api.get(`/public/booking/${r}`);
export const getLoyalty      = (agencyId, phone) => api.get(`/public/loyalty/${agencyId}/${phone}`);

// Admin
export const getAdminStats  = () => api.get('/admin/stats');
export const getAgencies    = () => api.get('/admin/agencies');
export const createAgency   = d => api.post('/admin/agencies', d);
export const updateAgency   = (id, d) => api.put(`/admin/agencies/${id}`, d);
export const deleteAgency   = id => api.delete(`/admin/agencies/${id}`);
export const getAdminBookings= p => api.get('/admin/bookings', { params: p });
export const getAdminPayments= () => api.get('/admin/payments');
export const getAdminCancels = () => api.get('/admin/cancellations');
export const getAdminSettings= () => api.get('/admin/settings');
export const saveAdminSettings= d => api.put('/admin/settings', d);
export const getWalletTx    = () => api.get('/admin/wallet-transactions');
export const getAdminLoyalty= () => api.get('/admin/loyalty');

// Agency
export const getAgencyStats   = () => api.get('/agency/stats');
export const getAgencyRoutes  = () => api.get('/agency/routes');
export const createRoute      = d => api.post('/agency/routes', d);
export const updateRoute      = (id, d) => api.put(`/agency/routes/${id}`, d);
export const deleteRoute      = id => api.delete(`/agency/routes/${id}`);
export const getAgencyBookings= p => api.get('/agency/bookings', { params: p });
export const cancelBookingByAgency= id => api.put(`/agency/bookings/${id}/cancel`, {});
export const getAgencyPayments= () => api.get('/agency/payments');
export const getAgencyWallet  = () => api.get('/agency/wallet');
export const saveLoyaltySettings= d => api.put('/agency/loyalty/settings', d);
export const getLoyaltyTravelers= () => api.get('/agency/loyalty/travelers');
export const getTravelerLoyalty = phone => api.get(`/agency/loyalty/travelers/${phone}`);
export const awardLoyalty     = d => api.post('/agency/loyalty/award', d);
export const saveCancelRate   = rate => api.put('/agency/cancel-rate', { cancel_rate: rate });

export default api;
