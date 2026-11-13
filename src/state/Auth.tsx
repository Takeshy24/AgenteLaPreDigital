import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { currentSession, login, logout, type AdminUser } from '../features/auth/api';

function useAuthState() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const checkVersion = useRef(0);
  const checkSession = useCallback(async () => {
    const version = ++checkVersion.current;
    setChecking(true);
    setError('');
    try {
      const session = await currentSession();
      if (version === checkVersion.current) setUser(session.user);
    } catch (failure) {
      if (version === checkVersion.current) setError((failure as Error).message);
    } finally {
      if (version === checkVersion.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    void checkSession();
  }, [checkSession]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setError('Tu sesión terminó. Vuelve a ingresar.');
    };
    window.addEventListener('lapredigital:auth-required', expired);
    return () => window.removeEventListener('lapredigital:auth-required', expired);
  }, []);
  async function signIn(username: string, password: string) {
    const session = await login(username, password);
    if (!session.user) throw new Error('No se pudo iniciar sesión.');
    setError('');
    setUser(session.user);
  }
  async function signOut() {
    await logout();
    setUser(null);
    setError('');
  }
  return { user, checking, error, checkSession, signIn, signOut };
}
type AuthState = ReturnType<typeof useAuthState>;
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider requerido');
  return auth;
}
