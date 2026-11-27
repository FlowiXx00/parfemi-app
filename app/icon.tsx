import { ImageResponse } from "next/og";
import { AppIconArt } from "@/features/content/components/app-icon/app-icon";

/** PNG icons for the browser and the home screen (/icon/192, /icon/512; also used by manifest.ts). */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id) === 192 ? 192 : 512;
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size });
}
