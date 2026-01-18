import { Button } from "@/core/components/ui/button";
import { useNavigate } from "react-router-dom";
import LogoInvestigating from "@/assets/Investigating.png";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center min-h-screen w-full px-4 pt-12 pb-24">
      <img src={LogoInvestigating} alt="Investigating" className="mb-4 dark:invert" />
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-2">Page Not Found</p>
      <p className="text-base text-muted-foreground mb-6 text-center max-w-xl">
        Oops! The page you’re looking for doesn’t exist, was moved, or never existed. If you think this is a mistake, please check the URL or return to the home page.
      </p>
      <Button onClick={() => navigate("/")} className="h-12 text-lg font-semibold px-4 w-full max-w-lg">Go Home</Button>
    </div>
  );
}
