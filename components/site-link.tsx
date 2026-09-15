import type { AnchorHTMLAttributes } from "react";

type SiteLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
};

export default function SiteLink({ href, ...props }: SiteLinkProps) {
  return <a href={href} {...props} />;
}
