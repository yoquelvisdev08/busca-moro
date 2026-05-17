import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", glyph: "::" },
  { to: "/leads", label: "Leads", glyph: ">_" },
  { to: "/pipeline", label: "Pipeline", glyph: "▦" },
  { to: "/sniper", label: "Sniper", glyph: "[!]" },
  { to: "/settings", label: "Settings", glyph: "⚙" },
];

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden />
          <span>SIPHON-X</span>
          <span className="tag">VOID-TECH CONSOLE / v0.1</span>
        </div>
        <div className="session">
          session <strong>operator://siphon</strong>
        </div>
      </header>
      <aside className="sidebar">
        <h4>NAV</h4>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="glyph">{item.glyph}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <h4>MODULES</h4>
        <a href="#" onClick={(e) => e.preventDefault()}>
          <span className="glyph">~</span>scout
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          <span className="glyph">~</span>auditor
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          <span className="glyph">~</span>closer
        </a>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
