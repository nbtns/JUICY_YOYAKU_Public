import Link from "next/link";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { courses, siteConfig } from "@/lib/config";

const yen = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">PLAY YOUR SONG. PLAY YOUR WAY.</p>
            <h1>好きな曲を、<br /><span className="hero-accent-line"><em>あなたの音</em>に。</span></h1>
            <p className="hero-lead">
              <span className="copy-line">弾きたい気持ちを真ん中に置く、マンツーマン中心のギター教室です。</span>
              <span className="copy-line">初心者も、もう一度始めたい方も歓迎します。</span>
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/trial">初回無料体験を予約</Link>
              <Link className="text-link" href="#courses">料金を見る <span>→</span></Link>
            </div>
            <ul className="hero-facts" aria-label="教室の特徴">
              <li><strong>60</strong><span>分レッスン</span></li>
              <li><strong>7</strong><span>days open</span></li>
              <li><strong>3</strong><span>人までのグループ</span></li>
            </ul>
          </div>
          <div className="hero-art" aria-label="ギターを楽しむための教室">
            <div className="record"><span>JUICY<br />PLAY IT<br />LOUD</span></div>
            <div className="pick pick-one">♪</div>
            <div className="pick pick-two">J</div>
            <p className="vertical-copy">GUITAR LESSONS / EST. 2026</p>
          </div>
        </section>

        <section className="ticker" aria-label="教室からのお知らせ">
          <span>OPENING CAMPAIGN</span>
          <strong>入会金 3,000円（税込）</strong>
          <span>FREE TRIAL NOW</span>
        </section>

        <section id="features" className="section features-section">
          <div className="section-heading">
            <p className="eyebrow">WHY JUICY?</p>
            <h2>「弾けた！」が、<br />次の一曲を連れてくる。</h2>
          </div>
          <div className="feature-grid">
            <article><span>01</span><h3>好きな曲から始める</h3><p>決まった教本だけではなく、弾いてみたい曲を目標に、<br />必要な基礎を一つずつ身につけます。</p></article>
            <article><span>02</span><h3>自分のペースで通える</h3><p>月3・4・8回と、1回ごとのフレックス。<br />生活に合わせて無理なく続けられます。</p></article>
            <article><span>03</span><h3>仲間とのレッスンも</h3><p>家族や友人など、気心の知れたメンバーと<br />最大3人までのグループレッスンができます。</p></article>
          </div>
        </section>

        <section className="section lesson-flow">
          <div className="flow-intro">
            <p className="eyebrow">FIRST SESSION</p>
            <h2>はじめの一歩は、<br />無料体験から。</h2>
            <p>楽器を持っていなくても大丈夫。<br />今の経験や弾いてみたい曲を伺い、ぴったりの始め方を一緒に見つけます。</p>
            <Link className="button button-dark" href="/trial">空いている日時を見る</Link>
          </div>
          <ol className="flow-steps">
            <li><span>1</span><div><strong>日時を選ぶ</strong><p>カレンダーから空いている60分枠を選択。</p></div></li>
            <li><span>2</span><div><strong>かんたん入力</strong><p>経験や弾きたい曲を事前に教えてください。</p></div></li>
            <li><span>3</span><div><strong>教室で体験</strong><p>デモ画面で会場案内の表示を確認できます。</p></div></li>
          </ol>
        </section>

        <section id="courses" className="section courses-section">
          <div className="section-heading row-heading">
            <div><p className="eyebrow">COURSES & PRICE</p><h2>続け方を、選べる。</h2></div>
            <p>すべて1回60分・税込です。月額コースは毎月1日に継続課金されます。</p>
          </div>
          <div className="course-table" role="table" aria-label="料金表">
            <div className="course-row course-head" role="row"><span>コース</span><span>個人</span><span>グループ・1人</span></div>
            {courses.map((course) => (
              <div className={`course-row${course.popular ? " popular" : ""}`} role="row" key={course.key}>
                <span><strong>{course.label}</strong>{course.popular && <small>人気</small>}</span>
                <span><b>{yen(course.individual)}</b>円 {course.unit}</span>
                <span><b>{yen(course.group)}</b>円 {course.unit}</span>
              </div>
            ))}
          </div>
          <div className="price-note"><strong>開校キャンペーン実施中</strong><span>入会金 通常6,000円 → 3,000円（税込）</span></div>
        </section>

        <section id="access" className="section access-section">
          <div className="access-card">
            <p className="eyebrow">ACCESS</p>
            <h2>教室へのアクセス</h2>
            <dl>
              <div><dt>住所</dt><dd>{siteConfig.address}</dd></div>
              <div><dt>営業時間</dt><dd>{siteConfig.businessHours}</dd></div>
              <div><dt>営業日</dt><dd>{siteConfig.businessDays}</dd></div>
            </dl>
            <a className="button button-primary" href={siteConfig.mapUrl} >会場案内を見る</a>
          </div>
          <div className="map-art"><span>JUICY</span><div className="map-pin">J</div><p>YOUR NEXT<br />SONG STARTS<br />HERE.</p></div>
        </section>

        <section className="final-cta">
          <p className="eyebrow">READY TO PLAY?</p>
          <h2>その一曲、<br />今日から始めよう。</h2>
          <Link className="button button-light" href="/trial">無料体験を予約する</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
