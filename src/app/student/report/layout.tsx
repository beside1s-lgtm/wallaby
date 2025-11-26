export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-screen">
      <main>{children}</main>
    </div>
  );
}
