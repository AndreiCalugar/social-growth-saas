import Link from "next/link"
import { ArrowRight, Check, Plus } from "lucide-react"
import { InstagramIcon } from "@/components/instagram-icon"
import { BrandMark } from "@/components/brand-mark"
import { PhoneDemo } from "./phone-demo"

// Romanian landing for the comment-to-DM product. The previous English
// landing (competitor insights) lives in components/landing/ and is unused
// while the scraper features are paused.

const INSTAGRAM_URL = "https://www.instagram.com/andreixperience/"
// Photos live in src/public/images/. Set a path to switch the photo on:
// - HERO_PHOTO: full-bleed hero (landscape, ~2400px wide, subject on the
//   right, calm space on the left for the headline). Without it the hero
//   shows the animated phone instead.
// - FOUNDER_PHOTO: square-ish portrait for "De ce l-am construit"; falls back
//   to a monogram.
const HERO_PHOTO: string | null = null // e.g. "/images/hero.jpg"
const FOUNDER_PHOTO: string | null = null // e.g. "/images/founder.jpg"

const USE_CASES = [
  {
    who: "Creator de conținut",
    keyword: "GHID",
    dm: "Uite ghidul gratuit pe care ți l-am promis: …",
  },
  {
    who: "Salon de înfrumusețare",
    keyword: "PREȚ",
    dm: "Manichiura semipermanentă e 120 lei. Te programezi aici: …",
  },
  {
    who: "Magazin online",
    keyword: "MĂRIME",
    dm: "Tabelul de mărimi pentru rochia asta îl găsești aici: …",
  },
  {
    who: "Coach sau cursuri",
    keyword: "CURS",
    dm: "Înscrierile sunt deschise până vineri. Toate detaliile: …",
  },
]

const STEPS = [
  {
    title: "Conectezi Instagramul",
    text: "Un click, prin login-ul oficial Instagram. Nu ne dai parola, iar accesul îl poți retrage oricând.",
  },
  {
    title: "Alegi postarea și cuvântul",
    text: "O postare anume sau toate postările. Cuvântul e cel pe care le ceri oamenilor să-l scrie: LINK, PREȚ, GHID.",
  },
  {
    title: "Scrii mesajul o singură dată",
    text: "De acum, oricine comentează acel cuvânt primește DM-ul în câteva secunde. Zi și noapte, fără tine.",
  },
]

const FAQ = [
  {
    q: "Am nevoie de un cont Business?",
    a: "Da, Business sau Creator. Schimbarea e gratuită și durează un minut: în Instagram, Setări → Tipul de cont și instrumente → Treci la un cont profesional.",
  },
  {
    q: "Trebuie să-mi dau parola? E sigur?",
    a: "Nimeni nu îți cere parola. Conectarea se face prin login-ul oficial Instagram (API-ul Meta), primim doar permisiunile pentru comentarii și mesaje, iar accesul e stocat criptat. Poți deconecta contul oricând, din aplicație sau din Instagram.",
  },
  {
    q: "Cât de repede ajunge mesajul?",
    a: "De obicei în câteva secunde. În cel mai rău caz, în jur de un minut.",
  },
  {
    q: "Primesc DM și cei care nu mă urmăresc?",
    a: "Da. Oricine comentează cuvântul-cheie la postarea aleasă primește mesajul, o singură dată per comentariu.",
  },
  {
    q: "Pot avea probleme cu Instagram?",
    a: "Folosim API-ul oficial Meta, nu boți și nici scraping. Trimitem un singur mesaj pentru fiecare comentariu și respectăm limitele impuse de Instagram.",
  },
  {
    q: "Cum intru în beta?",
    a: "Îți faci cont aici și îmi trimiți username-ul de Instagram (sau comentezi BETA la reel-ul meu). Te adaug ca tester, accepți invitația pe instagram.com (Setări → Aplicații și site-uri → Invitații de tester) și îți conectezi contul. Durează câteva minute.",
  },
  {
    q: "Cât costă după beta?",
    a: "Va exista un abonament lunar în lei, cu factură. Te anunțăm din timp, iar nimic nu se plătește automat: nu îți cerem cardul în beta.",
  },
]

export function LandingRo() {
  return (
    <div className="min-h-screen bg-white font-body text-ink antialiased">
      <Header />
      <main>
        {HERO_PHOTO ? (
          <>
            <PhotoHero src={HERO_PHOTO} />
            <DemoSection />
          </>
        ) : (
          <Hero />
        )}
        <UseCases />
        <HowItWorks />
        <FounderNote />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-[17px] font-bold tracking-tight">
        Social Growth
      </span>
    </Link>
  )
}

function PrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      {children}
    </Link>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
          <a href="#cum-functioneaza" className="hover:text-ink">Cum funcționează</a>
          <a href="#pret" className="hover:text-ink">Preț</a>
          <a href="#intrebari" className="hover:text-ink">Întrebări</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink sm:inline-flex"
          >
            Autentificare
          </Link>
          <Link
            href="/signup"
            className="inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
          >
            Intră în beta
          </Link>
        </div>
      </div>
    </header>
  )
}

// „LINK” set as the thing it is — a comment someone types.
function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 inline-block -rotate-2 rounded-2xl rounded-bl-md bg-brand px-3 pb-1 text-white">
      {children}
    </span>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20 lg:pt-20">
      <div>
        <HeroCopy />
      </div>

      <div className="flex justify-center lg:justify-end">
        <PhoneDemo />
      </div>
    </section>
  )
}

function HeroCopy({ onPhoto = false }: { onPhoto?: boolean }) {
  return (
    <>
      <p
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${
          onPhoto ? "bg-white/15 text-white/90 backdrop-blur-sm" : "bg-mist text-ink-soft"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-sent" />
        Beta deschis · pentru creatori și afaceri mici din România
      </p>
      <h1 className="mt-6 font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl xl:text-[4.1rem]">
        Cineva scrie<KeywordChip>LINK</KeywordChip>
        <br />
        Primește linkul în DM.
        <br />
        <span className={onPhoto ? "text-white/70" : "text-ink-soft"}>
          Tu nu faci nimic.
        </span>
      </h1>
      <p
        className={`mt-6 max-w-xl text-lg leading-relaxed ${
          onPhoto ? "text-white/80" : "text-ink-soft"
        }`}
      >
        Social Growth răspunde automat la comentariile de pe Instagram: trimite
        mesajul promis în privat și lasă un răspuns public sub comentariu, în
        câteva secunde. Prin API-ul oficial Meta, fără să-ți dai parola.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PrimaryButton href="/signup">
          Intră în beta, gratuit
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        <a
          href="#cum-functioneaza"
          className={`rounded-full px-5 py-3.5 text-[15px] font-semibold ${
            onPhoto
              ? "border border-white/30 text-white hover:bg-white/10"
              : "text-ink hover:bg-mist"
          }`}
        >
          Vezi cum funcționează
        </a>
      </div>
      <p className={`mt-4 text-[13px] ${onPhoto ? "text-white/60" : "text-ink-soft"}`}>
        Ai nevoie de un cont Instagram Business sau Creator.
      </p>
    </>
  )
}

// Full-bleed photo hero with the comment → DM exchange floating over it.
function PhotoHero({ src }: { src: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/10" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink/60 to-transparent" />

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <HeroCopy onPhoto />
        </div>
      </div>

      <div className="absolute bottom-12 right-[7%] hidden w-72 space-y-3 lg:block" aria-hidden>
        <div className="flex items-end gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7c6cf0] text-[10px] font-bold">
            A
          </span>
          <p className="rounded-2xl rounded-bl-md bg-white/15 px-3.5 py-2 text-sm backdrop-blur-md">
            LINK 🙏
          </p>
        </div>
        <div className="ml-9 rounded-2xl rounded-bl-md bg-brand p-3 text-sm leading-snug shadow-xl shadow-ink/30">
          Salut, Andreea! 👋 Uite ghidul promis: contultau.ro/ghid-reel
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/75">
            <span className="rounded bg-white/20 px-1 font-stamp">0:16</span>
            trimis automat
          </p>
        </div>
      </div>
    </section>
  )
}

// With a photo hero, the animated phone gets its own section right after.
function DemoSection() {
  return (
    <section className="py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
        <SectionTitle
          eyebrow="Vezi cum arată"
          title="De la comentariu la DM, în câteva secunde."
        />
        <div className="flex justify-center">
          <PhoneDemo />
        </div>
      </div>
    </section>
  )
}

function SectionTitle({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string
  title: string
  id?: string
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.6rem]">
        {title}
      </h2>
    </div>
  )
}

