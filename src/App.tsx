import { Toaster } from "@/components/ui/sonner";
import Router from "./router/Router";
import { UserProvider } from "./contexts/UserContext";

function App() {
  return (
    <UserProvider>
      <Toaster position="top-center" richColors />
      <Router />
    </UserProvider>
  );
}

export default App;
