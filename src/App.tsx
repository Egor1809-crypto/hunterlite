import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppLayout from "@/components/AppLayout";
import { PixelBackground } from "@/components/PixelBackground";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoAuthProvider } from "@/lib/demo-auth";
import Login from "./pages/Login";
import Consent from "./pages/Consent";
import Dashboard from "./pages/Dashboard";
import Modes from "./pages/Modes";
import SessionSetup from "./pages/SessionSetup";
import SessionChat from "./pages/SessionChat";
import CaseTraining from "./pages/CaseTraining";
import AnswerReview from "./pages/AnswerReview";
import SessionResult from "./pages/SessionResult";
import RemedialCourse from "./pages/RemedialCourse";
import History from "./pages/History";
import WeakTopics from "./pages/WeakTopics";
import Notifications from "./pages/Notifications";
import BflBook from "./pages/BflBook";
import Profile from "./pages/Profile";
import Manager from "./pages/Manager";
import ManagerEmployee from "./pages/ManagerEmployee";
import ManagerReports from "./pages/ManagerReports";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import AdminTests from "./pages/admin/AdminTests";
import AdminCases from "./pages/admin/AdminCases";
import AdminObjections from "./pages/admin/AdminObjections";
import AdminCallScripts from "./pages/admin/AdminCallScripts";
import AdminMethodology from "./pages/admin/AdminMethodology";
import ClientChat from "./pages/ClientChat";
import ClientLead from "./pages/ClientLead";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PixelBackground />
      <div className="relative z-10 min-h-screen">
        <BrowserRouter>
          <DemoAuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/consent" element={<Consent />} />

              {/* Full-screen session screens (no sidebar) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/session/talk" element={<SessionChat mode="talk" />} />
                <Route path="/session/exam" element={<SessionChat mode="exam" />} />
                <Route path="/session/chat-test" element={<SessionChat mode="chat-test" />} />
                <Route path="/session/cases" element={<CaseTraining />} />
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
          </DemoAuthProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
