import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 合并条件 className，并处理 Tailwind 冲突类的覆盖顺序。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
