# HospiLink 🏥

**HospiLink** is a comprehensive, intelligent Hospital Management System (HMS) designed to streamline clinical operations, manage patient records, and coordinate medical staff efficiently.

## 🚀 Overview
HospiLink provides a digital solution for clinical management, enabling medical professionals and administrators to track patient status, bed occupancy, and update medical records in real-time using modern web technologies.

## 🛠 Tech Stack

### **Backend:**
* **Node.js & Express.js:** Robust and scalable API development.
* **TypeScript:** Ensuring type safety and maintainable code.
* **Prisma ORM:** Flexible and secure database interaction.
* **PostgreSQL (Neon):** High-performance cloud-native database.
* **JWT (JSON Web Tokens):** Secure authentication and protected route management.

### **Frontend:**
* **React.js:** Dynamic and high-performance user interface.
* **Vite:** Next-generation frontend tooling for fast builds.
* **Tailwind CSS:** Modern, responsive, and utility-first design.
* **Axios:** Seamless API communication and data fetching.

---

## ✨ Key Features
* **Patient Management:** Streamlined admission, updates, and status tracking (Observation, Critical, Stable).
* **Bed Management:** Intelligent monitoring of bed availability and allocation.
* **Medical Reporting:** Secure documentation and file upload capabilities.
* **Operations Dashboard:** Comprehensive overview of clinical operations, including recent admissions and staff status.
* **Role-Based Access Control (RBAC):** Enhanced security with protected routes and user authentication.

---

## 📂 Project Structure
```text
HospiLink/
├── backend/          # Express.js server & Prisma ORM
├── frontend/         # React.js web application
├── uploads/          # Local storage for medical reports
└── package.json
⚙️ Local Setup
1. Backend Setup
Bash
cd backend
npm install
# Configure your .env file with DATABASE_URL
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts  # Populate database with initial data
npm run dev
2. Frontend Setup
Bash
cd frontend
npm install
npm run dev
🤝 Contribution
This project is open for collaboration. We welcome contributions to enhance system efficiency or add new clinical features.