import { motion } from "framer-motion";
import { Brain, Leaf, ShieldCheck, Sprout } from "lucide-react";

const blocks = [
  {
    icon: Brain,
    title: "Data-Driven Decisions",
    text: "AI combines soil, weather, and farming signals to reduce guesswork and improve planning quality.",
  },
  {
    icon: Sprout,
    title: "Resource Optimization",
    text: "Predictive insights help balance fertilizer, water, and crop choice for better sustainability.",
  },
  {
    icon: ShieldCheck,
    title: "Climate Resilience",
    text: "Risk scoring highlights vulnerable conditions earlier so mitigation actions can start sooner.",
  },
  {
    icon: Leaf,
    title: "Scalable Farming Intelligence",
    text: "Reusable prediction services allow extension to districts, states, or integrated agri platforms.",
  },
];

export default function AboutPage() {
  return (
    <div className="page-stack">
      <section className="glass-panel about-hero">
        <h1>About AI Farming</h1>
        <p>
          AI-assisted agriculture uses predictive models to guide crop selection,
          estimate output, and proactively monitor climate impact. This system
          operationalizes those insights in a production-style web workflow.
        </p>
      </section>

      <section className="about-grid">
        {blocks.map((item, idx) => (
          <motion.article
            className="about-card"
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.06, duration: 0.45 }}
          >
            <item.icon size={22} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </motion.article>
        ))}
      </section>
    </div>
  );
}
