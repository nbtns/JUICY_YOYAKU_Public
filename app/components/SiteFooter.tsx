import Link from "next/link";
import { siteConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>JUICY</strong>
        <p>{siteConfig.tagline}</p>
      </div>
      <div className="footer-links">
        <Link href="/legal#policy">キャンセル・振替規約</Link>
        <Link href="/legal#privacy">プライバシーポリシー</Link>
        <Link href="/legal#commerce">特定商取引法に基づく表記</Link>
        <Link href="/admin">先生用・管理画面</Link>
      </div>
      <p className="copyright">© {new Date().getFullYear()} JUICY Guitar School</p>
    </footer>
  );
}
