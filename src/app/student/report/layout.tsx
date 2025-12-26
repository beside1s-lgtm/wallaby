export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="light bg-background min-h-screen">
      <main>{children}</main>
    </div>
  );
}
