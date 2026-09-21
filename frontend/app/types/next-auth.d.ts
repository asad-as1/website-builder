import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      accessToken?: string;
      role?: string;
      wasReactivated?: boolean;
    };
  }

  interface User {
    token?: string;
    role?: string;
    provider?: string;
    wasReactivated?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    role?: string;
    image?: string | null;
    name?: string | null;
    provider?: string;
    wasReactivated?: boolean;
  }
}