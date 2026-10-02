import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("pushndeliver-theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("pushndeliver-theme", dark ? "dark" : "light");
    } catch {
      /* Theme remains usable without storage. */
    }
  }, [dark]);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </Button>
  );
}
