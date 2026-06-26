# SyncDoc — Local-First Collaborative Document Editor

SyncDoc is a modern, responsive, and secure collaborative document editor built with Next.js, PostgreSQL (Row-Level Security), and local browser database synchronization. It features multi-user real-time document editing, full offline functionality, version timelines, and built-in AI assists powered by Google Gemini.

---

## 🚀 Key Features

* **Offline-First Capabilities**: Keep writing even if your internet connection drops. Edits are saved instantly to a local browser database (IndexedDB via Dexie.js) and synchronized automatically as soon as you are reconnected.
* **Conflict-Free Synchronization**: Built using custom operational CRDTs (Conflict-free Replicated Data Types) and Lamport Clocks to resolve typing conflicts from multiple users without losing any work.
* **Row-Level Security (RLS)**: Secured directly at the PostgreSQL layer. Collaborative access is tightly controlled, ensuring users only see or edit documents they own or have been explicitly invited to.
* **Interactive AI Assistant**: Powered by the Google Gemini API (`gemini-2.5-flash`) to provide inline text autocompletion, document summarization, and an interactive chat assistant about the document content.
* **Version History & Restore**: Track every change made to the document. Revert or restore older snapshots from the timeline with one click.
* **Mobile-Responsive Layout**: Optimized with dynamic tabbed panels, top navigation controls, and a fixed bottom tab bar for a native app feel on mobile viewports.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 16 (React 19, Turbopack, Tailwind CSS, Lucide Icons)
* **Backend APIs**: Next.js Serverless Routes
* **Production Database**: Hosted PostgreSQL (Neon / Supabase)
* **Local Database**: IndexedDB via Dexie.js
* **Authentication**: JSON Web Tokens (JWT) & bcryptjs
* **AI Engine**: Google Gemini API

---

## 💻 Local Installation & Setup

Follow these steps to run the project locally on your machine:

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and a **PostgreSQL** instance running locally or on the cloud.

### 2. Clone the Repository
```bash
git clone https://github.com/shrutisonawane007/SyncDoc.git
cd SyncDoc
```

### 3. Database Initialization
Run the database setup script located in `scripts/db_setup.sql` on your PostgreSQL database instance to initialize tables and enable Row-Level Security:
```bash
psql -U your_postgres_user -d your_database_name -f scripts/db_setup.sql
```

### 4. Configure Environment Variables
Create a `.env.local` file in the root directory and add the following:
```env
# Database connection URI
DATABASE_URL=postgresql://user:password@localhost:5432/collab_doc_editor

# JWT Authentication Config
JWT_SECRET=your_secure_random_hash_string
JWT_EXPIRES_IN=7d

# Base application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Gemini API Key (for AI Assists)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 5. Install Dependencies and Run Dev Server
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the application.

---

## 🌐 Production Deployment

The project is fully production-ready and optimized for deployment:
* **Frontend / Serverless APIs**: Deploy directly on **Vercel** by importing the GitHub repository.
* **Database**: Deploy on **Neon.tech** (Transaction Pooler connection string recommended) or **Supabase**.
* Make sure to define the Environment Variables (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GEMINI_API_KEY`) in your Vercel project configuration dashboard.

---

## 👤 Developer
* **Shruti Sonawane**
* [GitHub](https://github.com/shrutisonawane007)
* [LinkedIn](https://www.linkedin.com/in/shruti-sonawane-231550388/)
