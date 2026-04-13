import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ComingSoon from './pages/ComingSoon'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<App />} />
      <Route path="/admin/*" element={<App />} />
      <Route path="/agency/*" element={<App />} />
      <Route path="*" element={<ComingSoon />} />
    </Routes>
  </BrowserRouter>
)