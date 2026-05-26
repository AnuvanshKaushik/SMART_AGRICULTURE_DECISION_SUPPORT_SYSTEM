import { NavLink } from "react-router-dom";
import { Leaf } from "lucide-react";

export default function Navbar() {
  return (
    <header className="navbar-wrap">
      <nav className="navbar container">
        <div className="brand">
          <Leaf size={20} />
          <span>AI Smart Agriculture</span>
        </div>
        <div className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/about">About AI Farming</NavLink>
        </div>
      </nav>
    </header>
  );
}
