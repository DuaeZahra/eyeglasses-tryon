# 🕶️ AI Eyeglasses Try-On Web App

An interactive AI-powered eyeglasses try-on web app built with React, Three.js, and MediaPipe FaceMesh.
It lets users preview eyeglasses in real-time using their webcam or uploaded images with accurate face landmark tracking and 3D model overlays.

---

##  Live Demo
Explore the web app live at: [EyeMate Try-On](https://eyeglasses-tryon.vercel.app/)

## ✨ Features

- Home Page: Clean landing page guiding users to explore the store and try-on feature directly or navigate to the try room of specific eyeglasses from the sliding glasses.
- Product Catalog: Browse and shop the eyeglasses with names, prices, and preview thumbnails.
- AI Try-On Room: Live webcam support with real-time face detection and glasses overlay using Mediapipe facemesh model and three.js.
- Upload Support: Users can try on glasses using a photo from their device.
- Interactive Frame Selection: Switch between multiple eyeglass frames instantly.
- Shopping Cart: Add/remove glasses and view total price.
- Snapshot Feature: Capture and save the try-on image.
- Fully client-side, responsive design — works on both desktop and mobile.

---

## 🔧 Tech Stack

| Tech        | Description                           |
|-------------|---------------------------------------|
| React       | Frontend framework (Vite setup)       |
| TailwindCSS | Utility-first CSS for UI styling      |
| MediaPipe FaceMesh | Face detection and landmark tracking |
| Three.js    | 3D rendering for virtual try-on models|
| Vite        | Fast dev server & build tool          |
| Vercel      | Deployment and hosting platform       |



##  Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/DuaeZahra/eyeglasses-tryon.git
cd eyeglasses-tryon
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

## 🧠 How It Works

1. **Face Detection**  
   MediaPipe FaceMesh detects **468 facial landmarks** (eyes, nose bridge, temples).

2. **3D Glasses Placement**  
   The glasses model is **cloned, positioned, scaled, and rotated** based on the detected facial landmark geometry.

3. **Rendering**  
   Three.js overlays the 3D model on top of the video or uploaded image feed in real-time.


## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <strong>Home Page</strong><br/>
      <img src="public/screenshots/home.png" width="300"/>
    </td>
    <td align="center">
      <strong>Shop by gender</strong><br/>
      <img src="public/screenshots/products.png" width="300"/>
    </td>
    <td align="center">
      <strong>Product Listing</strong><br/>
      <img src="public/screenshots/products2.png" width="300"/>
    </td>
  </tr>
  <tr>
  <td align="center">
      <strong>Try-On using WebCam)</strong><br/>
      <img src="public/screenshots/tryon.png" width="300"/>
    </td>
    <td align="center">
      <strong>Try-On using Image Upload</strong><br/>
      <img src="public/screenshots/tryon2.png" width="300"/>
    </td>
    <td align="center">
      <strong>Cart</strong><br/>
      <img src="public/screenshots/cart.png" width="300"/>
    </td>
  </tr>
</table>



## 🗒️ Notes

- This is a **frontend-only prototype** — there is no backend or database integration.
- The glasses overlay is approximately aligned for demonstration purposes; it may not be perfectly accurate in all cases.
- All assets, including eyeglass images and face detection models, are served directly from the `public/` folder.

