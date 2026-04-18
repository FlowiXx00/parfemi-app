import OrdersPage from "@/features/account/components/orders-page/orders-page";
import { getAuthState } from "@/shared/auth/server/get-auth-state";

export default async function OrdersRoute() {
  const { isLoggedIn } = await getAuthState();

  return <OrdersPage isLoggedIn={isLoggedIn} />;
}