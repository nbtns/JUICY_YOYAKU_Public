import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="JUICY ギター教室 トップ">
        <span className="brand-mark" aria-hidden="true">J</span>
        <span>JUICY<small>GUITAR SCHOOL</small></span>
      </Link>
      <nav className="desktop-nav" aria-label="メインメニュー">
        <Link href="/#features">教室について</Link>
        <Link href="/#courses">料金</Link>
        <Link href="/#access">アクセス</Link>
        <Link href="/member">会員ページ</Link>
      </nav>
      <Link className="header-cta" href="/trial">無料体験を予約</Link>
    </header>
  );
}
