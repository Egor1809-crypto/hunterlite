import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import AppShell from "../AppShell";
import WorkspaceFrame from "../WorkspaceFrame";
import { EnergyStatus } from "../EnergyStatus";
import { energyCacheKey, readEnergyBalance } from "@/lib/energyBalance";
import { trainingDay } from "@/lib/trainingDay";
import { usesWorkspace } from "@/lib/workspaceRoutes";
const state = vi.hoisted(() => ({path:"/home",user:{id:"alice",full_name:"Алексей Иванов",role:"admin"} as {id:string;full_name:string;role:string}|null,theme:"light",setTheme:vi.fn(),get:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>state.path,useRouter:()=>({push:vi.fn(),replace:vi.fn()})}));
vi.mock("next/link",()=>({default:({children,href,...rest}:React.ComponentProps<"a">)=><a href={href} {...rest}>{children}</a>}));
vi.mock("next-themes",()=>({useTheme:()=>({resolvedTheme:state.theme,setTheme:state.setTheme})}));
vi.mock("@/stores/useAuthStore",()=>({useAuthStore:(selector:(s:unknown)=>unknown)=>selector({user:state.user,logout:vi.fn()})}));
vi.mock("@/lib/api",()=>({api:{get:state.get}}));
beforeEach(()=>{
 state.path="/home";state.user={id:"alice",full_name:"Алексей Иванов",role:"admin"};state.theme="light";state.setTheme.mockClear();localStorage.clear();
 state.get.mockReset().mockResolvedValue({energy:{date:trainingDay(),remaining:17}});
 Object.defineProperty(window,"matchMedia",{writable:true,value:vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
});
afterEach(cleanup);
it("keeps the same sidebar and energy DOM across routes, and mounts content once",async()=>{
 let mounts=0;
 function Content(){useEffect(()=>{mounts++},[]);return <p>Раздел</p>}
 const view=render(<WorkspaceFrame><Content /></WorkspaceFrame>);
 const sidebar=await screen.findByLabelText("Боковая панель");
 const meter=await screen.findByRole("meter");
 expect(mounts).toBe(1);
 fireEvent.click(screen.getByRole("button",{name:"Свернуть панель"}));
 expect(sidebar).toHaveAttribute("data-collapsed","true");
 state.path="/cases";
 view.rerender(<WorkspaceFrame><p>Кейсы</p></WorkspaceFrame>);
 expect(screen.getByLabelText("Боковая панель")).toBe(sidebar);
 expect(screen.getByRole("meter")).toBe(meter);
 expect(sidebar).toHaveAttribute("data-collapsed","true");
 expect(screen.getByRole("link",{name:"Кейсы"})).toHaveAttribute("aria-current","page");
});
it("profile offers settings, logout, and theme, supports Escape and restores focus",async()=>{
 render(<WorkspaceFrame><p>Контент</p></WorkspaceFrame>);
 const trigger=await screen.findByRole("button",{name:"Меню пользователя: Алексей Иванов"});
 expect(screen.queryByText("Светлая / тёмная")).not.toBeInTheDocument();
 fireEvent.click(trigger);
 expect(screen.getByRole("link",{name:"Настройки"})).toHaveFocus();
 expect(screen.getByRole("button",{name:"Выйти"})).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/Поменять тему/}));
 expect(state.setTheme).toHaveBeenCalledWith("dark");
 fireEvent.keyDown(document,{key:"Escape"});
 expect(screen.queryByRole("group",{name:"Действия профиля"})).not.toBeInTheDocument();
 expect(trigger).toHaveFocus();
});
it("never shows a previous user's cached balance or fabricated full energy",async()=>{
 localStorage.setItem(energyCacheKey("alice"),JSON.stringify({date:trainingDay(),remaining:8}));
 state.get.mockImplementation(()=>new Promise(()=>{}));
 const view=render(<EnergyStatus />);
 expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow","8");
 state.user={id:"bob",full_name:"Борис",role:"manager"};view.rerender(<EnergyStatus />);
 expect(screen.queryByRole("meter")).not.toBeInTheDocument();
});
it("does not overwrite a spent balance with an older in-flight response",async()=>{
 let resolve!:(value:unknown)=>void;
 state.get.mockImplementation(()=>new Promise(r=>{resolve=r}));
 render(<EnergyStatus />);
 await waitFor(()=>expect(state.get).toHaveBeenCalledTimes(1));
 localStorage.setItem(energyCacheKey("alice"),JSON.stringify({date:trainingDay(),remaining:12}));
 act(()=>window.dispatchEvent(new Event("hunterlite:energy")));
 await act(async()=>resolve({energy:{date:trainingDay(),remaining:25}}));
 expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow","12");
});
it("validates the date and value of an energy cache",()=>{
 const now=new Date("2026-09-14T21:00:00Z");
 expect(readEnergyBalance({date:"2026-09-14",remaining:25},now)).toBeNull();
 for(const remaining of [null,"25",NaN,Infinity]) expect(readEnergyBalance({date:"2026-09-15",remaining},now)).toBeNull();
 expect(readEnergyBalance({date:"2026-09-15",remaining:0},now)).toBe(0);
});
it("retains public pages and focused calls outside the navigation shell",()=>{
 for(const path of ["/","/login","/register","/pricing","/championship/rules","/exam/certificate/verify/code","/training/session/call"]) expect(usesWorkspace(path,true)).toBe(false);
 expect(usesWorkspace("/championship",false)).toBe(false);
 expect(usesWorkspace("/championship",true)).toBe(true);
 for(const path of ["/home","/cases/1","/exam","/courses/1","/training/session","/pvp/quiz/1"]) expect(usesWorkspace(path)).toBe(true);
});

it("mounts page content once during shell hydration",async()=>{
 let mounts=0;
 function Content(){useEffect(()=>{mounts++},[]);return <p>Страница</p>}
 render(<AppShell><Content /></AppShell>);
 await screen.findByLabelText("Боковая панель");
 expect(mounts).toBe(1);
});

it("keeps full-screen practice free of sidebar while retaining energy", async()=>{
 state.path="/training/session";
 const view=render(<WorkspaceFrame><p>Диалог</p></WorkspaceFrame>);
 await screen.findByRole("meter");
 expect(screen.queryByLabelText("Боковая панель")).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Открыть меню"})).not.toBeInTheDocument();
 state.path="/pvp/quiz/session";view.rerender(<WorkspaceFrame><p>Тест</p></WorkspaceFrame>);
 expect(screen.queryByLabelText("Боковая панель")).not.toBeInTheDocument();
});
