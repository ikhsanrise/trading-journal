import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt({ token, user }: any) {
      if (user) { token.id = user.id; token.email = user.email; token.name = user.name; }
      return token;
    },
    session({ session, token }: any) {
      if (token && session.user) { session.user.id = token.id; }
      return session;
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: any) {
        try {
          if (!credentials?.email || !credentials?.password) return null;
          
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          
          if (!user) return null;
          if (!user.password) return null;
          
// Bcrypt comparison
const bcrypt = require('bcryptjs');
const match = await bcrypt.compare(credentials.password, user.password);
if (!match) return null;
          
          return { id: user.id, email: user.email, name: user.name };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
};

const handler = NextAuth(authOptions);
export { handler };
export const auth = async () => {
  const { getServerSession } = await import("next-auth");
  return getServerSession(authOptions);
};
