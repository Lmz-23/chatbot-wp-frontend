export interface User {
  userId: string;
  email: string;
  platformRole: string;
  businessId: string | null;
  businessRole: string | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}
