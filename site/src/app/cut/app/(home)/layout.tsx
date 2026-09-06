import { AppHeader } from "@/cut/components/AppHeader";
import { AppSidebar } from "@/cut/components/AppSidebar";
import { StorageUpgradeDialog } from "@/cut/components/StorageUpgradeDialog";
import { MobileSidebarProvider } from "@/cut/lib/mobileSidebar";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileSidebarProvider>
      <div className="flex h-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
        {/* Every home surface uploads — projects, library — so the quota wall
            answers from the layout rather than from each page. */}
        <StorageUpgradeDialog />
      </div>
    </MobileSidebarProvider>
  );
}
