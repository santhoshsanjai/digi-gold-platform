import React, { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, theme } from 'antd'
import type { MenuProps } from 'antd'
import { KeyRound, LogOut, Menu as MenuIcon, Moon, Sun } from 'lucide-react'
import { BrandMark } from '../components/common/BrandMark.tsx'
import { useAuth } from '../providers/authContext.ts'
import { useTheme } from '../providers/themeContext.ts'
import { menuIcon } from './menuIcons.ts'

const { Header, Sider, Content } = Layout

/** Picks the menu entry for the current page, including nested pages like /customers/:id. */
function selectedKey(pathname: string, paths: { key: string; path: string }[]): string[] {
  const match = paths
    .filter((m) => (m.path === '/' ? pathname === '/' : pathname.startsWith(m.path)))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return match ? [match.key] : []
}

export const MainLayout: React.FC = () => {
  const { user, signOut } = useAuth()
  const { mode, toggleTheme, brand } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const screens = Grid.useBreakpoint()
  const isDesktop = Boolean(screens.lg)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { token } = theme.useToken()

  // The side menu comes from the API, built from the permissions of the user's role.
  const items = useMemo<MenuProps['items']>(
    () =>
      (user?.menu ?? []).map((m) => {
        const Icon = menuIcon(m.icon)
        return { key: m.key, icon: <Icon size={18} />, label: m.label }
      }),
    [user],
  )

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    const item = user?.menu.find((m) => m.key === key)
    if (item) navigate(item.path)
    setDrawerOpen(false)
  }

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

  const menu = (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={selectedKey(pathname, user?.menu ?? [])}
      onClick={onMenuClick}
      style={{ borderInlineEnd: 0 }}
    />
  )

  const logo = (
    <div className="h-16 flex items-center gap-3 px-4 overflow-hidden">
      <BrandMark size={34} />
      {(!collapsed || !isDesktop) && (
        <span className="font-heading font-bold text-base truncate">{brand.name}</span>
      )}
    </div>
  )

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Layout className="min-h-screen">
      {isDesktop ? (
        <Sider
          theme="light"
          width={232}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          className="border-r border-slate-200 dark:border-slate-800 no-print"
          style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
        >
          {logo}
          {menu}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={260}
          styles={{ body: { padding: 0 } }}
          title={null}
          closable={false}
        >
          {logo}
          {menu}
        </Drawer>
      )}
      <Layout>
        <Header
          className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800"
          style={{ paddingInline: 16, background: token.colorBgContainer }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {!isDesktop && (
              <Button
                type="text"
                icon={<MenuIcon size={20} />}
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              />
            )}
            {!isDesktop && <span className="font-heading font-semibold truncate">{brand.name}</span>}
          </div>
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
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer bg-transparent border-0"
              >
                <Avatar size={32} className="bg-primary-500!">
                  {initials}
                </Avatar>
                <span className="hidden md:inline text-sm font-medium max-w-40 truncate">
                  {user?.name}
                </span>
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
    </Layout>
  )
}
