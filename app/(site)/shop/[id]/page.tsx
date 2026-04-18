import { notFound } from "next/navigation";
import { getProductById } from "@/features/shop/server/catalog.service";
import DetailsClient from "../../../../features/shop/components/product-details/product-details-client";
import { getAuthState } from "@/shared/auth/server/get-auth-state";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ml?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const product = await getProductById(id);
  if (!product) return notFound();

  const { isLoggedIn } = await getAuthState();

  return (
    <DetailsClient
      product={product}
      mlFromUrl={sp.ml ?? ""}
      isLoggedIn={isLoggedIn}
    />
  );
}