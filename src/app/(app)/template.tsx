import FetchCache from "@/components/FetchCache";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FetchCache />
      <div className="page-enter">{children}</div>
    </>
  );
}
