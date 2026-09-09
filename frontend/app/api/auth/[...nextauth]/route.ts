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
              plan: data.user.plan || "free",
              image: data.user.avatar || null,
              provider: "credentials"
            };
          }

          throw new Error(data.error || "Invalid credentials");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid credentials";
          console.error("❌ NextAuth - Error:", message);
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
        console.error("NextAuth - Google profile is missing email or subject");
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
          console.error("NextAuth - Backend Google authentication failed:", data.error);
          return false;
        }

        // ✅ Store user data from backend
        user.id = data.user.id;
        user.token = data.token;
        user.plan = data.user.plan || "free";
        user.image = data.user.avatar || null; // ✅ Avatar set karo
        user.name = data.user.name || user.name;
        user.provider = "google";

        console.log("✅ NextAuth - Google signIn successful for:", user.email);
        return true;
      } catch (error) {
        console.error("❌ NextAuth - Google signIn error:", error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.token;
        token.plan = user.plan;
        token.image = user.image || null; // ✅ Image store karo
        token.name = user.name;
        token.provider = user.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.accessToken = token.accessToken as string;
        session.user.plan = token.plan as string;
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