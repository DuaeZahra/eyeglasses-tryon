// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { SelectedGlassesProvider } from './context/SelectedGlassesContext' // make sure this path is correct
import { CartProvider } from './context/CartContext'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
    <CartProvider>
    <SelectedGlassesProvider>
      <App />
    </SelectedGlassesProvider>
    </CartProvider>
    </BrowserRouter>
  </React.StrictMode>
)




