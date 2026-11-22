import Header from "@/components/layout/site-header/site-header";
import Footer from "@/components/layout/footer/footer";
import ChatWidget from "@/features/chat/components/chat-widget/chat-widget";
import Analytics from "@/features/analytics/components/analytics";

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
      {/* Shopping assistant, shown only when ANTHROPIC_API_KEY is set */}
      <ChatWidget />
      {/* Google Analytics / Meta Pixel, only when the IDs are set and the visitor accepts cookies */}
      <Analytics />
    </>
  );
}