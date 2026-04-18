import Header from "@/widgets/site-header/site-header";
import Footer from "@/shared/ui/footer/footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="siteShell">{children}</div>
      <Footer />
    </>
  );
}