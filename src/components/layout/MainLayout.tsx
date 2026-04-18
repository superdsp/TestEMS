import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Activity, Bell, BarChart3, ChevronRight } from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/loads', label: '负载管理', icon: Building2 },
  { path: '/monitoring', label: '监控', icon: Activity },
  { path: '/alarms', label: '报警', icon: Bell },
  { path: '/historical', label: '历史数据', icon: BarChart3 },
]

export default function MainLayout() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Dark Blue */}
      <header className="bg-[#1e3a5f] border-b border-[#152d4a] sticky top-0 z-50 shadow-lg">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <h1 className="text-xl font-semibold text-white">EMS 能源管理系统</h1>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-slate-400 text-sm">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-white text-sm">系统运行中</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Trigger Area - Dark Blue */}
        <div
          className="relative z-50"
          onMouseEnter={() => setIsOpen(true)}
        >
          {/* Expand indicator */}
          <div
            className="w-6 h-full min-h-[calc(100vh-4rem)] bg-[#152d4a] hover:bg-[#1e3a5f] transition-colors flex flex-col items-center py-4 cursor-pointer border-r border-[#0f1f35]"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Sidebar Panel - Dark Blue */}
          <nav
            className={`absolute top-0 left-6 bg-[#1e3a5f] border-r border-[#152d4a] min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out ${
              isOpen ? 'w-56 opacity-100' : 'w-0 opacity-0 overflow-hidden'
            }`}
            onMouseLeave={() => setIsOpen(false)}
          >
            <div className="w-56 p-4 space-y-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-[#2d4a6f] hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>

        {/* Main Content - Light background */}
        <main className="flex-1 p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
