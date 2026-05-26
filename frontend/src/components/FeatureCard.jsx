import { motion } from "framer-motion";

export default function FeatureCard({ icon: Icon, title, description, color }) {
  return (
    <motion.article
      className="feature-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -6 }}
    >
      <div className="icon-wrap" style={{ background: color }}>
        <Icon size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </motion.article>
  );
}