function UseCases() {
  return (
    <section className="bg-mist py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle
          eyebrow="Pentru cine"
          title="Un cuvânt-cheie, adaptat afacerii tale."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((c) => (
            <div key={c.who} className="flex flex-col rounded-3xl bg-white p-5">
              <p className="text-sm font-semibold text-ink">{c.who}</p>
              <p className="mt-4 text-[12px] text-ink-soft">Comentariu</p>
              <span className="mt-1 w-fit rounded-2xl rounded-bl-md bg-mist px-3 py-1.5 font-display text-lg font-bold">
                {c.keyword}
              </span>
              <p className="mt-4 text-[12px] text-ink-soft">Mesaj automat</p>
              <p className="mt-1 rounded-2xl rounded-bl-md bg-ink px-3 py-2 text-[13.5px] leading-snug text-white">
                {c.dm}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle
          id="cum-functioneaza"
          eyebrow="Cum funcționează"
          title="Gata în două minute. Fără scheme complicate."
        />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-5">
              <span className="font-display text-5xl font-extrabold text-brand">
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-xl font-bold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function FounderNote() {
  return (
    <section className="pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 rounded-[2rem] bg-brand-soft p-6 sm:p-10 md:grid-cols-[auto_1fr]">
          {FOUNDER_PHOTO ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={FOUNDER_PHOTO}
              alt="Andrei, fondatorul Social Growth"
              className="h-40 w-40 rounded-[1.75rem] object-cover md:h-56 md:w-56"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-[1.75rem] bg-brand font-display text-7xl font-extrabold text-white md:h-56 md:w-56">
              A
            </div>
          )}
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand-deep">
              De ce l-am construit
            </p>
            <p className="mt-3 max-w-2xl font-display text-2xl font-semibold leading-snug tracking-tight sm:text-[1.7rem]">
              „Postam reel-uri cu «scrie LINK în comentarii» și apoi trimiteam
              același mesaj, pe rând, zeci de oameni. Uneltele care fac asta sunt
              în engleză, complicate și plătite în dolari. Așa că mi-am construit
              una.”
            </p>
            <p className="mt-4 text-ink-soft">
              Andrei Călugăr ·{" "}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink underline underline-offset-4"
              >
                @andreixperience
              </a>
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm">
              <span className="rounded-md bg-sent px-1.5 py-0.5 font-stamp text-[11px] font-medium text-white">
                0:16
              </span>
              Primul DM trimis unui om real a ajuns în 16 secunde.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section className="bg-mist py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 md:items-center">
        <SectionTitle
          id="pret"
          eyebrow="Preț"
          title="Gratuit cât timp suntem în beta."
        />
        <div className="rounded-3xl bg-white p-7">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold tracking-tight">
              0 lei
            </span>
            <span className="text-ink-soft">pe lună, în beta</span>
          </div>
          <ul className="mt-6 space-y-3">
            {[
              "Automatizări pe oricâte postări",
              "Mesaj privat și răspuns public automat",
              "Istoricul tuturor mesajelor trimise",
              "Suport direct, în română",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-sent" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton href="/signup" className="mt-7 w-full">
            Intră în beta
          </PrimaryButton>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            După beta: abonament lunar în lei, cu factură. Te anunțăm din timp și
            nu îți cerem cardul acum.
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionTitle id="intrebari" eyebrow="Întrebări" title="Ce vor oamenii să știe." />
        <div className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[2rem] bg-ink px-6 py-14 text-center text-white sm:px-10">
        <h2 className="mx-auto max-w-2xl font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
          Vrei să-l încerci pe contul tău?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
          Fă-ți cont acum sau comentează <strong className="text-white">BETA</strong>{" "}
          la ultimul meu reel. Îți trimit totul în DM. Automat, evident.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PrimaryButton href="/signup">
            Intră în beta
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[15px] font-semibold hover:bg-white/10"
          >
            <InstagramIcon className="h-4 w-4" />
            @andreixperience
          </a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-sm text-ink-soft">
            Răspunsuri automate în DM pentru comentariile de pe Instagram.
          </p>
          <a
            href="mailto:andrei.nicolae.calugar@gmail.com"
            className="mt-3 inline-block text-sm font-medium text-ink underline underline-offset-4"
          >
            andrei.nicolae.calugar@gmail.com
          </a>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-ink-soft">
          <Link href="/privacy" className="hover:text-ink">Confidențialitate</Link>
          <Link href="/terms" className="hover:text-ink">Termeni</Link>
          <Link href="/cookies" className="hover:text-ink">Cookie-uri</Link>
          <Link href="/data-deletion" className="hover:text-ink">Ștergerea datelor</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-soft sm:px-6">
        © {new Date().getFullYear()} Social Growth · Operat de CĂLUGĂR
        ANDREI-NICOLAE PERSOANĂ FIZICĂ AUTORIZATĂ · CUI 51961870 · Nr. Reg. Com.
        F2025021277008
      </div>
    </footer>
  )
}
