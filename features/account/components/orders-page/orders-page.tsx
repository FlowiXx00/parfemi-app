import GuestOrdersView from "./guest-orders-view";
import LoggedInOrdersView from "./logged-in-orders-view";

type OrdersPageProps = {
  isLoggedIn: boolean;
};

export default function OrdersPage({ isLoggedIn }: OrdersPageProps) {
  return isLoggedIn ? <LoggedInOrdersView /> : <GuestOrdersView />;
}