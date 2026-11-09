import rose from "@/assets/gift-rose.jpg";
import heart from "@/assets/gift-heart.jpg";
import butterfly from "@/assets/gift-butterfly.jpg";
import cake from "@/assets/gift-cake.jpg";
import crown from "@/assets/gift-crown.jpg";
import diamond from "@/assets/gift-diamond.jpg";
import castle from "@/assets/gift-castle.jpg";
import rocket from "@/assets/gift-rocket.jpg";
import type { Gift } from "@/lib/gifts";
import { cn } from "@/lib/utils";

const images: Record<string, string> = { rose, heart, butterfly, cake, crown, diamond, castle, rocket };
export function GiftArtwork({ gift, className }: { gift: Gift; className?: string }) {
  return <img src={images[gift.key]} alt={gift.name} width={384} height={512} loading="lazy" className={cn("gift-artwork aspect-square w-full object-contain", className)} />;
}