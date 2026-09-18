import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motive",
  description:
    "리서치와 의사결정의 맥락을 구조화해, 코딩 에이전트가 그대로 이어받게 만드는 워크스페이스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!bg-ink !text-white !border-0 !rounded-[8px] !text-[14px] !leading-[19px] !shadow-[0_8px_24px_rgba(24,24,27,.2)]",
              description: "!text-white/70",
              actionButton: "!bg-transparent !border !border-white/25 !text-white !rounded-[6px] !h-6 !px-2",
            },
          }}
        />
      </body>
    </html>
  );
}
