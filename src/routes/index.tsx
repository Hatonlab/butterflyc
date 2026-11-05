import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ButterflyMark } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "شات فراشات العرب - دردشة عربية عامة" },
      { name: "description", content: "انضم إلى شات فراشات العرب: غرف دردشة عربية عامة، خاص، ومتصلين الآن." },
      { property: "og:title", content: "شات فراشات العرب" },
      { property: "og:description", content: "غرف دردشة عربية عامة للجميع" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/home" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <ButterflyMark className="h-20 w-20 animate-floaty" animated />
    </div>
  );
}
