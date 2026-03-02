import { useCallback, useEffect, useMemo, useState, type ReactNode, type AnchorHTMLAttributes } from "react";

function getHash() {
  return window.location.hash.replace(/^#\/?/, "");
}

export function useRoute() {
  const [hash, setHash] = useState(getHash);

  useEffect(() => {
    const onHashChange = () => setHash(getHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return useMemo(() => ({ route: hash, navigate }), [hash, navigate]);
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a
      href={`#${to}`}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = to;
        rest.onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
