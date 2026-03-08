import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, FullAccessRoute, AdminRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Lawyers from "./pages/Lawyers";
import Cases from "./pages/Cases";
import Chat from "./pages/Chat";
import ObjectionGenerator from "./pages/ObjectionGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<FullAccessRoute><Index /></FullAccessRoute>} />
            <Route path="/history" element={<FullAccessRoute><History /></FullAccessRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/lawyers" element={<ProtectedRoute><Lawyers /></ProtectedRoute>} />
            <Route path="/cases" element={<FullAccessRoute><Cases /></FullAccessRoute>} />
            <Route path="/chat" element={<FullAccessRoute><Chat /></FullAccessRoute>} />
            <Route path="/objection-generator" element={<FullAccessRoute><ObjectionGenerator /></FullAccessRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
