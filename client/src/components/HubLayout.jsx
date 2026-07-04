// Wraps a hub page (Dashboard now; Coach History / Reading Lounge later) with
// the glass SidebarNav instead of the shared top bar. See App.jsx's AppNav —
// routes using this layout are listed in SIDEBAR_ROUTES so the top slot stays empty.
import SidebarNav from "./SidebarNav.jsx";

export default function HubLayout({ children }) {
  return (
    <div className="flex items-start">
      <SidebarNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
