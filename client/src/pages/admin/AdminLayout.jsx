import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  CircleDollarSign,
  Flag,
} from "lucide-react";
import { cn } from "../../lib/utils.js";

const NAV = [
  { to: "/admin",           label: "Overview",  icon: LayoutDashboard, end: true },
  { to: "/admin/users",     label: "Users",     icon: Users },
  { to: "/admin/questions", label: "Questions", icon: FileText },
  { to: "/admin/costs",     label: "AI Costs",  icon: CircleDollarSign },
  { to: "/admin/flags",     label: "Flags",     icon: Flag },
];

export default function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-56 flex-none">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 px-2">
            Admin
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
