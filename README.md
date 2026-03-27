# Attendance Management System

A comprehensive full-stack attendance tracking application built with React, TypeScript, TailwindCSS, and Supabase.

## Features

### Frontend (User View)
- **Global Search**: Search for students across all cohorts and programmes
- **Week Selection**: View and mark attendance for different weeks
- **Quick Marking**: Mark students as present with a single click
- **Smart Status Updates**: Automatically handles HYBRID status when student is both online and in-person
- **Real-time Updates**: Instantly see attendance status changes

### Admin Panel
- **Student Management**: View and manage all students by programme
- **Bulk Actions**: Mark attendance status for individual students
- **Excel Uploads**:
  - Upload student lists from Excel files
  - Upload online attendance with smart fuzzy matching
- **Programme Filtering**: Filter students by programme and cohort
- **Week Management**: Manage attendance across multiple weeks

### Smart Features
- **Fuzzy Name Matching**: Automatically suggests matches for names that don't exactly match
- **Manual Selection**: Review and confirm suggested matches before updating attendance
- **Status Logic**:
  - `ABSENT`: Default status
  - `IN_PERSON`: Physically present
  - `ONLINE`: Attending online
  - `HYBRID`: Both online and in-person (automatic when both are marked)

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Excel Processing**: SheetJS (xlsx)
- **Fuzzy Matching**: Fuse.js
- **Build Tool**: Vite

## Database Schema

### Tables
1. **cohorts**: Cohort groups (e.g., "Cohort 45")
2. **programmes**: Programme types (aPHRi, PHRi, SPHRi, UNKNOWN) linked to cohorts
3. **students**: Student records with name, email, and programme assignment
4. **weeks**: Week definitions for tracking
5. **attendance**: Attendance records with status per student per week

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account and project

### Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure Supabase**:
The `.env` file is already configured with your Supabase credentials.

3. **Run the development server**:
```bash
npm run dev
```

4. **Initial Data**:
The application automatically seeds initial data (cohorts, programmes, weeks) on first load.

## Creating an Admin User

To access the admin panel, you need to create an admin user in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Click "Add User"
4. Enter an email and password
5. Confirm the user
6. Use these credentials to log in to the admin panel

## Usage

### Frontend View (Public)
1. Open the application - you'll see the frontend view by default
2. Select a week from the dropdown
3. Search for students by name
4. Click "Mark Present" to mark attendance

### Admin Panel (Protected)
1. Click the logo to navigate to the admin panel
2. Log in with admin credentials
3. Use the filters to view students by programme and week
4. Mark attendance using the action buttons
5. Upload students or online attendance via Excel files

### Excel File Formats

**Student Upload**:
- Column A: Student Name
- Column B: Student Email

**Online Attendance Upload**:
- Column A: Student Names (one per row)

## Color Coding

- **Gray**: ABSENT
- **Green**: IN_PERSON
- **Blue**: ONLINE
- **Purple**: HYBRID

## Security

- Admin panel requires authentication
- Row Level Security (RLS) enabled on all tables
- Public read access for attendance checking
- Protected write operations for admin functions

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Design

The application uses the HRCC branding:
- Primary Color: #091838 (dark blue)
- Accent Color: #e51836 (red)
- Secondary Color: #d1ad73 (gold)
- Font: Open Sans

## Support

For issues or questions, please refer to the Supabase documentation or create an issue in the project repository.
