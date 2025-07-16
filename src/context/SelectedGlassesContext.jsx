import { createContext, useContext, useState } from 'react'

const SelectedGlassesContext = createContext()

export const SelectedGlassesProvider = ({ children }) => {
  const [selectedImage, setSelectedImage] = useState('/glasses1.png') // default

  return (
    <SelectedGlassesContext.Provider value={{ selectedImage, setSelectedImage }}>
      {children}
    </SelectedGlassesContext.Provider>
  )
}

export const useSelectedGlasses = () => useContext(SelectedGlassesContext)