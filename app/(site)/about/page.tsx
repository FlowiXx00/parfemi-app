import AboutPage from "@/features/about/components/about-page/about-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "O nama",
  description:
    "Ko stoji iza Atelier Dekanta i kako pripremamo dekante: originalni parfemi, pažljivo pretakanje i sigurno pakovanje.",
  path: "/about",
});

export default function ONamaPage() {
  return <AboutPage />;
}