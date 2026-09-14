import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useTheme } from "next-themes";
import { Providers } from "../Providers";
vi.mock("@/providers/NotificationWSProvider", () => ({NotificationWSProvider:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/components/ui/Toaster", () => ({Toaster:()=>null}));
function ThemeProbe(){const {resolvedTheme}=useTheme();return <output>{resolvedTheme}</output>}
beforeEach(()=>{
  localStorage.clear();document.documentElement.className="";
  Object.defineProperty(window,"matchMedia",{writable:true,value:vi.fn(()=>({matches:true,media:"(prefers-color-scheme: dark)",addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
});
afterEach(cleanup);
it("starts light after site data is cleared even when the OS is dark",async()=>{
  render(<Providers><ThemeProbe /></Providers>);
  await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("light"));
  expect(document.documentElement).toHaveClass("light");
});
it("keeps the user's explicitly saved dark theme",async()=>{
  localStorage.setItem("vh-theme","dark");
  render(<Providers><ThemeProbe /></Providers>);
  await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("dark"));
  expect(document.documentElement).toHaveClass("dark");
});
