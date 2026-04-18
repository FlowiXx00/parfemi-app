export function getProductGallery(productId: string) {
  return [
    {
      src: `/perfumes/${productId}/parfem.png`,
      label: "Parfem",
    },
    {
      src: `/perfumes/${productId}/note.png`,
      label: "Note",
    },
    {
      src: `/perfumes/${productId}/nositi.png`,
      label: "Kada nositi",
    },
    {
      src: `/perfumes/${productId}/akordi.png`,
      label: "Akordi",
    },
  ];
}

export function getPrimaryProductImage(productId: string) {
  return `/perfumes/${productId}/parfem.png`;
}