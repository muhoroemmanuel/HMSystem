# HMS System

This is a scaffold for a hospital management system built from a React prototype. It includes a backend API and a React frontend.

## Architecture

- `backend/`: Node + TypeScript + Express API
- `frontend/`: React + TypeScript + Vite SPA

## Quick start

### Backend
```
cd backend
npm install
npm run dev
```

### Frontend
```
cd frontend
npm install
npm run dev
```

### Monorepo helper
```
cd /home/muhoro/Downloads/hms-system
npm install
npm run dev:backend
npm run dev:frontend
```

## Architecture

- `backend/`: Express + TypeScript API with stub routes for auth, patients, appointments, billing, pharmacy, doctors, and settings.
- `frontend/`: Vite + React + TypeScript app with page placeholders for dashboard, patients, appointments, billing, pharmacy, and settings.
- `backend/prisma/schema.prisma`: production-grade database schema for hospital entities.
