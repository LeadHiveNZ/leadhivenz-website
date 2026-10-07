import { Link, NavLink } from "react-router-dom";
import logo from "/leadhive-logo.png";

const SiteHeader = () => (
  <header className="top">
    <div className="wrap">
      <Link className="brand" to="/" aria-label="LeadHive NZ home">
        <img src={logo} alt="LeadHive NZ, marketing agency for tradies" width={48} height={48} />
        <span>
          Lead<b>Hive</b> NZ
        </span>
      </Link>
      <nav className="nav" aria-label="Main">
        <NavLink to="/how-it-works">How it works</NavLink>
        <NavLink to="/areas">Open areas</NavLink>
        <NavLink to="/pricing">Pricing</NavLink>
        <NavLink to="/guides">Guides</NavLink>
        <NavLink to="/faq">Straight answers</NavLink>
      </nav>
      <Link className="btn btn-gold" to="/contact">
        Check my area
      </Link>
    </div>
  </header>
);

export default SiteHeader;
