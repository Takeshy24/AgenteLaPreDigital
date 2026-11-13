import { request } from '../../api';
export interface AdminUser {
  id: number;
  username: string;
}
export interface AdminSession {
  user: AdminUser | null;
}
export const currentSession = () => request<AdminSession>('/auth/session');
export const login = (username: string, password: string) =>
  request<AdminSession>('/auth/login', 'POST', { username, password });
export const logout = () => request('/auth/logout', 'POST', {});
