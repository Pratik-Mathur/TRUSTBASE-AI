import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, PlusCircle, LogOut, Zap, LayoutDashboard } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/questionnaire/new', icon: PlusCircle, label: 'New Questionnaire' },
];

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-[#020817]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B1221] border-r border-slate-800 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sky-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-white font-bold text-lg font-jakarta">AnswerIQ</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
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
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
};

export default DashboardLayout;
