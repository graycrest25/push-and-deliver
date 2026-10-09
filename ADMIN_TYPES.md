# User and Admin Types

The project defines four admin types, plus a user with no admin access.

| Type | `adminType` value | Access shown in the project |
|---|---|---|
| Super Admin | `super` | Broadest access; manages user roles and has exclusive sidebar access to Fees, DHL Zones, Delivery Zones, and Export Rates. |
| Regular Admin | `regular` | General dashboard administration, including express shipment checkout links, excluding super-admin-only features. |
| Customer Care | `customercare` | Customer support sections, users, riders, merchants, and orders; several pages restrict this role to viewing. |
| Verifier | `verifier` | Restricted to rider pages; can upload rider verification documents. |
| User (No Admin Access) | `""`, with `isAdmin: false` | Cannot access the admin dashboard. |

Admin access requires `isAdmin: true`. The role is stored in `adminType`.

These options are defined in [User Management](src/pages/admin/user-management.tsx). Access descriptions reflect the frontend's navigation, route, and page checks.
