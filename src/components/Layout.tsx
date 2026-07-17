import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Header from "@/components/Header";

// 页面骨架：左侧菜单固定，右侧内容区通过 Outlet 渲染当前路由页面。
export function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-w-0 overflow-x-hidden">
        <Header />
        {/* 业务页面统一放在 main 内，保持一致的内边距和滚动区域。 */}
        <main className="flex-1 w-full overflow-y-auto px-4 md:px-8 lg:px-12 py-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
