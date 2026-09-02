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
      plan?: string;
    };
  }

  interface User {
    token?: string;
    plan?: string;
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    plan?: string;
    image?: string | null;
    name?: string | null;
    provider?: string;
  }
}