import { Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'

/**
 * ContactSection — About and Contact content, rendered inside the profile page.
 * The standalone Contact page and route were removed.
 */
export default function ContactSection() {
  return (
    <section id="armory-contact" className="profile-contact">
      <div className="profile-contact__head">
        <h2 className="section-title">A one-room armory. Come by the shop.</h2>
        <p className="lede">
          Bore &amp; Barrel sells a short, honest list of firearms. Each piece is
          priced from the bench — no markup theatre, no filler.
        </p>
      </div>

      <div className="info-grid">
        <article className="info-card">
          <h3 className="info-card__title">
            <ShieldCheck size={18} /> About the armory
          </h3>
          <p>
            We stock pistols, rifles, and shotguns that we can service ourselves.
            Every listing carries its type, caliber, and price, plus the
            maintenance steps we actually use on the bench.
          </p>
          <p>
            No consignment clutter, no custom orders that never arrive. If it is
            on the wall, it is in stock and it has been checked by an armorer.
          </p>
        </article>

        <article className="info-card">
          <h3 className="info-card__title">
            <MapPin size={18} /> Visit
          </h3>
          <ul className="info-list">
            <li>
              <MapPin size={15} /> 123 Range Road, Building B
            </li>
            <li>
              <Clock size={15} /> Tuesday to Saturday, 10:00 – 18:00
            </li>
            <li>
              <Phone size={15} />{' '}
              <a href="tel:+15550100100">(555) 010-0100</a>
            </li>
            <li>
              <Mail size={15} />{' '}
              <a href="mailto:counter@boreandbarrel.example">
                counter@boreandbarrel.example
              </a>
            </li>
          </ul>
        </article>

        <article className="info-card">
          <h3 className="info-card__title">Counter notes</h3>
          <p>
            Bring a valid permit for any transfer. Ammunition and cleaning
            supplies are sold at the counter only — not listed in the online
            catalog.
          </p>
          <p>
            Maintenance questions? Use the review section on any hardware record
            so other operators can see the answer.
          </p>
        </article>
      </div>
    </section>
  )
}
