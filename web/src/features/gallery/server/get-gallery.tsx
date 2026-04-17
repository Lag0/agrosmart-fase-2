import "server-only";
import { getGalleryItems } from "@/shared/db/queries/gallery";
import { GalleryStrip } from "../components/gallery-strip";

export async function GalleryServer() {
  const items = await getGalleryItems(10);
  return <GalleryStrip items={items} />;
}
