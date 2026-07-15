import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NAV_ITEMS } from '@/config/navigation';

export default function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-sm font-black italic text-sidebar-primary-foreground">
            排
          </div>
          <div className="min-w-0 flex-1 group-data-[state=collapsed]:hidden">
            <div className="truncate text-sm font-black italic tracking-tighter">设备维护计划智能体</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-2">
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                    <NavLink to={item.path} className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-2xl bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            管
          </div>
          <div className="min-w-0 flex-1 group-data-[state=collapsed]:hidden">
            <div className="truncate text-xs text-muted-foreground">管理员</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
