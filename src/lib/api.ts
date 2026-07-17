const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

// 后端 API 根地址：优先读取 Vite 环境变量，本地开发默认连 NestJS 的 /api。
export const API_BASE_URL =
  viteEnv?.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

// 通用 GET 请求封装，调用方只关心返回的业务数据类型。
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

// 通用 POST 请求封装，默认按 JSON 提交请求体。
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

// 通用 PUT 请求封装，用于编辑、确认异常等更新类接口。
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

// 通用 DELETE 请求封装，用于删除任务或基础资料。
export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

// 文件上传封装，目前主要服务于人员 Excel 导入。
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

// 统一读取后端错误结构，避免页面层重复解析 Response。
async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string | string[]; error?: string };
    const message = Array.isArray(data.message) ? data.message.join('；') : data.message;
    return message ?? data.error ?? `API request failed: ${response.status}`;
  } catch {
    return `API request failed: ${response.status}`;
  }
}
