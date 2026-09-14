import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AuthCard from "../AuthCard";
import { loginDestination } from "@/lib/loginDestination";
const mock = vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),replace:vi.fn(),setTokens:vi.fn(),fetchUser:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:mock.replace})}));
vi.mock("@/lib/api",()=>({api:{get:mock.get,post:mock.post},resetAuthCircuitBreaker:vi.fn(),ApiError:class extends Error{status=0}}));
vi.mock("@/lib/auth",()=>({setTokens:mock.setTokens}));
vi.mock("@/stores/useAuthStore",()=>({useAuthStore:{getState:()=>({invalidate:vi.fn(),setUser:vi.fn(),fetchUser:mock.fetchUser})}}));
beforeEach(()=>{vi.clearAllMocks();mock.get.mockResolvedValue({yandex:true});mock.post.mockReset();});
afterEach(cleanup);
function fillLogin(){fireEvent.change(screen.getByLabelText("Email",{exact:true}),{target:{value:"Demo@Example.ru"}});fireEvent.change(screen.getByLabelText("Пароль",{exact:true}),{target:{value:"Correct-Password1!"}});}
it("retains entered data and permits retry after a network error",async()=>{
 mock.post.mockRejectedValueOnce(new Error("Сервер недоступен")).mockResolvedValueOnce({access_token:"a",refresh_token:"r",must_change_password:true});
 render(<AuthCard standalone />);fillLogin();fireEvent.click(screen.getByRole("button",{name:"Войти"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Сервер недоступен");
 expect(screen.getByLabelText("Email",{exact:true})).toHaveValue("Demo@Example.ru");
 fireEvent.click(screen.getByRole("button",{name:"Войти"}));
 await waitFor(()=>expect(mock.replace).toHaveBeenCalledWith("/change-password"));
 expect(mock.post.mock.calls[1][1].email).toBe("demo@example.ru");
});
it("does not claim a reset email was sent when the request fails",async()=>{
 mock.post.mockRejectedValue(new Error("Сеть недоступна"));render(<AuthCard />);fillLogin();
 fireEvent.click(screen.getByRole("button",{name:"Забыли пароль?"}));fireEvent.click(screen.getByRole("button",{name:"Отправить ссылку"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Сеть недоступна");expect(screen.queryByText("Проверьте почту")).not.toBeInTheDocument();
});
it("submits login once and ignores a response after closing",async()=>{
 let resolve!:(value:unknown)=>void;mock.post.mockImplementation(()=>new Promise(r=>{resolve=r}));
 const view=render(<AuthCard />);fillLogin();const button=screen.getByRole("button",{name:"Войти"});fireEvent.click(button);fireEvent.click(button);
 expect(mock.post).toHaveBeenCalledTimes(1);view.unmount();
 await act(async()=>resolve({access_token:"a",refresh_token:"r"}));expect(mock.replace).not.toHaveBeenCalled();
});
it("requires explicit registration consent",async()=>{
 render(<AuthCard initialMode="register" />);await waitFor(()=>expect(screen.getByRole("button",{name:"Войти с Яндекс ID"})).toBeEnabled());fillLogin();fireEvent.change(screen.getByLabelText("Имя и фамилия"),{target:{value:"Иван Петров"}});fireEvent.change(screen.getByLabelText("Повторите пароль"),{target:{value:"Correct-Password1!"}});
 fireEvent.click(screen.getByRole("button",{name:"Создать аккаунт"}));expect(mock.post).not.toHaveBeenCalled();expect(screen.getByRole("alert")).toHaveTextContent("согласие");
});
it("supports keyboard-accessible password reveal and field errors",async()=>{
 render(<AuthCard />);await waitFor(()=>expect(screen.getByRole("button",{name:"Войти с Яндекс ID"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Войти"}));expect(screen.getByLabelText("Email",{exact:true})).toHaveFocus();expect(screen.getByLabelText("Email",{exact:true})).toHaveAttribute("aria-invalid","true");
 fireEvent.click(screen.getByRole("button",{name:"Показать пароль"}));expect(screen.getByLabelText("Пароль",{exact:true})).toHaveAttribute("type","text");
});
it("prioritizes required password change and rejects off-site redirects",()=>{
 expect(loginDestination(true,"/exam")).toBe("/change-password");
 for(const path of ["https://evil.test","//evil.test","/\\evil.test","/login"])expect(loginDestination(false,path)).toBe("/home");
 expect(loginDestination(false,"/exam?module=1")).toBe("/exam?module=1");
});
