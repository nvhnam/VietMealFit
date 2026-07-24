import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">VietMealFit</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Personalized meal planning, exercise routines, and Vietnamese nutrition data — in one
        place.
      </p>
      <Link href="/vietmeal" className={buttonVariants({ size: "lg" })}>
        Get started
      </Link>
    </div>
  );
}
