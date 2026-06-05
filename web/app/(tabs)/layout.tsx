import { BottomNav } from "@/components/BottomNav";

// Layout shared by the three bottom-tab screens (Mine / Friends / Me).
// Create, Detail and Onboarding live outside this group, so they render
// full-screen without the tab bar.
export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Bottom padding so content clears the floating glass tab bar (which is
          positioned over the content, not in flow). */}
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
