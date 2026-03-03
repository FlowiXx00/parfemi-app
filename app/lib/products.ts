export type Variant = { ml: number; priceRsd: number; inStock: boolean };

export type Gender = "Muški" | "Ženski" | "Unisex";
export type Concentration =
  | "Eau de cologne"
  | "Eau de toilette"
  | "Eau de parfum"
  | "Extrait de parfum"
  | "Parfum";

export type Product = {
  id: string;
  name: string;
  brand: string;
  popularity: number;
  imageUrl: string;

  gender: Gender;
  concentration: Concentration;
  onSale: boolean;

  variants: Variant[];
};

export const products: Product[] = [
  {
    id: "dush-blanche",
    name: "Dush BLANCHE",
    brand: "Dush",
    popularity: 98,
    imageUrl: "https://placehold.co/600x600?text=Dush+BLANCHE",
    gender: "Unisex",
    concentration: "Eau de parfum",
    onSale: false,
    variants: [
      { ml: 2, priceRsd: 2400, inStock: false },
      { ml: 5, priceRsd: 5200, inStock: false },
      { ml: 10, priceRsd: 9000, inStock: false },
    ],
  },
  {
    id: "nishane-hacivat",
    name: "Nishane Hacivat",
    brand: "Nishane",
    popularity: 95,
    imageUrl: "https://placehold.co/600x600?text=Nishane+Hacivat",
    gender: "Unisex",
    concentration: "Eau de parfum",
    onSale: true,
    variants: [
      { ml: 2, priceRsd: 2300, inStock: true },
      { ml: 5, priceRsd: 4500, inStock: true },
      { ml: 10, priceRsd: 7000, inStock: true },
    ],
  },
  {
    id: "amouage-guidance",
    name: "Amouage Guidance",
    brand: "Amouage",
    popularity: 92,
    imageUrl: "https://placehold.co/600x600?text=Amouage+Guidance",
    gender: "Ženski",
    concentration: "Extrait de parfum",
    onSale: false,
    variants: [
      { ml: 2, priceRsd: 3600, inStock: true },
      { ml: 5, priceRsd: 6900, inStock: true },
      { ml: 10, priceRsd: 12900, inStock: true },
    ],
  },
  {
    id: "pdm-valaya",
    name: "Parfums De Marly Valaya",
    brand: "Parfums de Marly",
    popularity: 90,
    imageUrl: "https://placehold.co/600x600?text=PDM+Valaya",
    gender: "Ženski",
    concentration: "Eau de parfum",
    onSale: true,
    variants: [
      { ml: 2, priceRsd: 2600, inStock: true },
      { ml: 5, priceRsd: 5200, inStock: true },
      { ml: 10, priceRsd: 9000, inStock: true },
    ],
  },
];