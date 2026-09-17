import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password
            })
          });

          const data = await res.json();

          if (res.ok && data.token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || "User",
              token: data.token,
              role: data.user.role || "user",
              image: data.user.avatar || null,
              provider: "credentials"
            };
          }

          throw new Error(data.error || "Invalid credentials");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid credentials";
          throw new Error(message);
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const googleId = profile?.sub;
      if (!user.email || !googleId) {
        return false;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            picture: user.image,
            googleId,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.token || !data.user) {
          return false;
        }

        user.id = data.user.id;
        user.token = data.token;
        user.role = data.user.role || "user";
        user.image = data.user.avatar || null;
        user.name = data.user.name || user.name;
        user.provider = "google";

        return true;
      } catch (error) {
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.token;
        token.role = user.role;
        token.image = user.image || null;
        token.name = user.name;
        token.provider = user.provider;
      }

      // ✅ Handle session update trigger (avatar update)
      if (trigger === "update") {
        // If image passed directly
        if (session?.image) {
          token.image = session.image;
        }
        // ✅ Fetch fresh avatar from backend
        if (token.accessToken) {
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${token.accessToken}` },
            });
            const data = await res.json();
            if (data.user?.avatar) {
              token.image = data.user.avatar;
            }
            if (data.user?.name) {
              token.name = data.user.name;
            }
          } catch {
            // Silent fail
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.accessToken = token.accessToken as string;
        session.user.role = token.role as string;
        session.user.image = token.image as string || null;
        session.user.name = token.name as string;
        session.user.provider = token.provider as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };