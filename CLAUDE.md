# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based admin dashboard for "Push & Deliver", a delivery platform that manages users, riders, vendors, fees, referrals, and notifications. The application uses Clerk for authentication and shadcn/ui components for the UI.

## Common Commands

### Development
- `npm run dev` - Start development server with Vite and HMR
- `npm run build` - Type-check with TypeScript and build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on the codebase

## Architecture

### Tech Stack
- **Framework**: React 19.2.0 + TypeScript
- **Build Tool**: Vite 7.2.2
- **Routing**: React Router v7 (react-router-dom@7.9.6)
- **Authentication**: Clerk (@clerk/clerk-react)
- **UI Components**: shadcn/ui (based on Radix UI primitives)
- **Styling**: Tailwind CSS 4.x with CSS variables
- **Icons**: Tabler Icons (@tabler/icons-react) and Lucide React
- **Data Tables**: TanStack Table (@tanstack/react-table)
- **Charts**: Recharts
- **Drag & Drop**: dnd-kit
- **Forms & Validation**: Zod
- **Notifications**: Sonner

### Project Structure

```
src/
├── app/              # App-level features (dashboard data)
├── components/       # React components
│   ├── ui/          # shadcn/ui components (button, dialog, etc.)
│   └── shared/      # Shared custom components
├── hooks/           # Custom React hooks
├── Layout/          # Layout components
├── lib/             # Utility functions (utils.ts)
├── pages/           # Page components
│   └── Auth/        # Authentication pages (SignIn, SignUp)
├── router/          # Routing configuration
└── types/           # TypeScript type definitions
```

### Key Architecture Patterns

**Authentication Flow**:
- Entry point is `main.tsx` which wraps the app in `ClerkProvider`
- Environment variable `CLERK_PUBLISHABLE_KEY` is required in `.env`
- Router (`router/Router.tsx`) handles route protection with Clerk's `SignedIn` and `SignedOut` components
- Unauthenticated users are redirected to `/sign-in`

**Routing Structure**:
- All authenticated routes are wrapped in `Layout` component
- Layout includes `AppSidebar` with main navigation
- Main navigation sections: Dashboard, Users, Riders, Vendors, Fees, Referrals, Notifications, Analytics
- Each section may have sub-routes (e.g., `/users`, `/users/analytics`)

**Component Organization**:
- shadcn/ui components are in `components/ui/` and use the "new-york" style variant
- Path aliases configured: `@/` maps to `src/`
- Common aliases: `@/components`, `@/lib/utils`, `@/hooks`

**Type Definitions** (`src/types/index.ts`):
Core entities include:
- `User` - Platform users with status and order history
- `Rider` - Delivery riders with vehicle info, documents, and verification status
- `Vendor` - Business vendors with verification and rating
- `Fee` - Platform fees (delivery, service, platform)
- `Referral` - Referral program tracking
- `Notification` - Push notifications with targeting

**State Management**:
- Component-level state with React hooks
- Clerk manages authentication state globally
- Theme management via next-themes

### Admin Permissions & Features

The admin dashboard has the following CRUD permissions (C=Create, R=Read, U=Update, D=Delete):

1. **Fees** - Full CRUD (C, R, U, D)
   - Create new platform fees (delivery, service, platform fees)
   - Read all fee configurations
   - Update existing fee structures
   - Delete fees

2. **Riders & Vendors** - Read and Update only (R, U)
   - View rider/vendor profiles and information
   - Verify new riders and vendors
   - Block/unblock riders and vendors
   - Cannot create or delete rider/vendor accounts directly

3. **Referrals** - Read only (R)
   - Fetch and view list of referrals per user
   - Track referral status (pending, completed, expired)

4. **Broadcast Notifications** - Full CRUD (C, R, U, D)
   - Create new notifications to broadcast
   - Read notification history
   - Update scheduled/draft notifications
   - Delete notifications

5. **Users** - Read only (R)
   - View total count of users, riders, and vendors
   - View detailed user information and profiles
   - Access user analytics

6. **Dashboard Analytics**
   - View platform-wide metrics and statistics
   - Monitor total users, riders, and vendors

### Navigation Structure

Main navigation defined in `app-sidebar.tsx`:
- **Dashboard**: Main overview with platform metrics
- **Users**: User management with analytics sub-page (Read-only)
- **Riders**: Active riders, pending verification, blocked riders (Read/Update - verify & block)
- **Vendors**: Active vendors, pending verification, blocked vendors (Read/Update - verify & block)
- **Fees**: Fee management and creation (Full CRUD)
- **Referrals**: Referral program management (Read-only)
- **Notifications**: Notification history and broadcast feature (Full CRUD)
- **Analytics**: Platform analytics
- **Settings**: Application settings
- **Help & Support**: Help resources

### Styling Conventions

- Tailwind CSS with CSS variables for theming
- Components use `cn()` utility from `lib/utils.ts` for conditional classes
- Base color scheme: neutral
- shadcn/ui components configured with CSS variables for easy theming

### Development Notes

- The app uses Vite's environment variable system (`import.meta.env`)
- Path resolution configured in both `vite.config.ts` and `tsconfig` files
- ESLint configured for React with hooks plugin
- TypeScript strict mode enabled with composite project structure (`tsconfig.app.json`, `tsconfig.node.json`)
