import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/styles/index.css'
import { App } from '@/app/App'
import { Providers } from '@/app/providers'

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('geospatial-platform-theme') || 'dark';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Disable browser context menu globally on right click
window.addEventListener('contextmenu', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
