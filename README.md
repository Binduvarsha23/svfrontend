### 📂 Project Setup and Running Instructions
# 1. Clone the Repository

Begin by cloning the repository to your local machine:

git clone https://github.com/Binduvarsha23/svfrontend.git
cd svfrontend

2. Install Dependencies

Ensure you have Node.js
 installed. Then, install the required dependencies:

npm install

# 3. Configure Environment Variables

Create a .env.local file in the root directory and add the following environment variables:

NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id

Replace the placeholder values with your actual Firebase and backend credentials.

# 4. Run the Development Server

Start the development server:

npm run dev


Your application should now be running at http://localhost:3000
.

# 5. Build for Production

To build the application for production:

npm run build
npm start


# This will create an optimized production build and start the server.

# Secure Vault Frontend

## ⚡ Features

### User Authentication
- Firebase email/password login
- Phone number OTP verification
- Two-factor authentication (TOTP)

### Secure Vault Management
- Add, update, and delete vault items
- Tagging system for better organization
- Encrypted storage for sensitive data

### User Interface
- Responsive design with Tailwind CSS
- Reusable components for faster development
- Clean and intuitive UX

### Notifications
- Real-time feedback using React Toastify

### Clipboard & Quick Access
- Copy vault credentials easily
- Search and filter vault items

### Security Features
- Pattern/PIN/password locks
- Forgot credential recovery via email or security questions

### Deployment Ready
- Easily deployable on Vercel or Netlify
- Optimized production build

---

## ⚙️ Technologies Used
- **Frontend:** React, Next.js, Tailwind CSS
- **Authentication:** Firebase Authentication
- **2FA:** Time-based One-Time Password (TOTP)
- **Backend:** Node.js with Express (assumed based on provided code)
- **Clipboard Operations:** Clipboard.js
- **Notifications:** React Toastify

