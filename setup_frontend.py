import os
import json

base_dir = r"c:\Users\user\Desktop\Yahav Hatzala Betucha\frontend-mobile"

files = {
    "src/api/axiosClient.ts": """import axios from 'axios';\n\nconst axiosClient = axios.create({\n  baseURL: import.meta.env.VITE_API_URL || '/api',\n});\n\naxiosClient.interceptors.request.use((config) => {\n  const token = localStorage.getItem('token');\n  if (token && config.headers) {\n    config.headers.Authorization = `Bearer ${token}`;\n  }\n  return config;\n});\n\nexport default axiosClient;\n""",
    "src/components/common/Button.tsx": "export default function Button() { return <button>Button</button>; }",
    "src/components/common/Modal.tsx": "export default function Modal() { return <div>Modal</div>; }",
    "src/components/common/Input.tsx": "export default function Input() { return <input placeholder='Input' />; }",
    "src/features/auth/LoginForm.tsx": "export default function LoginForm() { return <div>LoginForm</div>; }",
    "src/features/employee/NextTripCard.tsx": "export default function NextTripCard() { return <div>NextTripCard {/* Logic placeholder: check if trip is unconfirmed to display urgent banner */}</div>; }",
    "src/features/employee/TripFeed.tsx": "export default function TripFeed() { return <div>TripFeed</div>; }",
    "src/features/employee/TripCard.tsx": "export default function TripCard() { return <div>TripCard</div>; }",
    "src/features/employee/WaitlistButton.tsx": "export default function WaitlistButton() { return <button>WaitlistButton</button>; }",
    "src/features/employee/ReportForm.tsx": "import S3Uploader from './S3Uploader';\n\nexport default function ReportForm() { return <div>ReportForm <S3Uploader /></div>; }",
    "src/features/employee/S3Uploader.tsx": "export default function S3Uploader() { return <div>S3Uploader</div>; }",
    "src/features/admin/AdminLayout.tsx": "import React from 'react';\n\nexport default function AdminLayout({children}: {children: React.ReactNode}) { return <div><nav>Sidebar/Topbar</nav><main>{children}</main></div>; }",
    "src/features/admin/TripManagementBoard.tsx": "export default function TripManagementBoard() { return <div>TripManagementBoard</div>; }",
    "src/features/admin/SmartClientInput.tsx": "export default function SmartClientInput() { return <div>SmartClientInput {/* Auto-complete for Soft Creation */}</div>; }",
    "src/features/admin/AssignmentManager.tsx": "export default function AssignmentManager() { return <div>AssignmentManager</div>; }",
    "src/features/admin/BillingPivotView.tsx": "export default function BillingPivotView() { return <div>BillingPivotView</div>; }",
    "src/features/admin/ClientAccordion.tsx": "export default function ClientAccordion() { return <div>ClientAccordion</div>; }",
    "src/features/admin/EmployeeOvertimeRow.tsx": "export default function EmployeeOvertimeRow() { return <div>EmployeeOvertimeRow</div>; }",
    "src/features/admin/StaffApprovalsTable.tsx": "export default function StaffApprovalsTable() { return <div>StaffApprovalsTable</div>; }",
    "src/hooks/useAuth.ts": "export function useAuth() { return { user: null }; }",
    "src/pages/admin/Dashboard.tsx": "export default function Dashboard() { return <div>Admin Dashboard</div>; }",
    "src/pages/admin/Trips.tsx": "export default function Trips() { return <div>Admin Trips</div>; }",
    "src/pages/admin/Billing.tsx": "export default function Billing() { return <div>Admin Billing</div>; }",
    "src/pages/employee/Home.tsx": "export default function Home() { return <div>Employee Home</div>; }",
    "src/pages/employee/Trips.tsx": "export default function Trips() { return <div>Employee Trips</div>; }",
    "src/pages/employee/Report.tsx": "export default function Report() { return <div>Employee Report</div>; }"
}

for rel_path, content in files.items():
    full_path = os.path.join(base_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

# Update package.json
pkg_path = os.path.join(base_dir, "package.json")
with open(pkg_path, "r", encoding="utf-8") as f:
    pkg = json.load(f)

pkg["dependencies"]["@tanstack/react-query"] = "^5.0.0"
pkg["dependencies"]["react-router-dom"] = "^6.20.0"
pkg["dependencies"]["axios"] = "^1.6.0"
pkg["devDependencies"]["vite-plugin-pwa"] = "^0.17.0"

with open(pkg_path, "w", encoding="utf-8") as f:
    json.dump(pkg, f, indent=2)

print("Files created successfully.")
