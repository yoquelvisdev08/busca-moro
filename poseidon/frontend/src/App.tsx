import { ShellHeader } from "@/components/layout/ShellHeader";
import { InboxPage } from "@/pages/InboxPage";

export function App() {
  return (
    <div className="grid h-screen grid-rows-[56px_minmax(0,1fr)] bg-bg">
      <ShellHeader />
      <main id="main-content" className="min-h-0 overflow-y-auto">
        <InboxPage />
      </main>
    </div>
  );
}
