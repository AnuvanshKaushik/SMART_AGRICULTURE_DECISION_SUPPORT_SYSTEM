import { motion } from "framer-motion";
import { BarChart3, Sprout, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import FeatureCard from "../components/FeatureCard";

const features = [
  {
    icon: Sprout,
    title: "Crop Recommendation",
    description:
      "Get the best crop suggestion from soil nutrients, weather, rainfall, and pH with confidence scores.",
    color: "linear-gradient(135deg, #2e7d32, #66bb6a)",
  },
  {
    icon: BarChart3,
    title: "Yield Prediction",
    description:
      "Forecast likely yield based on farm and environment parameters and visualize expected performance.",
    color: "linear-gradient(135deg, #6d4c41, #42a5f5)",
  },
  {
    icon: TriangleAlert,
    title: "Climate Risk Analysis",
    description:
      "Classify climate risk into Low, Medium, High levels and get practical mitigation guidance.",
    color: "linear-gradient(135deg, #42a5f5, #66bb6a)",
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero glass-panel">
        <div className="hero-content">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            AI Smart Agriculture System
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
          >
            Sustainable farming decisions powered by your trained AI models for crop
            planning, yield forecasting, and climate risk awareness.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16 }}
          >
            <Link to="/dashboard" className="btn btn-primary">
              Open Prediction Dashboard
            </Link>
            <Link to="/about" className="btn btn-secondary">
              Explore AI Farming
            </Link>
          </motion.div>
        </div>
        <div className="hero-visual">
          <div className="sun" />
          <div className="field field-1" />
          <div className="field field-2" />
          <div className="plant" />
        </div>
      </section>

      <section className="feature-grid">
        {features.map((item) => (
          <FeatureCard key={item.title} {...item} />
        ))}
      </section>
    </div>
  );
}
