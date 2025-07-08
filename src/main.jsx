import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { CartProvider } from './context/CartContext'
import { SelectedGlassesProvider } from './context/SelectedGlassesContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CartProvider>
      <SelectedGlassesProvider>
        <App />
      </SelectedGlassesProvider>
    </CartProvider>
  </React.StrictMode>
)
