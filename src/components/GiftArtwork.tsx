import rose from "@/assets/gift-rose.webp";
import heart from "@/assets/gift-heart.webp";
import butterfly from "@/assets/gift-butterfly.webp";
import cake from "@/assets/gift-cake.webp";
import crown from "@/assets/gift-crown.webp";
import diamond from "@/assets/gift-diamond.webp";
import castle from "@/assets/gift-castle.webp";
import rocket from "@/assets/gift-rocket.webp";
import type { Gift } from "@/lib/gifts";
import { cn } from "@/lib/utils";

const images: Record<string, string> = { rose, heart, butterfly, cake, crown, diamond, castle, rocket };
export function GiftArtwork({ gift, className }: { gift: Gift; className?: string }) {
  return <img src={images[gift.key]} alt={gift.name} width={512} height={512} loading="lazy" draggable={false} className={cn("gift-artwork aspect-square w-full object-contain", className)} />;
}
