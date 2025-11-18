export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
