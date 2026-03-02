import type { AnchorHTMLAttributes, ReactNode } from "react";

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
