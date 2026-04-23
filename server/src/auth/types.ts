export type AuthRole = "admin" | "customer";

export type AuthContext = {
  userId: string;
  email: string;
  role: AuthRole;
};

export type AppJwtPayload = {
  sub: string;
  email: string;
  role: AuthRole;
};
