import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppLayout from "@/components/AppLayout";
import { PixelBackground } from "@/components/PixelBackground";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoAuthProvider } from "@/lib/demo-auth";

const queryClient = new QueryClient();

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Consent = lazy(() => import("./pages/Consent"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Modes = lazy(() => import("./pages/Modes"));
const SessionSetup = lazy(() => import("./pages/SessionSetup"));
const SessionChat = lazy(() => import("./pages/SessionChat"));
const CaseTraining = lazy(() => import("./pages/CaseTraining"));
const ArenaTraining = lazy(() => import("./pages/ArenaTraining"));
const AnswerReview = lazy(() => import("./pages/AnswerReview"));
const SessionResult = lazy(() => import("./pages/SessionResult"));
const RemedialCourse = lazy(() => import("./pages/RemedialCourse"));
const Courses = lazy(() => import("./pages/Courses"));
const History = lazy(() => import("./pages/History"));
const WeakTopics = lazy(() => import("./pages/WeakTopics"));
const Notifications = lazy(() => import("./pages/Notifications"));
const BflBook = lazy(() => import("./pages/BflBook"));
const Profile = lazy(() => import("./pages/Profile"));
const Manager = lazy(() => import("./pages/Manager"));
const ManagerEmployee = lazy(() => import("./pages/ManagerEmployee"));
const ManagerReports = lazy(() => import("./pages/ManagerReports"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminTests = lazy(() => import("./pages/admin/AdminTests"));
const AdminCases = lazy(() => import("./pages/admin/AdminCases"));
const AdminObjections = lazy(() => import("./pages/admin/AdminObjections"));
const AdminCallScripts = lazy(() => import("./pages/admin/AdminCallScripts"));
const AdminMethodology = lazy(() => import("./pages/admin/AdminMethodology"));
const ClientChat = lazy(() => import("./pages/ClientChat"));
const ClientLead = lazy(() => import("./pages/ClientLead"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-6 text-sm font-medium text-muted-foreground">
    Загрузка...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PixelBackground />
      <div className="relative z-10 min-h-screen">
        <BrowserRouter>
          <DemoAuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/consent" element={<Consent />} />

                {/* Full-screen session screens (no sidebar) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/session/talk" element={<SessionChat mode="talk" />} />
                  <Route path="/session/exam" element={<SessionChat mode="exam" />} />
                  <Route path="/session/cases" element={<CaseTraining />} />
                  <Route path="/session/arena" element={<ArenaTraining />} />
                </Route>

                {/* Client surface */}
                <Route path="/client" element={<ClientChat />} />
                <Route path="/client/chat" element={<ClientChat />} />
                <Route path="/client/lead" element={<ClientLead />} />

                {/* Authenticated app shell */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/modes" element={<Modes />} />
                    <Route path="/session/setup" element={<SessionSetup />} />
                    <Route path="/courses" element={<Courses />} />
                    <Route path="/session/answer-review" element={<AnswerReview />} />
                    <Route path="/session/result" element={<SessionResult />} />
                    <Route path="/remedial-course" element={<RemedialCourse />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/weak-topics" element={<WeakTopics />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/bfl-book" element={<BflBook />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/manager" element={<Manager />} />
                    <Route path="/manager/employee/:id" element={<ManagerEmployee />} />
                    <Route path="/manager/reports" element={<ManagerReports />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    <Route path="/admin/tests" element={<AdminTests />} />
                    <Route path="/admin/cases" element={<AdminCases />} />
                    <Route path="/admin/objections" element={<AdminObjections />} />
                    <Route path="/admin/scripts" element={<AdminCallScripts />} />
                    <Route path="/admin/methodology" element={<AdminMethodology />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </DemoAuthProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
