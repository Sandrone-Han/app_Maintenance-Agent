import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { AppContainer, ErrorRender } from "@lark-apaas/client-toolkit-lite";
import App from "./app";
import "./index.css";

// 前端应用入口：挂载 React 根节点，并统一接入路由、平台容器和错误边界。
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* basename 支持平台按子路径部署，默认以站点根路径运行。 */}
    <BrowserRouter basename={process.env.CLIENT_BASE_PATH || "/"}>
      <AppContainer>
        {/* 捕获页面渲染异常，交给平台统一错误组件展示。 */}
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender error={error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <App />
        </ErrorBoundary>
      </AppContainer>
    </BrowserRouter>
  </StrictMode>,
);
