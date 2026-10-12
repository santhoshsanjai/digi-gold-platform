import React from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Layout, theme } from 'antd'
import type { MenuProps } from 'antd'
import { KeyRound, LayoutGrid, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '../providers/authContext.ts'
import { useTheme } from '../providers/themeContext.ts'

const { Header, Content } = Layout

/** The Console has few top-level pages, so it uses a top bar instead of a side menu. */
export const MainLayout: React.FC = () => {
  const { user, signOut } = useAuth()
  const { mode, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { token } = theme.useToken()

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <KeyRound size={16} />,
      label: 'Profile and password',
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      danger: true,
      icon: <LogOut size={16} />,
      label: 'Log out',
      onClick: async () => {
        await signOut()
        navigate('/login', { replace: true })
      },
    },
  ]

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Layout className="min-h-screen">
      <Header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800"
        style={{ paddingInline: 16, background: token.colorBgContainer }}
      >
        <Link to="/clients" className="flex items-center gap-2 text-inherit!">
          <span className="w-8 h-8 rounded-lg bg-primary-500 text-white grid place-items-center">
            <LayoutGrid size={18} />
          </span>
          <span className="font-heading font-bold">Platform Console</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="text"
            shape="circle"
            onClick={toggleTheme}
            aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            icon={mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          />
          <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              aria-label="Account"
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer bg-transparent border-0"
            >
              <Avatar size={32} className="bg-primary-500!">
                {initials}
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
            </button>
          </Dropdown>
        </div>
      </Header>
      <Content className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </Content>
    </Layout>
  )
}
