import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  label?: string;
  fallback?: string;
  className?: string;
};

export function BackButton({
  label = "Назад",
  fallback = "/dashboard",
  className,
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (location.key === "default") {
      navigate(fallback);
      return;
    }

    navigate(-1);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={goBack}
      className={cn("px-0 text-muted-foreground hover:bg-transparent hover:text-foreground", className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
