import { NavLink, useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/config/navigation';

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <SidebarTrigger className="shrink-0 md:hidden" />

        <NavLink
          to="/"
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="size-8 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-black italic">
            设
          </div>
          <span className="text-sm font-bold text-foreground hidden sm:inline-block whitespace-nowrap">
            设备维护计划智能体
          </span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
