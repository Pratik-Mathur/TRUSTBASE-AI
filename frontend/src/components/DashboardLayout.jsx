import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, PlusCircle, LogOut, Zap, LayoutDashboard, Menu, X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/questionnaire/new', icon: PlusCircle, label: 'New Questionnaire' },
];

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-[#020817]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0B1221] border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sky-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-white font-bold text-lg font-jakarta">TrustBase AI</span>
          </div>
          <button
            onClick={closeSidebar}
            className="md:hidden text-slate-500 hover:text-white transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeSidebar}
                data-testid={`nav-${item.label.toLowerCase().replace(/ /g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-slate-500 text-xs mb-3 truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0B1221]/95 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-white font-bold font-jakarta">TrustBase AI</span>
          </div>
          <button
            data-testid="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
