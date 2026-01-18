import Dashboard from "@/core/pages/Dashboard";
import { Toaster } from "@/core/components/ui/sonner";

const MainLayout = () => {
  return (
    <div className="flex bg-background h-screen w-screen flex-col">
      <Dashboard />
      <Toaster />
    </div>
  );
};

export default MainLayout;
