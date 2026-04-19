import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ComingSoon from './pages/ComingSoon'
import App from './App'
import './index.css'

const isLive = window.location.hostname === 'nzela.cd' || window.location.hostname === 'www.nzela.cd'

createRoot(document.getElementById('root')).render(
  isLive ? <ComingSoon /> :
  <BrowserRouter>
    <Routes>
      <Route path="/*" element={<App />} />
    </Routes>
  </BrowserRouter>
)