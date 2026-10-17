import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-muted dark:bg-[#070b1d] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 dark:bg-[radial-gradient(900px_380px_at_38%_-80px,rgba(59,91,255,0.2),transparent),radial-gradient(600px_300px_at_100%_0,rgba(99,102,241,0.14),transparent)]">
        <Topbar user={session.user} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
