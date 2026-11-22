import AccountPageView from "@/features/account/components/account-page-view/account-page-view";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Moj nalog");

export default function AccountPage() {
  return <AccountPageView />;
}