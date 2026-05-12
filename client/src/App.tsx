import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useWorkMode } from "./components/WorkModeToggle";
import { useHue } from "./components/HueShift";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TimerProvider } from "./contexts/TimerContext";
import { SoundProvider } from "./contexts/SoundContext";
import Home from "./pages/Home";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Monthly from "@/pages/Monthly";
import AdminDashboard from "@/pages/AdminDashboard";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/monthly" component={Monthly} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      {/* Admin-only route — no nav entry point, direct URL access only */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialise work mode from localStorage on mount
  useWorkMode();
  // Initialise hue shift from localStorage on mount
  useHue();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <SoundProvider>
        <TimerProvider>
        <TooltipProvider>
          {/* Main app */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <Toaster position="bottom-right" closeButton />
            <Router />
          </div>
        </TooltipProvider>
        </TimerProvider>
        </SoundProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
