import { Sidebar } from "@/components/sidebar";
import { HelpButton } from "@/components/help/HelpButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 bg-[var(--background)]">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>
      <HelpButton />
    </div>
  );
}
