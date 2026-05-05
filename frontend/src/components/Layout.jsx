import { NavLink, Link, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/query", label: "Query" },
  { to: "/frequency", label: "Frequency" },
  { to: "/texts", label: "Texts" },
  { to: "/datasets", label: "Datasets" },
  { to: "/subcorpora", label: "Subcorpora" },
  { to: "/lemma-index", label: "Lemma Index" },
  { to: "/pos-index", label: "POS Index" },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="app-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <h1 className="app-title">LogoScope</h1>
          <span className="app-subtitle">Medieval French Corpus Tool</span>
        </Link>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
