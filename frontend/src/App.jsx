import { Routes, Route, NavLink } from "react-router-dom";
import SignalFeed from "./pages/SignalFeed";
import SearchManager from "./pages/SearchManager";
import ClientManager from "./pages/ClientManager";
import ClientView from "./pages/ClientView";
import NotificationSettings from "./pages/NotificationSettings";

const navItems = [
  { to: "/", label: "Signals" },
  { to: "/searches", label: "Searches" },
  { to: "/clients", label: "Clients" },
  { to: "/notifications", label: "Notifications" },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-8">
        <span className="font-bold text-lg text-gray-800">UGC Signals</span>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `text-sm font-medium ${
                isActive
                  ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                  : "text-gray-500 hover:text-gray-700"
              }`
            }
            end={item.to === "/"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<SignalFeed />} />
          <Route path="/searches" element={<SearchManager />} />
          <Route path="/clients" element={<ClientManager />} />
          <Route path="/clients/:id" element={<ClientView />} />
          <Route path="/notifications" element={<NotificationSettings />} />
        </Routes>
      </main>
    </div>
  );
}
