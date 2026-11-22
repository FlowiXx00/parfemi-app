import OrdersPage from "@/features/account/components/orders-page/orders-page";
import { getAuthState } from "@/features/auth/server/get-auth-state";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Porudžbine");

export default async function OrdersRoute() {
  const { isLoggedIn } = await getAuthState();

  return <OrdersPage isLoggedIn={isLoggedIn} />;
}